import { BaseRepository } from './BaseRepository';
import { PaymentRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IPaymentRepository {
  findById(id: string): Promise<PaymentRow | null>;
  listByOrderId(orderId: string): Promise<PaymentRow[]>;
  listByShiftId(shiftId: string): Promise<PaymentRow[]>;
  getShiftPaymentTotals(shiftId: string): Promise<{ cashTotal: number; cardTotal: number; total: number }>;
  create(payment: PaymentRow): Promise<PaymentRow>;
}

export class PaymentRepository extends BaseRepository<PaymentRow> implements IPaymentRepository {
  constructor(executor?: ISqlExecutor) {
    super('payments', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new PaymentRepository(executor) as this;
  }

  public async listByOrderId(orderId: string): Promise<PaymentRow[]> {
    return await this.executor.query<PaymentRow>(
      'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at ASC;',
      [orderId]
    );
  }

  public async listByShiftId(shiftId: string): Promise<PaymentRow[]> {
    return await this.executor.query<PaymentRow>(
      'SELECT * FROM payments WHERE shift_id = ? ORDER BY created_at DESC;',
      [shiftId]
    );
  }

  public async getShiftPaymentTotals(shiftId: string): Promise<{ cashTotal: number; cardTotal: number; total: number }> {
    const rows = await this.executor.query<{ payment_method: string; total: number }>(
      `SELECT payment_method, SUM(amount) AS total
       FROM payments
       WHERE shift_id = ?
       GROUP BY payment_method;`,
      [shiftId]
    );

    let cashTotal = 0;
    let cardTotal = 0;

    for (const r of rows) {
      if (r.payment_method === 'CASH') cashTotal += r.total;
      else if (r.payment_method === 'CARD') cardTotal += r.total;
    }

    return {
      cashTotal,
      cardTotal,
      total: cashTotal + cardTotal,
    };
  }

  // Financial constraint: HARD DELETE of payments is strictly forbidden!
  public override async delete(): Promise<boolean> {
    throw new Error('قيد مالي صارم: لا يمكن حذف سجل دفع مالي من قاعدة البيانات نهائياً. استخدم قيود التسوية أو المرتجعات.');
  }
}
