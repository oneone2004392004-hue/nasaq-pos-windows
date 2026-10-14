import { ISqlExecutor } from '../database/contracts';
import { DatabaseManager } from '../database/DatabaseManager';
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

export class ReportRepositoryCore {
  protected executor: ISqlExecutor;

  constructor(executor?: ISqlExecutor) {
    this.executor = executor || DatabaseManager.getInstance();
  }

  protected buildOrderWhere(filters: ReportDbFilters, tableAlias: string = 'o'): { clause: string; params: unknown[] } {
    let clause = ` WHERE ${tableAlias}.status = 'COMPLETED' AND ${tableAlias}.created_at >= ? AND ${tableAlias}.created_at <= ?`;
    const params: unknown[] = [filters.startIso, filters.endIso];

    if (filters.orderType && filters.orderType !== 'ALL') {
      clause += ` AND ${tableAlias}.order_type = ?`;
      params.push(filters.orderType);
    }

    if (filters.userId && filters.userId !== 'ALL') {
      clause += ` AND ${tableAlias}.user_id = ?`;
      params.push(filters.userId);
    }

    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      if (filters.paymentMethod === 'SPLIT') {
        clause += ` AND (SELECT COUNT(DISTINCT p.payment_method) FROM payments p WHERE p.order_id = ${tableAlias}.id) > 1`;
      } else {
        clause += ` AND (SELECT COUNT(DISTINCT p.payment_method) FROM payments p WHERE p.order_id = ${tableAlias}.id) = 1
                    AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id = ${tableAlias}.id AND p.payment_method = ?)`;
        params.push(filters.paymentMethod);
      }
    }

    return { clause, params };
  }

  /**
   * 1. Overall Sales Summary
   */
  public async getSalesSummary(filters: ReportDbFilters): Promise<SalesSummaryDTO> {
    const { clause, params } = this.buildOrderWhere(filters, 'o');

    // Query completed orders count and total sales
    const orderAggSql = `
      SELECT
        COUNT(o.id) AS completed_orders_count,
        COALESCE(SUM(o.total - COALESCE((SELECT SUM(r.total_refund_amount) FROM returns r WHERE r.original_order_id = o.id), 0)), 0) AS total_sales
      FROM orders o
      ${clause};
    `;

    const aggRows = await this.executor.query<{
      completed_orders_count: number;
      total_sales: number;
    }>(orderAggSql, params);

    const completedOrdersCount = aggRows[0]?.completed_orders_count || 0;
    const totalSales = aggRows[0]?.total_sales || 0;

    // Fast calculation of split payment orders using indexed join & GROUP BY
    const splitSql = `
      SELECT COUNT(*) as split_orders_count
      FROM (
        SELECT p.order_id
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        ${clause}
        GROUP BY p.order_id
        HAVING COUNT(DISTINCT p.payment_method) > 1
      );
    `;
    const splitRows = await this.executor.query<{ split_orders_count: number }>(splitSql, params);
    const splitOrdersCount = splitRows[0]?.split_orders_count || 0;
    const averageOrderValue = completedOrdersCount > 0 ? Math.round(totalSales / completedOrdersCount) : 0;

    // Query payment breakdown for cash vs card
    const paymentSql = `
      SELECT
        p.payment_method,
        COALESCE(SUM(p.amount - COALESCE((SELECT SUM(r.total_refund_amount) FROM returns r WHERE r.original_order_id = o.id AND r.refund_method = p.payment_method), 0)), 0) AS method_total
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      ${clause}
      GROUP BY p.payment_method;
    `;

    const paymentRows = await this.executor.query<{ payment_method: string; method_total: number }>(
      paymentSql,
      params
    );

    let cashSales = 0;
    let cardSales = 0;
    for (const row of paymentRows) {
      if (row.payment_method === 'CASH') cashSales = row.method_total;
      else if (row.payment_method === 'CARD') cardSales = row.method_total;
    }

    // Query expenses in the period
    let expenseSql = `
      SELECT COALESCE(SUM(amount), 0) AS total_expenses
      FROM expenses
      WHERE created_at >= ? AND created_at <= ?
    `;
    const expenseParams: unknown[] = [filters.startIso, filters.endIso];

    if (filters.userId && filters.userId !== 'ALL') {
      expenseSql += ' AND user_id = ?';
      expenseParams.push(filters.userId);
    }

    const expenseRows = await this.executor.query<{ total_expenses: number }>(expenseSql, expenseParams);
    const totalExpenses = expenseRows[0]?.total_expenses || 0;
    const netSales = totalSales - totalExpenses;

    return {
      totalSales,
      completedOrdersCount,
      averageOrderValue,
      cashSales,
      cardSales,
      splitOrdersCount,
      totalExpenses,
      netSales,
    };
  }

  /**
   * 2. Order Type Breakdown (Dine-In, Takeaway, Delivery)
   */
  public async getOrderTypeBreakdown(filters: ReportDbFilters): Promise<OrderTypeBreakdownDTO[]> {
    const { clause, params } = this.buildOrderWhere(filters, 'o');

    const sql = `
      SELECT
        o.order_type,
        COUNT(o.id) AS orders_count,
        COALESCE(SUM(o.total - COALESCE((SELECT SUM(r.total_refund_amount) FROM returns r WHERE r.original_order_id = o.id), 0)), 0) AS total_sales,
        COALESCE(ROUND(AVG(o.total)), 0) AS avg_order_value
      FROM orders o
      ${clause}
      GROUP BY o.order_type;
    `;

    const rows = await this.executor.query<{
      order_type: OrderType;
      orders_count: number;
      total_sales: number;
      avg_order_value: number;
    }>(sql, params);

    const labels: Record<OrderType, string> = {
      [OrderType.DINE_IN]: 'صالة (محلي)',
      [OrderType.TAKEAWAY]: 'سفري (تيك أواي)',
      [OrderType.DELIVERY]: 'توصيل (دليفري)',
    };

    const overallTotal = rows.reduce((acc, r) => acc + r.total_sales, 0);

    const allTypes = [OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY];
    return allTypes.map((type) => {
      const found = rows.find((r) => r.order_type === type);
      const totalSales = found?.total_sales || 0;
      const ordersCount = found?.orders_count || 0;
      const averageOrderValue = found?.avg_order_value || 0;
      const percentageOfTotal = overallTotal > 0 ? Math.round((totalSales / overallTotal) * 1000) / 10 : 0;

      return {
        orderType: type,
        orderTypeLabel: labels[type],
        ordersCount,
        totalSales,
        averageOrderValue,
        percentageOfTotal,
      };
    });
  }

  /**
   * 3. Payment Methods Breakdown
   */
  public async getPaymentBreakdown(filters: ReportDbFilters): Promise<PaymentBreakdownDTO[]> {
    const { clause, params } = this.buildOrderWhere(filters, 'o');

    const sql = `
      SELECT
        p.payment_method,
        COUNT(p.id) AS tx_count,
        COALESCE(SUM(p.amount), 0) AS total_amount
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      ${clause}
      GROUP BY p.payment_method;
    `;

    const rows = await this.executor.query<{
      payment_method: PaymentMethod;
      tx_count: number;
      total_amount: number;
    }>(sql, params);

    const overallAmount = rows.reduce((acc, r) => acc + r.total_amount, 0);

    const labels: Record<PaymentMethod, string> = {
      [PaymentMethod.CASH]: 'نقدي (كاش)',
      [PaymentMethod.CARD]: 'بطاقة بنكية / فيزا',
      [PaymentMethod.WALLET]: 'محفظة إلكترونية',
    };

    // Calculate split orders count
    const splitCountSql = `
      SELECT COUNT(DISTINCT o.id) AS split_count
      FROM orders o
      ${clause}
      AND (SELECT COUNT(DISTINCT p.payment_method) FROM payments p WHERE p.order_id = o.id) > 1;
    `;
    const splitRows = await this.executor.query<{ split_count: number }>(splitCountSql, params);
    const splitOrdersCount = splitRows[0]?.split_count || 0;

    const result: PaymentBreakdownDTO[] = [
      PaymentMethod.CASH,
      PaymentMethod.CARD,
    ].map((method) => {
      const found = rows.find((r) => r.payment_method === method);
      const totalAmount = found?.total_amount || 0;
      const transactionsCount = found?.tx_count || 0;
      const percentageOfTotal = overallAmount > 0 ? Math.round((totalAmount / overallAmount) * 1000) / 10 : 0;

      return {
        paymentMethod: method,
        methodLabel: labels[method],
        totalAmount,
        transactionsCount,
        percentageOfTotal,
      };
    });

    if (splitOrdersCount > 0) {
      result.push({
        paymentMethod: 'SPLIT',
        methodLabel: 'مدفوعات مجزأة (كاش + فيزا)',
        totalAmount: 0, // split is a composition of cash & card amounts
        transactionsCount: splitOrdersCount,
        percentageOfTotal: 0,
      });
    }

    return result;
  }

  /**
   * 4. Top Selling Products (Mandatory: using historical snapshot product_name_snapshot)
   */
  public async getTopProducts(
    filters: ReportDbFilters,
    sortBy: 'quantity' | 'sales' = 'quantity',
    limit: number = 20
  ): Promise<TopProductDTO[]> {
    const { clause, params } = this.buildOrderWhere(filters, 'o');

    const orderByClause = sortBy === 'sales' ? 'total_sales DESC, quantity_sold DESC' : 'quantity_sold DESC, total_sales DESC';

    const sql = `
      SELECT
        oi.product_name_snapshot AS product_name,
        COALESCE(SUM(oi.quantity), 0) AS quantity_sold,
        COALESCE(SUM(oi.total), 0) AS total_sales,
        COALESCE(ROUND(AVG(oi.unit_price)), 0) AS average_unit_price
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      ${clause}
      GROUP BY oi.product_name_snapshot
      ORDER BY ${orderByClause}
      LIMIT ?;
    `;

    const rows = await this.executor.query<{
      product_name: string;
      quantity_sold: number;
      total_sales: number;
      average_unit_price: number;
    }>(sql, [...params, limit]);

    return rows.map((row, index) => ({
      rank: index + 1,
      productName: row.product_name,
      quantitySold: row.quantity_sold,
      totalSales: row.total_sales,
      averageUnitPrice: row.average_unit_price,
    }));
  }

  /**
   * 5. Cashier Performance
   */
  public async getCashierPerformance(filters: ReportDbFilters): Promise<CashierPerformanceDTO[]> {
    const { clause, params } = this.buildOrderWhere(filters, 'o');

    const sql = `
      SELECT
        o.user_id,
        COALESCE(u.name, 'كاشير غير محدد') AS cashier_name,
        COUNT(o.id) AS orders_count,
        COALESCE(SUM(o.total), 0) AS total_sales,
        COALESCE(ROUND(AVG(o.total)), 0) AS avg_order_value,
        COALESCE(SUM(CASE WHEN o.order_type = 'DINE_IN' THEN o.total ELSE 0 END), 0) AS dine_in_sales,
        COALESCE(SUM(CASE WHEN o.order_type = 'TAKEAWAY' THEN o.total ELSE 0 END), 0) AS takeaway_sales,
        COALESCE(SUM(CASE WHEN o.order_type = 'DELIVERY' THEN o.total ELSE 0 END), 0) AS delivery_sales
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${clause}
      GROUP BY o.user_id
      ORDER BY total_sales DESC;
    `;

    const rows = await this.executor.query<{
      user_id: string;
      cashier_name: string;
      orders_count: number;
      total_sales: number;
      avg_order_value: number;
      dine_in_sales: number;
      takeaway_sales: number;
      delivery_sales: number;
    }>(sql, params);

    // For each cashier, get cash and card payment breakdown
    const results: CashierPerformanceDTO[] = [];

    for (const r of rows) {
      const pSql = `
        SELECT
          p.payment_method,
          COALESCE(SUM(p.amount), 0) AS total_amt
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        ${clause} AND o.user_id = ?
        GROUP BY p.payment_method;
      `;
      const pRows = await this.executor.query<{ payment_method: string; total_amt: number }>(pSql, [
        ...params,
        r.user_id,
      ]);

      let cashSales = 0;
      let cardSales = 0;
      for (const pr of pRows) {
        if (pr.payment_method === 'CASH') cashSales = pr.total_amt;
        else if (pr.payment_method === 'CARD') cardSales = pr.total_amt;
      }

      results.push({
        userId: r.user_id,
        cashierName: r.cashier_name,
        completedOrdersCount: r.orders_count,
        totalSales: r.total_sales,
        averageOrderValue: r.avg_order_value,
        cashSales,
        cardSales,
        dineInSales: r.dine_in_sales,
        takeawaySales: r.takeaway_sales,
        deliverySales: r.delivery_sales,
      });
    }

    return results;
  }

  /**
   * 6. Expenses Report
   */
}
