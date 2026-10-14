import { BaseRepository } from './BaseRepository';
import { InvoiceRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';
import { InvoiceFilter, InvoiceListItemDTO } from '../features/invoices/types';

export interface IInvoiceRepository {
  findById(id: string): Promise<InvoiceRow | null>;
  findByInvoiceNumber(invoiceNumber: string): Promise<InvoiceRow | null>;
  findByOrderId(orderId: string): Promise<InvoiceRow | null>;
  listByShift(shiftId: string): Promise<InvoiceRow[]>;
  listInvoices(filter?: InvoiceFilter): Promise<InvoiceListItemDTO[]>;
  getNextInvoiceNumber(): Promise<string>;
  create(invoice: InvoiceRow): Promise<InvoiceRow>;
  incrementPrintCount(invoiceId: string): Promise<void>;
  updateStatus(invoiceId: string, status: InvoiceRow['status']): Promise<InvoiceRow>;
}

export class InvoiceRepository extends BaseRepository<InvoiceRow> implements IInvoiceRepository {
  constructor(executor?: ISqlExecutor) {
    super('invoices', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new InvoiceRepository(executor) as this;
  }

  public async findByInvoiceNumber(invoiceNumber: string): Promise<InvoiceRow | null> {
    return await this.executor.queryOne<InvoiceRow>(
      'SELECT * FROM invoices WHERE invoice_number = ?;',
      [invoiceNumber]
    );
  }

  public async findByOrderId(orderId: string): Promise<InvoiceRow | null> {
    return await this.executor.queryOne<InvoiceRow>(
      'SELECT * FROM invoices WHERE order_id = ?;',
      [orderId]
    );
  }

  public async listByShift(shiftId: string): Promise<InvoiceRow[]> {
    return await this.executor.query<InvoiceRow>(
      'SELECT * FROM invoices WHERE shift_id = ? ORDER BY created_at DESC;',
      [shiftId]
    );
  }

  /** Generates a short sequential invoice number per local database. */
  public async getNextInvoiceNumber(): Promise<string> {
    const lastRow = await this.executor.queryOne<{ invoice_number: string }>(
      `SELECT invoice_number FROM invoices WHERE invoice_number GLOB '[0-9]*' ORDER BY CAST(invoice_number AS INTEGER) DESC LIMIT 1;`
    );
    const next = lastRow?.invoice_number && /^\d+$/.test(lastRow.invoice_number)
      ? Number(lastRow.invoice_number) + 1
      : 1;
    return String(next);
  }
  /**
   * Lists invoices with relational joins and rich filtering
   */
  public async listInvoices(filter?: InvoiceFilter): Promise<InvoiceListItemDTO[]> {
    let sql = `
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
        inv.net_amount,
        inv.printed_count,
        inv.created_at,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = inv.order_id) AS items_count,
        (SELECT GROUP_CONCAT(DISTINCT p.payment_method) FROM payments p WHERE p.order_id = inv.order_id) AS raw_payment_methods
      FROM invoices inv
      JOIN orders o ON inv.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;

    const params: unknown[] = [];

    if (filter?.status && filter.status !== 'ALL') {
      sql += ' AND inv.status = ?';
      params.push(filter.status);
    }

    if (filter?.shiftId) {
      sql += ' AND inv.shift_id = ?';
      params.push(filter.shiftId);
    }

    // Date Preset Filters
    if (filter?.datePreset && filter.datePreset !== 'ALL') {
      const now = new Date();
      if (filter.datePreset === 'TODAY') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        sql += ' AND inv.created_at >= ?';
        params.push(startOfToday);
      } else if (filter.datePreset === 'YESTERDAY') {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        sql += ' AND inv.created_at >= ? AND inv.created_at < ?';
        params.push(startOfYesterday, endOfYesterday);
      } else if (filter.datePreset === 'THIS_WEEK') {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).toISOString();
        sql += ' AND inv.created_at >= ?';
        params.push(startOfWeek);
      } else if (filter.datePreset === 'THIS_MONTH') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        sql += ' AND inv.created_at >= ?';
        params.push(startOfMonth);
      }
    }

    if (filter?.startDate) {
      sql += ' AND inv.created_at >= ?';
      params.push(filter.startDate);
    }

    if (filter?.endDate) {
      sql += ' AND inv.created_at <= ?';
      params.push(filter.endDate);
    }

    if (filter?.search && filter.search.trim()) {
      const rawSearch = filter.search.trim();
      if (/^\d+$/.test(rawSearch)) {
        // Short invoice numbers are exact identifiers; avoid matching order numbers that contain the same digit.
        sql += ' AND inv.invoice_number = ?';
        params.push(rawSearch);
      } else {
        const term = `%${rawSearch}%`;
        sql += ` AND (inv.invoice_number LIKE ? OR o.order_number LIKE ? OR o.table_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR inv.cashier_name_snapshot LIKE ?)`;
        params.push(term, term, term, term, term, term);
      }
    }

    sql += ' ORDER BY inv.created_at DESC;';

    interface RawInvoiceJoinRow {
      id: string;
      invoice_number: string;
      order_id: string;
      order_number: string;
      order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
      table_number: string | null;
      customer_name: string | null;
      cashier_name: string;
      status: 'PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
      total_amount: number;
      tax_amount: number;
      discount_amount: number;
      net_amount: number;
      printed_count: number;
      created_at: string;
      items_count: number;
      raw_payment_methods: string | null;
    }

    const rows = await this.executor.query<RawInvoiceJoinRow>(sql, params);

    // Map and filter by payment method if specified
    const results: InvoiceListItemDTO[] = [];
    for (const r of rows) {
      const paymentMethods = r.raw_payment_methods
        ? r.raw_payment_methods.split(',').filter(Boolean)
        : [];

      if (filter?.paymentMethod && filter.paymentMethod !== 'ALL') {
        if (filter.paymentMethod === 'SPLIT') {
          if (paymentMethods.length <= 1) continue;
        } else {
          if (!paymentMethods.includes(filter.paymentMethod)) continue;
        }
      }

      results.push({
        id: r.id,
        invoice_number: r.invoice_number,
        order_id: r.order_id,
        order_number: r.order_number,
        order_type: r.order_type,
        table_number: r.table_number,
        customer_name: r.customer_name,
        cashier_name: r.cashier_name,
        status: r.status,
        total_amount: r.total_amount,
        tax_amount: r.tax_amount,
        discount_amount: r.discount_amount,
        net_amount: r.net_amount,
        payment_methods: paymentMethods,
        items_count: r.items_count || 0,
        printed_count: r.printed_count || 0,
        created_at: r.created_at,
      });
    }

    return results;
  }

  public async incrementPrintCount(invoiceId: string): Promise<void> {
    await this.executor.execute(
      `UPDATE invoices
       SET printed_count = printed_count + 1, last_printed_at = ?
       WHERE id = ?;`,
      [new Date().toISOString(), invoiceId]
    );
  }

  public async updateStatus(invoiceId: string, status: InvoiceRow['status']): Promise<InvoiceRow> {
    return await this.update(invoiceId, { status });
  }

  // Financial constraint: HARD DELETE of invoices is strictly forbidden!
  public override async delete(_id?: string): Promise<boolean> {
    throw new Error('قيد مالي صارم: لا يمكن حذف فاتورة ضريبية أو مالية من قاعدة البيانات نهائياً. استخدم المرتجع المالي لإلغاء الأثر.');
  }
}
