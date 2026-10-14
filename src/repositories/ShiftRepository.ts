import { BaseRepository } from './BaseRepository';
import { CashShiftRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';
import { toLocalYmd } from '../utils/dateRanges';

export interface IShiftRepository {
  findById(id: string): Promise<CashShiftRow | null>;
  getRequiredById(id: string): Promise<CashShiftRow>;
  findActiveShift(userId?: string): Promise<CashShiftRow | null>;
  findByShiftNumber(shiftNumber: string): Promise<CashShiftRow | null>;
  listRecent(limit?: number): Promise<CashShiftRow[]>;
  listByUser(userId: string, limit?: number): Promise<CashShiftRow[]>;
  create(shift: CashShiftRow): Promise<CashShiftRow>;
  update(id: string, updates: Partial<CashShiftRow>): Promise<CashShiftRow>;
  closeShift(shiftId: string, actualCashMinor: number, notes?: string): Promise<CashShiftRow>;
  updateExpectedCash(shiftId: string, expectedCashMinor: number): Promise<void>;
  getNextShiftNumber(): Promise<string>;
}

export class ShiftRepository extends BaseRepository<CashShiftRow> implements IShiftRepository {
  constructor(executor?: ISqlExecutor) {
    super('cash_shifts', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new ShiftRepository(executor) as this;
  }

  public async findActiveShift(userId?: string): Promise<CashShiftRow | null> {
    if (userId) {
      return await this.executor.queryOne<CashShiftRow>(
        "SELECT * FROM cash_shifts WHERE user_id = ? AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;",
        [userId]
      );
    }
    return await this.executor.queryOne<CashShiftRow>(
      "SELECT * FROM cash_shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;"
    );
  }

  public async findByShiftNumber(shiftNumber: string): Promise<CashShiftRow | null> {
    return await this.executor.queryOne<CashShiftRow>(
      'SELECT * FROM cash_shifts WHERE shift_number = ?;',
      [shiftNumber]
    );
  }

  public async listRecent(limit: number = 30): Promise<CashShiftRow[]> {
    return await this.executor.query<CashShiftRow>(
      `SELECT * FROM cash_shifts ORDER BY opened_at DESC LIMIT ?;`,
      [limit]
    );
  }

  public async listByUser(userId: string, limit: number = 30): Promise<CashShiftRow[]> {
    return await this.executor.query<CashShiftRow>(
      `SELECT * FROM cash_shifts WHERE user_id = ? ORDER BY opened_at DESC LIMIT ?;`,
      [userId, limit]
    );
  }

  public async updateExpectedCash(shiftId: string, expectedCashMinor: number): Promise<void> {
    await this.executor.execute(
      'UPDATE cash_shifts SET expected_cash = ? WHERE id = ?;',
      [expectedCashMinor, shiftId]
    );
  }

  public async getNextShiftNumber(): Promise<string> {
    const todayStr = toLocalYmd(new Date()).replace(/-/g, '');
    const prefix = `SH-${todayStr}-`;
    const res = await this.executor.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM cash_shifts WHERE shift_number LIKE ?;`,
      [`${prefix}%`]
    );
    const nextSeq = (res?.count ?? 0) + 1;
    return `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  }

  public async closeShift(shiftId: string, actualCashMinor: number, notes?: string): Promise<CashShiftRow> {
    const shift = await this.getRequiredById(shiftId);
    const difference = actualCashMinor - shift.expected_cash;
    const now = new Date().toISOString();

    return await this.update(shiftId, {
      status: 'CLOSED',
      actual_cash: actualCashMinor,
      cash_difference: difference,
      closed_at: now,
      notes: notes || shift.notes,
    });
  }

  // Financial constraint: HARD DELETE of shifts is strictly forbidden!
  public override async delete(_id?: string): Promise<boolean> {
    throw new Error('قيد مالي صارم: لا يمكن حذف وردية كاشير وقيودها المالية نهائياً من قاعدة البيانات.');
  }
}
