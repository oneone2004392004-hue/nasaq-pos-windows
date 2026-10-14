import { BaseRepository } from './BaseRepository';
import { ExpenseRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IExpenseRepository {
  findById(id: string): Promise<ExpenseRow | null>;
  listByShift(shiftId: string): Promise<ExpenseRow[]>;
  getShiftExpensesTotal(shiftId: string): Promise<number>;
  create(expense: ExpenseRow): Promise<ExpenseRow>;
  listRecent(limit?: number): Promise<ExpenseRow[]>;
}

export class ExpenseRepository extends BaseRepository<ExpenseRow> implements IExpenseRepository {
  constructor(executor?: ISqlExecutor) {
    super('expenses', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new ExpenseRepository(executor) as this;
  }

  public async listByShift(shiftId: string): Promise<ExpenseRow[]> {
    return await this.executor.query<ExpenseRow>(
      'SELECT * FROM expenses WHERE shift_id = ? ORDER BY created_at DESC;',
      [shiftId]
    );
  }

  public async getShiftExpensesTotal(shiftId: string): Promise<number> {
    const res = await this.executor.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE shift_id = ?;',
      [shiftId]
    );
    return res?.total ?? 0;
  }

  public async listRecent(limit: number = 50): Promise<ExpenseRow[]> {
    return await this.executor.query<ExpenseRow>(
      'SELECT * FROM expenses ORDER BY created_at DESC LIMIT ?;',
      [limit]
    );
  }
}
