import { BaseRepository } from './BaseRepository';
import { OrderItemRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IOrderItemRepository {
  findById(id: string): Promise<OrderItemRow | null>;
  listByOrderId(orderId: string): Promise<OrderItemRow[]>;
  create(item: OrderItemRow): Promise<OrderItemRow>;
  addBatch(items: OrderItemRow[]): Promise<void>;
  deleteByOrderId(orderId: string): Promise<number>;
}

export class OrderItemRepository extends BaseRepository<OrderItemRow> implements IOrderItemRepository {
  constructor(executor?: ISqlExecutor) {
    super('order_items', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new OrderItemRepository(executor) as this;
  }

  public async listByOrderId(orderId: string): Promise<OrderItemRow[]> {
    return await this.executor.query<OrderItemRow>(
      'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC;',
      [orderId]
    );
  }

  public async addBatch(items: OrderItemRow[]): Promise<void> {
    for (const item of items) {
      await this.create(item);
    }
  }

  public async deleteByOrderId(orderId: string): Promise<number> {
    const res = await this.executor.run(
      'DELETE FROM order_items WHERE order_id = ?;',
      [orderId]
    );
    return res.rowsAffected;
  }
}
