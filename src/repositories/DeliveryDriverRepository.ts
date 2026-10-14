import { ISqlExecutor } from '../database/contracts';
import { BaseRepository } from './BaseRepository';
import { DeliveryDriverRow } from '../domain/dbModels';
import { ValidationError } from '../database/errors';

export class DeliveryDriverRepository extends BaseRepository<DeliveryDriverRow> {
  constructor(executor?: ISqlExecutor) {
    super('delivery_drivers', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new DeliveryDriverRepository(executor) as this;
  }

  public async findByPhone(phone: string): Promise<DeliveryDriverRow | null> {
    return await this.executor.queryOne<DeliveryDriverRow>(
      'SELECT * FROM delivery_drivers WHERE phone = ?;',
      [phone.trim()]
    );
  }

  public async listAll(activeOnly = false): Promise<DeliveryDriverRow[]> {
    if (activeOnly) {
      return await this.executor.query<DeliveryDriverRow>(
        'SELECT * FROM delivery_drivers WHERE is_active = 1 ORDER BY name ASC;'
      );
    }
    return await this.executor.query<DeliveryDriverRow>(
      'SELECT * FROM delivery_drivers ORDER BY name ASC;'
    );
  }

  public async activate(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = await this.executor.run(
      'UPDATE delivery_drivers SET is_active = 1, updated_at = ? WHERE id = ?;',
      [now, id]
    );
    return res.rowsAffected > 0;
  }

  public async getActiveOrdersCount(driverId: string): Promise<number> {
    const res = await this.executor.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE delivery_driver_id = ? 
         AND status IN ('PENDING', 'HOLD') 
         AND delivery_status NOT IN ('DELIVERED', 'CANCELLED');`,
      [driverId]
    );
    return res?.count || 0;
  }

  /**
   * Safe delete check: verifies if driver is referenced in historical order records.
   * If references exist, hard delete is blocked and an error is thrown.
   */
  public async safeDelete(id: string): Promise<boolean> {
    const driver = await this.findById(id);
    if (!driver) return false;

    const countRes = await this.executor.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM orders WHERE delivery_driver_id = ?;',
      [id]
    );

    if (countRes && countRes.count > 0) {
      throw new ValidationError(
        `لا يمكن حذف مندوب التوصيل (${driver.name}) لوجود ${countRes.count} طلب مرتبط به في السجلات. يمكنك تعطيل حسابه بدلاً من الحذف.`
      );
    }

    return await this.delete(id);
  }
}
