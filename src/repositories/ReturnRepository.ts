import { BaseRepository } from './BaseRepository';
import { ReturnRow, ReturnItemRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IReturnRepository {
  findById(id: string): Promise<ReturnRow | null>;
  findByReturnNumber(returnNumber: string): Promise<ReturnRow | null>;
  listByOriginalOrder(orderId: string): Promise<ReturnRow[]>;
  listByShift(shiftId: string): Promise<ReturnRow[]>;
  getReturnItems(returnId: string): Promise<ReturnItemRow[]>;
  createReturnWithItems(returnOrder: ReturnRow, items: ReturnItemRow[]): Promise<ReturnRow>;
}

export class ReturnRepository extends BaseRepository<ReturnRow> implements IReturnRepository {
  constructor(executor?: ISqlExecutor) {
    super('returns', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new ReturnRepository(executor) as this;
  }

  public async findByReturnNumber(returnNumber: string): Promise<ReturnRow | null> {
    return await this.executor.queryOne<ReturnRow>(
      'SELECT * FROM returns WHERE return_number = ?;',
      [returnNumber]
    );
  }

  public async listByOriginalOrder(orderId: string): Promise<ReturnRow[]> {
    return await this.executor.query<ReturnRow>(
      'SELECT * FROM returns WHERE original_order_id = ? ORDER BY created_at DESC;',
      [orderId]
    );
  }

  public async listByShift(shiftId: string): Promise<ReturnRow[]> {
    return await this.executor.query<ReturnRow>(
      'SELECT * FROM returns WHERE shift_id = ? ORDER BY created_at DESC;',
      [shiftId]
    );
  }

  public async getReturnItems(returnId: string): Promise<ReturnItemRow[]> {
    return await this.executor.query<ReturnItemRow>(
      'SELECT * FROM return_items WHERE return_id = ?;',
      [returnId]
    );
  }

  public async createReturnWithItems(returnOrder: ReturnRow, items: ReturnItemRow[]): Promise<ReturnRow> {
    return await this.executor.transaction(async (tx) => {
      // Insert return header
      await tx.execute(
        `INSERT INTO returns (id, return_number, original_order_id, shift_id, refund_method, total_refund_amount, reason, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          returnOrder.id,
          returnOrder.return_number,
          returnOrder.original_order_id,
          returnOrder.shift_id,
          returnOrder.refund_method,
          returnOrder.total_refund_amount,
          returnOrder.reason,
          returnOrder.user_id,
          returnOrder.created_at,
        ]
      );

      // Insert return items
      for (const item of items) {
        await tx.execute(
          `INSERT INTO return_items (id, return_id, order_item_id, product_id, product_name_snapshot, unit_price, quantity, total, restock)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
          item.id,
          item.return_id,
          item.order_item_id || null,
          item.product_id,
            item.product_name_snapshot,
            item.unit_price,
            item.quantity,
            item.total,
            item.restock,
          ]
        );
      }

      return returnOrder;
    });
  }

  // Financial constraint: HARD DELETE of returns is strictly forbidden!
  public override async delete(): Promise<boolean> {
    throw new Error('قيد مالي صارم: لا يمكن حذف إشعار مرتجع مالي من قاعدة البيانات نهائياً.');
  }
}
