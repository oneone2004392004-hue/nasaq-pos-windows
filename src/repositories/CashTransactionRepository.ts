import { BaseRepository } from './BaseRepository';
import { CashTransactionRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface ShiftCashBreakdown {
  inTotal: number;
  outTotal: number;
  netCash: number;
  cashSales: number;
  deposits: number;
  expenses: number;
  withdrawals: number;
  refunds: number;
  adjustments: number;
}

export interface ICashTransactionRepository {
  findById(id: string): Promise<CashTransactionRow | null>;
  listByShift(shiftId: string): Promise<CashTransactionRow[]>;
  listRecent(limit?: number): Promise<CashTransactionRow[]>;
  create(tx: CashTransactionRow): Promise<CashTransactionRow>;
  calculateShiftCashTotals(shiftId: string): Promise<ShiftCashBreakdown>;
}

export class CashTransactionRepository extends BaseRepository<CashTransactionRow> implements ICashTransactionRepository {
  constructor(executor?: ISqlExecutor) {
    super('cash_transactions', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new CashTransactionRepository(executor) as this;
  }

  public async listByShift(shiftId: string): Promise<CashTransactionRow[]> {
    return await this.executor.query<CashTransactionRow>(
      'SELECT * FROM cash_transactions WHERE shift_id = ? ORDER BY created_at DESC;',
      [shiftId]
    );
  }

  public async listRecent(limit: number = 100): Promise<CashTransactionRow[]> {
    return await this.executor.query<CashTransactionRow>(
      'SELECT * FROM cash_transactions ORDER BY created_at DESC LIMIT ?;',
      [limit]
    );
  }

  public async calculateShiftCashTotals(shiftId: string): Promise<ShiftCashBreakdown> {
    const rows = await this.executor.query<{ transaction_type: string; total: number }>(
      `SELECT transaction_type, SUM(amount) AS total
       FROM cash_transactions
       WHERE shift_id = ?
       GROUP BY transaction_type;`,
      [shiftId]
    );

    let cashSales = 0;
    let deposits = 0;
    let expenses = 0;
    let withdrawals = 0;
    let refunds = 0;
    let adjustments = 0;

    for (const r of rows) {
      const type = r.transaction_type;
      const amt = r.total || 0;
      if (type === 'SALE' || type === 'SALE_PAYMENT') {
        cashSales += amt;
      } else if (type === 'DEPOSIT' || type === 'CASH_IN') {
        deposits += amt;
      } else if (type === 'EXPENSE') {
        expenses += amt;
      } else if (type === 'WITHDRAWAL' || type === 'CASH_OUT') {
        withdrawals += amt;
      } else if (type === 'REFUND') {
        refunds += amt;
      } else if (type === 'ADJUSTMENT') {
        adjustments += amt;
      }
    }

    const inTotal = cashSales + deposits;
    const outTotal = expenses + withdrawals + refunds;
    const netCash = inTotal - outTotal + adjustments;

    return {
      inTotal,
      outTotal,
      netCash,
      cashSales,
      deposits,
      expenses,
      withdrawals,
      refunds,
      adjustments,
    };
  }

  // Financial constraint: HARD DELETE of cash ledger entries is strictly forbidden!
  public override async delete(_id?: string): Promise<boolean> {
    throw new Error('قيد مالي صارم: لا يمكن حذف حركة نقدية من سجل الخزينة والدرج نهائياً. استخدم قيود التسوية العكسية.');
  }
}
