import { DatabaseManager } from '../../../database/DatabaseManager';
import { IExpenseRepository, ExpenseRepository } from '../../../repositories/ExpenseRepository';
import { IShiftRepository, ShiftRepository } from '../../../repositories/ShiftRepository';
import { ICashTransactionRepository, CashTransactionRepository } from '../../../repositories/CashTransactionRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requireAnyPermission } from '../../auth/utils/permissions';
import { ExpenseRow, CashTransactionRow } from '../../../domain/dbModels';
import { ShiftStatus } from '../../../domain/enums';
import { ValidationError, NotFoundError, ConflictError } from '../../../database/errors';
import { generateId } from '../../../utils/id';

export interface CreateExpenseDTO {
  category: string;
  amount: number; // minor units > 0
  description: string;
  paidFromCashDrawer: boolean;
  shiftId?: string;
}

export interface IExpenseService {
  createExpense(user: AuthenticatedUser, input: CreateExpenseDTO): Promise<ExpenseRow>;
  listExpenses(user: AuthenticatedUser, limit?: number): Promise<ExpenseRow[]>;
  listByShift(shiftId: string): Promise<ExpenseRow[]>;
}

export class ExpenseService implements IExpenseService {
  private dbManager: DatabaseManager;
  private expenseRepo: IExpenseRepository;
  private shiftRepo: IShiftRepository;
  private cashTxRepo: ICashTransactionRepository;
  private auditRepo: IAuditLogRepository;

  constructor(
    dbManager?: DatabaseManager,
    expenseRepo?: IExpenseRepository,
    shiftRepo?: IShiftRepository,
    cashTxRepo?: ICashTransactionRepository,
    auditRepo?: IAuditLogRepository
  ) {
    this.dbManager = dbManager || DatabaseManager.getInstance();
    this.expenseRepo = expenseRepo || new ExpenseRepository();
    this.shiftRepo = shiftRepo || new ShiftRepository();
    this.cashTxRepo = cashTxRepo || new CashTransactionRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
  }

  public async createExpense(user: AuthenticatedUser, input: CreateExpenseDTO): Promise<ExpenseRow> {
    requireAnyPermission(user, ['expenses.create']);

    if (!input || typeof input !== 'object') {
      throw new ValidationError('بيانات المصروف غير صالحة.');
    }
    if (!input.category || input.category.trim().length === 0) {
      throw new ValidationError('بند أو تصنيف المصروف مطلوب.');
    }
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new ValidationError('قيمة المصروف يجب أن تكون عدداً صحيحاً بالوحدات الصغرى أكبر من صفر.');
    }
    if (!input.description || input.description.trim().length < 3) {
      throw new ValidationError('بيان وتفاصيل المصروف مطلوب ولا يقل عن 3 أحرف.');
    }

    return await this.dbManager.transaction(async (tx) => {
      const txExpenseRepo = new ExpenseRepository(tx);
      const txShiftRepo = new ShiftRepository(tx);
      const txCashTxRepo = new CashTransactionRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      let shiftId = input.shiftId || null;
      let shift = null;

      if (input.paidFromCashDrawer) {
        shift = shiftId
          ? await txShiftRepo.findById(shiftId)
          : await txShiftRepo.findActiveShift(user.id) || await txShiftRepo.findActiveShift();

        if (!shift) {
          throw new NotFoundError('لا توجد وردية مفتوحة لصرف المصروف من الدرج.');
        }
        if (shift.status === ShiftStatus.CLOSED) {
          throw new ConflictError(`لا يمكن صرف مصروف نقدي من وردية مغلقة (${shift.shift_number}).`);
        }

        shiftId = shift.id;

        // Check register balance
        const totals = await txCashTxRepo.calculateShiftCashTotals(shift.id);
        const currentAvailable = shift.opening_cash + totals.netCash;

        if (input.amount > currentAvailable) {
          throw new ConflictError(
            `رصيد الدرج الحالي [${(currentAvailable / 100).toFixed(2)}] غير كافٍ لصرف مصروف بقيمة [${(input.amount / 100).toFixed(2)}].`
          );
        }
      }

      const now = new Date().toISOString();
      const expenseId = generateId('exp');

      const expenseRow: ExpenseRow = {
        id: expenseId,
        shift_id: shiftId,
        category: input.category.trim(),
        amount: input.amount,
        description: input.description.trim(),
        paid_from_cash_drawer: input.paidFromCashDrawer ? 1 : 0,
        user_id: user.id,
        created_at: now,
      };

      const created = await txExpenseRepo.create(expenseRow);

      // If paid from cash drawer, record in cash_transactions and update expected cash
      if (input.paidFromCashDrawer && shift) {
        const cashTxRow: CashTransactionRow = {
          id: generateId('ctx'),
          shift_id: shift.id,
          transaction_type: 'EXPENSE',
          amount: input.amount,
          reason: `مصروف: ${input.category.trim()} - ${input.description.trim()}`,
          reference_id: created.id,
          user_id: user.id,
          created_at: now,
        };
        await txCashTxRepo.create(cashTxRow);

        const updatedTotals = await txCashTxRepo.calculateShiftCashTotals(shift.id);
        await txShiftRepo.updateExpectedCash(shift.id, shift.opening_cash + updatedTotals.netCash);
      }

      // Audit Log
      await txAuditRepo.log(
        'EXPENSE_CREATED',
        'expense',
        created.id,
        user.id,
        {
          category: created.category,
          amount: created.amount,
          paidFromCashDrawer: input.paidFromCashDrawer,
          shiftId,
        }
      );

      return created;
    });
  }

  public async listExpenses(user: AuthenticatedUser, limit: number = 50): Promise<ExpenseRow[]> {
    requireAnyPermission(user, ['expenses.view', 'cash.view', 'shifts.view_all']);
    return await this.expenseRepo.listRecent(limit);
  }

  public async listByShift(shiftId: string): Promise<ExpenseRow[]> {
    return await this.expenseRepo.listByShift(shiftId);
  }
}
