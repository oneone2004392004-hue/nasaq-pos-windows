import { ISqlExecutor } from '../database/contracts';
import { BaseRepository } from './BaseRepository';
import { TableRow, OrderRow } from '../domain/dbModels';
import { ValidationError } from '../database/errors';

export class TableRepository extends BaseRepository<TableRow> {
  constructor(executor?: ISqlExecutor) {
    super('tables', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new TableRepository(executor) as this;
  }

  public async findByName(name: string): Promise<TableRow | null> {
    return await this.executor.queryOne<TableRow>(
      'SELECT * FROM tables WHERE name = ?;',
      [name.trim()]
    );
  }

  public async listAll(activeOnly = false): Promise<TableRow[]> {
    if (activeOnly) {
      return await this.executor.query<TableRow>(
        'SELECT * FROM tables WHERE is_active = 1 ORDER BY name ASC;'
      );
    }
    return await this.executor.query<TableRow>(
      'SELECT * FROM tables ORDER BY name ASC;'
    );
  }

  public async listAvailable(): Promise<TableRow[]> {
    return await this.executor.query<TableRow>(
      `SELECT t.* 
       FROM tables t
       WHERE t.is_active = 1 
         AND t.status = 'AVAILABLE'
         AND NOT EXISTS (
           SELECT 1 FROM orders o 
           WHERE (o.table_id = t.id OR o.table_number = t.name) 
             AND o.status IN ('PENDING', 'HOLD')
         )
       ORDER BY t.name ASC;`
    );
  }

  public async updateStatus(id: string, status: TableRow['status']): Promise<TableRow> {
    const now = new Date().toISOString();
    return await this.update(id, {
      status,
      updated_at: now,
    });
  }

  public async activate(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = await this.executor.run(
      'UPDATE tables SET is_active = 1, updated_at = ? WHERE id = ?;',
      [now, id]
    );
    return res.rowsAffected > 0;
  }

  public async getOccupyingOrder(tableIdOrName: string): Promise<OrderRow | null> {
    return await this.executor.queryOne<OrderRow>(
      `SELECT * FROM orders 
       WHERE (table_id = ? OR table_number = ?) 
         AND status IN ('PENDING', 'HOLD') 
       ORDER BY created_at DESC 
       LIMIT 1;`,
      [tableIdOrName, tableIdOrName]
    );
  }

  /**
   * Safe delete check: verifies if table is referenced in historical order records.
   * If references exist, hard delete is blocked and an error is thrown.
   */
  public async safeDelete(id: string): Promise<boolean> {
    const table = await this.findById(id);
    if (!table) return false;

    const countRes = await this.executor.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM orders WHERE table_id = ? OR table_number = ?;',
      [id, table.name]
    );

    if (countRes && countRes.count > 0) {
      throw new ValidationError(
        `لا يمكن حذف الطاولة (${table.name}) لوجود ${countRes.count} طلب مرتبط بها في السجلات التاريخية. يرجى تعطيلها بدلاً من الحذف.`
      );
    }

    return await this.delete(id);
  }
}
