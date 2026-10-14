import { ISqlExecutor } from '../database/contracts';
import { OrderType, PaymentMethod, ShiftStatus } from '../domain/enums';
import {
  SalesSummaryDTO,
  OrderTypeBreakdownDTO,
  PaymentBreakdownDTO,
  TopProductDTO,
  CashierPerformanceDTO,
  ExpenseReportDTO,
  ShiftReportItemDTO,
  CashRegisterSummaryDTO,
} from '../features/reports/types';
import { InvoiceListItemDTO } from '../features/invoices/types';

import { ReportRepositoryCore } from './ReportRepositoryCore';

export interface DateRangeBounds {
  startIso: string;
  endIso: string;
}

export interface ReportDbFilters {
  startIso: string;
  endIso: string;
  orderType?: OrderType | 'ALL';
  paymentMethod?: PaymentMethod | 'SPLIT' | 'ALL';
  userId?: string | 'ALL';
}

export interface IReportRepository {
  getSalesSummary(filters: ReportDbFilters): Promise<SalesSummaryDTO>;
  getOrderTypeBreakdown(filters: ReportDbFilters): Promise<OrderTypeBreakdownDTO[]>;
  getPaymentBreakdown(filters: ReportDbFilters): Promise<PaymentBreakdownDTO[]>;
  getTopProducts(filters: ReportDbFilters, sortBy?: 'quantity' | 'sales', limit?: number): Promise<TopProductDTO[]>;
  getCashierPerformance(filters: ReportDbFilters): Promise<CashierPerformanceDTO[]>;
  getExpenseReport(filters: ReportDbFilters): Promise<ExpenseReportDTO>;
  getShiftReport(filters: ReportDbFilters): Promise<ShiftReportItemDTO[]>;
  getCashRegisterSummary(filters: ReportDbFilters): Promise<CashRegisterSummaryDTO>;
  getDetailedSales(filters: ReportDbFilters, limit?: number): Promise<InvoiceListItemDTO[]>;
}

export class ReportRepository extends ReportRepositoryCore implements IReportRepository {
  public withTransaction(executor: ISqlExecutor): ReportRepository {
    return new ReportRepository(executor);
  }

  public async getExpenseReport(filters: ReportDbFilters): Promise<ExpenseReportDTO> {
    let where = ' WHERE e.created_at >= ? AND e.created_at <= ?';
    const params: unknown[] = [filters.startIso, filters.endIso];

    if (filters.userId && filters.userId !== 'ALL') {
      where += ' AND e.user_id = ?';
      params.push(filters.userId);
    }

    // Category summary
    const catSql = `
      SELECT 
        e.category,
        COUNT(e.id) AS expenses_count,
        COALESCE(SUM(e.amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN e.paid_from_cash_drawer = 1 THEN e.amount ELSE 0 END), 0) AS drawer_amount
      FROM expenses e
      ${where}
      GROUP BY e.category
      ORDER BY total_amount DESC;
    `;
    const catRows = await this.executor.query<{
      category: string;
      expenses_count: number;
      total_amount: number;
      drawer_amount: number;
    }>(catSql, params);

    // Detailed items
    const itemsSql = `
      SELECT 
        e.id,
        e.category,
        e.description,
        e.amount,
        e.paid_from_cash_drawer,
        COALESCE(u.name, 'غير محدد') AS cashier_name,
        e.created_at
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      ${where}
      ORDER BY e.created_at DESC;
    `;
    const itemsRows = await this.executor.query<{
      id: string;
      category: string;
      description: string;
      amount: number;
      paid_from_cash_drawer: number;
      cashier_name: string;
      created_at: string;
    }>(itemsSql, params);

    const totalExpenses = catRows.reduce((sum, c) => sum + c.total_amount, 0);
    const expensesCount = itemsRows.length;

    return {
      totalExpenses,
      expensesCount,
      byCategory: catRows.map((c) => ({
        category: c.category,
        expensesCount: c.expenses_count,
        totalAmount: c.total_amount,
        paidFromDrawerAmount: c.drawer_amount,
      })),
      items: itemsRows.map((i) => ({
        id: i.id,
        category: i.category,
        description: i.description,
        amount: i.amount,
        paidFromCashDrawer: Boolean(i.paid_from_cash_drawer),
        cashierName: i.cashier_name,
        createdAt: i.created_at,
      })),
    };
  }

  /**
   * 7. Shifts Report
   */
  public async getShiftReport(filters: ReportDbFilters): Promise<ShiftReportItemDTO[]> {
    let where = ' WHERE s.opened_at >= ? AND s.opened_at <= ?';
    const params: unknown[] = [filters.startIso, filters.endIso];

    if (filters.userId && filters.userId !== 'ALL') {
      where += ' AND s.user_id = ?';
      params.push(filters.userId);
    }

    const sql = `
      SELECT 
        s.id,
        s.shift_number,
        s.opened_at,
        s.closed_at,
        s.opening_cash,
        s.expected_cash,
        s.actual_cash,
        s.cash_difference,
        s.status,
        COALESCE(u.name, 'غير محدد') AS cashier_name
      FROM cash_shifts s
      LEFT JOIN users u ON s.user_id = u.id
      ${where}
      ORDER BY s.opened_at DESC;
    `;

    const shiftRows = await this.executor.query<{
      id: string;
      shift_number: string;
      opened_at: string;
      closed_at: string | null;
      opening_cash: number;
      expected_cash: number;
      actual_cash: number | null;
      cash_difference: number | null;
      status: ShiftStatus;
      cashier_name: string;
    }>(sql, params);

    const results: ShiftReportItemDTO[] = [];

    for (const s of shiftRows) {
      // Calculate real shift cash movement for live/closed status
      const txBreakdownSql = `
        SELECT transaction_type, SUM(amount) AS total
        FROM cash_transactions
        WHERE shift_id = ?
        GROUP BY transaction_type;
      `;
      const txRows = await this.executor.query<{ transaction_type: string; total: number }>(txBreakdownSql, [s.id]);

      let cashSales = 0;
      let deposits = 0;
      let expenses = 0;
      let withdrawals = 0;
      let refunds = 0;
      let adjustments = 0;

      for (const tx of txRows) {
        const type = tx.transaction_type;
        const amt = tx.total || 0;
        if (type === 'SALE' || type === 'SALE_PAYMENT') cashSales += amt;
        else if (type === 'DEPOSIT' || type === 'CASH_IN') deposits += amt;
        else if (type === 'EXPENSE') expenses += amt;
        else if (type === 'WITHDRAWAL' || type === 'CASH_OUT') withdrawals += amt;
        else if (type === 'REFUND') refunds += amt;
        else if (type === 'ADJUSTMENT') adjustments += amt;
      }

      const netCash = cashSales + deposits - (expenses + withdrawals + refunds) + adjustments;
      const expectedCash = s.status === ShiftStatus.CLOSED ? s.expected_cash : s.opening_cash + netCash;

      // Card sales
      const cardSql = `
        SELECT COALESCE(SUM(amount), 0) AS card_total
        FROM payments
        WHERE shift_id = ? AND payment_method = 'CARD';
      `;
      const cardRes = await this.executor.query<{ card_total: number }>(cardSql, [s.id]);
      const cardSales = cardRes[0]?.card_total || 0;

      let variance: number | null = null;
      let varianceType: 'BALANCED' | 'SHORTAGE' | 'OVERAGE' | 'PENDING' = 'PENDING';

      if (s.status === ShiftStatus.CLOSED && s.actual_cash !== null) {
        variance = s.cash_difference !== null ? s.cash_difference : (s.actual_cash - expectedCash);
        if (variance === 0) varianceType = 'BALANCED';
        else if (variance < 0) varianceType = 'SHORTAGE';
        else varianceType = 'OVERAGE';
      }

      results.push({
        id: s.id,
        shiftNumber: s.shift_number,
        cashierName: s.cashier_name,
        openedAt: s.opened_at,
        closedAt: s.closed_at,
        openingCash: s.opening_cash,
        expectedCash,
        actualCash: s.actual_cash,
        variance,
        varianceType,
        status: s.status,
        totalSales: cashSales + cardSales,
        cashSales,
        cardSales,
      });
    }

    return results;
  }

  /**
   * 8. Cash Register Summary (Based strictly on Cash Transaction Ledger)
   */
  public async getCashRegisterSummary(filters: ReportDbFilters): Promise<CashRegisterSummaryDTO> {
    let where = ' WHERE created_at >= ? AND created_at <= ?';
    const params: unknown[] = [filters.startIso, filters.endIso];

    if (filters.userId && filters.userId !== 'ALL') {
      where += ' AND user_id = ?';
      params.push(filters.userId);
    }

    const sql = `
      SELECT transaction_type, COALESCE(SUM(amount), 0) AS total
      FROM cash_transactions
      ${where}
      GROUP BY transaction_type;
    `;

    const rows = await this.executor.query<{ transaction_type: string; total: number }>(sql, params);

    let cashSales = 0;
    let deposits = 0;
    let expenses = 0;
    let withdrawals = 0;
    let refunds = 0;
    let adjustments = 0;

    for (const r of rows) {
      const type = r.transaction_type;
      const amt = r.total || 0;
      if (type === 'SALE' || type === 'SALE_PAYMENT') cashSales += amt;
      else if (type === 'DEPOSIT' || type === 'CASH_IN') deposits += amt;
      else if (type === 'EXPENSE') expenses += amt;
      else if (type === 'WITHDRAWAL' || type === 'CASH_OUT') withdrawals += amt;
      else if (type === 'REFUND') refunds += amt;
      else if (type === 'ADJUSTMENT') adjustments += amt;
    }

    const totalCashIn = cashSales + deposits;
    const totalCashOut = expenses + withdrawals + refunds;
    const netCashMovement = totalCashIn - totalCashOut + adjustments;

    return {
      cashSales,
      deposits,
      totalCashIn,
      expenses,
      withdrawals,
      refunds,
      totalCashOut,
      adjustments,
      netCashMovement,
    };
  }

  /**
   * 9. Detailed Sales / Invoices Table
   */
  public async getDetailedSales(filters: ReportDbFilters, limit: number = 200): Promise<InvoiceListItemDTO[]> {
    const { clause, params } = this.buildOrderWhere(filters, 'o');

    const sql = `
      SELECT 
        inv.id,
        inv.invoice_number,
        inv.order_id,
        o.order_number,
        o.order_type,
        o.table_number,
        COALESCE(inv.customer_name_snapshot, c.name) AS customer_name,
        inv.cashier_name_snapshot AS cashier_name,
        inv.status,
        inv.total_amount,
        inv.tax_amount,
        inv.discount_amount,
        inv.net_amount - COALESCE((SELECT SUM(r.total_refund_amount) FROM returns r WHERE r.original_order_id = o.id), 0) AS net_amount,
        inv.printed_count,
        inv.created_at,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = inv.order_id) AS items_count,
        (SELECT GROUP_CONCAT(DISTINCT p.payment_method) FROM payments p WHERE p.order_id = inv.order_id) AS raw_payment_methods
      FROM invoices inv
      JOIN orders o ON inv.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ${clause}
      ORDER BY inv.created_at DESC
      LIMIT ?;
    `;

    const rows = await this.executor.query<
      InvoiceListItemDTO & { raw_payment_methods: string | null }
    >(sql, [...params, limit]);

    return rows.map((r) => ({
      ...r,
      payment_methods: r.raw_payment_methods
        ? (r.raw_payment_methods.split(',') as ('CASH' | 'CARD')[])
        : [],
    }));
  }
}
