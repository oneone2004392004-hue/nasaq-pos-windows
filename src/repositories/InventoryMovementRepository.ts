import { BaseRepository } from './BaseRepository';
import { InventoryMovementRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IInventoryMovementRepository {
  findById(id: string): Promise<InventoryMovementRow | null>;
  listByProduct(productId: string): Promise<InventoryMovementRow[]>;
  create(movement: InventoryMovementRow): Promise<InventoryMovementRow>;
  listRecent(limit?: number): Promise<InventoryMovementRow[]>;
}

export class InventoryMovementRepository extends BaseRepository<InventoryMovementRow> implements IInventoryMovementRepository {
  constructor(executor?: ISqlExecutor) {
    super('inventory_movements', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new InventoryMovementRepository(executor) as this;
  }

  public async listByProduct(productId: string): Promise<InventoryMovementRow[]> {
    return await this.executor.query<InventoryMovementRow>(
      'SELECT * FROM inventory_movements WHERE product_id = ? ORDER BY created_at DESC;',
      [productId]
    );
  }

  public async listRecent(limit: number = 50): Promise<InventoryMovementRow[]> {
    return await this.executor.query<InventoryMovementRow>(
      'SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT ?;',
      [limit]
    );
  }
}
