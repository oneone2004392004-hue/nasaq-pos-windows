import { BaseRepository } from './BaseRepository';
import { OrderRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';
import { OrderFilterParams, OrderListItemDTO } from '../features/orders/types';
import { shiftLocalYmd, toLocalDayRange, toLocalYmd } from '../utils/dateRanges';

export interface IOrderRepository {
  findById(id: string): Promise<OrderRow | null>;
  findByOrderNumber(orderNumber: string): Promise<OrderRow | null>;
  listByShift(shiftId: string): Promise<OrderRow[]>;
  listByStatus(status: OrderRow['status']): Promise<OrderRow[]>;
  listPendingDineInTables(): Promise<{ table_number: string; table_id?: string | null; order_id: string; total: number }[]>;
  findOccupiedTable(tableNumberOrId: string, excludeOrderId?: string): Promise<{ table_number: string; table_id?: string | null; order_id: string; total: number } | null>;
  listWithDetails(filters?: OrderFilterParams): Promise<OrderListItemDTO[]>;
  getOrderWithDetailsById(id: string): Promise<OrderListItemDTO | null>;
  getNextOrderNumber(): Promise<string>;
  create(order: OrderRow): Promise<OrderRow>;
  update(id: string, updates: Partial<OrderRow>): Promise<OrderRow>;
  updateStatus(id: string, status: OrderRow['status']): Promise<OrderRow>;
}

export class OrderRepository extends BaseRepository<OrderRow> implements IOrderRepository {
  constructor(executor?: ISqlExecutor) {
    super('orders', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new OrderRepository(executor) as this;
  }

  public async findByOrderNumber(orderNumber: string): Promise<OrderRow | null> {
    return await this.executor.queryOne<OrderRow>(
      'SELECT * FROM orders WHERE order_number = ?;',
      [orderNumber]
    );
  }

  public async listByShift(shiftId: string): Promise<OrderRow[]> {
    return await this.executor.query<OrderRow>(
      'SELECT * FROM orders WHERE shift_id = ? ORDER BY created_at DESC;',
      [shiftId]
    );
  }

  public async listByStatus(status: OrderRow['status']): Promise<OrderRow[]> {
    return await this.executor.query<OrderRow>(
      'SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC;',
      [status]
    );
  }

  public async listPendingDineInTables(): Promise<{ table_number: string; table_id?: string | null; order_id: string; total: number }[]> {
    return await this.executor.query<{ table_number: string; table_id?: string | null; order_id: string; total: number }>(
      `SELECT table_number, table_id, id AS order_id, total
       FROM orders
       WHERE order_type = 'DINE_IN' AND status IN ('PENDING', 'HOLD') AND (table_number IS NOT NULL OR table_id IS NOT NULL)
       ORDER BY table_number ASC;`
    );
  }

  public async findOccupiedTable(
    tableNumberOrId: string,
    excludeOrderId?: string
  ): Promise<{ table_number: string; table_id?: string | null; order_id: string; total: number } | null> {
    let sql = `SELECT table_number, table_id, id AS order_id, total
               FROM orders
               WHERE order_type = 'DINE_IN' AND status IN ('PENDING', 'HOLD') AND (table_number = ? OR table_id = ?)`;
    const params: unknown[] = [tableNumberOrId, tableNumberOrId];
    if (excludeOrderId) {
      sql += ' AND id != ?';
      params.push(excludeOrderId);
    }
    sql += ' LIMIT 1;';
    return await this.executor.queryOne<{ table_number: string; table_id?: string | null; order_id: string; total: number }>(sql, params);
  }

  public async getOrderWithDetailsById(id: string): Promise<OrderListItemDTO | null> {
    return await this.executor.queryOne<OrderListItemDTO>(
      `SELECT 
        o.*,
        COALESCE(u.name, 'غير محدد') AS cashier_name,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.address AS customer_address,
        dd.name AS delivery_driver_name,
        dd.phone AS delivery_driver_phone,
        COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id), 0) AS items_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN delivery_drivers dd ON o.delivery_driver_id = dd.id
      WHERE o.id = ?;`,
      [id]
    );
  }

  public async listWithDetails(filters: OrderFilterParams = {}): Promise<OrderListItemDTO[]> {
    let sql = `
      SELECT 
        o.*,
        COALESCE(u.name, 'غير محدد') AS cashier_name,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.address AS customer_address,
        dd.name AS delivery_driver_name,
        dd.phone AS delivery_driver_phone,
        COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id), 0) AS items_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN delivery_drivers dd ON o.delivery_driver_id = dd.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.status && filters.status !== 'ALL') {
      sql += ' AND o.status = ?';
      params.push(filters.status);
    }

    if (filters.orderType && filters.orderType !== 'ALL') {
      sql += ' AND o.order_type = ?';
      params.push(filters.orderType);
    }

    if (filters.userId && filters.userId !== 'ALL') {
      sql += ' AND o.user_id = ?';
      params.push(filters.userId);
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      sql += ' AND (o.order_number LIKE ? OR o.table_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR dd.name LIKE ?)';
      params.push(term, term, term, term, term);
    }

    // Deterministic date filtering using DB/reference time
    if (filters.datePreset && filters.datePreset !== 'ALL') {
      const refDate = filters.referenceDate || new Date().toISOString();
      const refYMD = toLocalYmd(refDate);

      if (filters.datePreset === 'TODAY') {
        const range = toLocalDayRange(refYMD);
        sql += ' AND o.created_at >= ? AND o.created_at <= ?';
        params.push(range.startIso, range.endIso);
      } else if (filters.datePreset === 'YESTERDAY') {
        const range = toLocalDayRange(shiftLocalYmd(refYMD, -1));
        sql += ' AND o.created_at >= ? AND o.created_at <= ?';
        params.push(range.startIso, range.endIso);
      } else if (filters.datePreset === 'THIS_WEEK') {
        const start = toLocalDayRange(shiftLocalYmd(refYMD, -6));
        const end = toLocalDayRange(refYMD);
        sql += ' AND o.created_at >= ? AND o.created_at <= ?';
        params.push(start.startIso, end.endIso);
      } else if (filters.datePreset === 'CUSTOM' && filters.customDate) {
        const range = toLocalDayRange(filters.customDate);
        sql += ' AND o.created_at >= ? AND o.created_at <= ?';
        params.push(range.startIso, range.endIso);
      }
    }

    sql += ' ORDER BY o.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    return await this.executor.query<OrderListItemDTO>(sql, params);
  }

  public async getNextOrderNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;
    const pattern = `ORD-${datePrefix}-%`;

    const lastRow = await this.executor.queryOne<{ order_number: string }>(
      'SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1;',
      [pattern]
    );

    let nextSequence = 1;
    if (lastRow && lastRow.order_number) {
      const parts = lastRow.order_number.split('-');
      if (parts.length === 3) {
        const parsedSeq = parseInt(parts[2], 10);
        if (!isNaN(parsedSeq) && parsedSeq >= 1) {
          nextSequence = parsedSeq + 1;
        }
      }
    }

    return `ORD-${datePrefix}-${String(nextSequence).padStart(4, '0')}`;
  }

  public async updateStatus(id: string, status: OrderRow['status']): Promise<OrderRow> {
    return await this.update(id, {
      status,
      updated_at: new Date().toISOString(),
    });
  }

  // Financial constraint: HARD DELETE of completed orders is strictly forbidden!
  public override async delete(id: string): Promise<boolean> {
    const order = await this.findById(id);
    if (!order) return false;
    if (order.status === 'COMPLETED') {
      throw new Error('قيد مالي صارم: لا يمكن حذف طلب مكتمل من قاعدة البيانات نهائياً. استخدم المرتجع أو الإلغاء الإداري.');
    }
    return super.delete(id);
  }
}
