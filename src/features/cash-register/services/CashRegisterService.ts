import { DatabaseManager } from '../../../database/DatabaseManager';
import { IShiftRepository, ShiftRepository } from '../../../repositories/ShiftRepository';
import { ICashTransactionRepository, CashTransactionRepository } from '../../../repositories/CashTransactionRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { IUserRepository, UserRepository } from '../../../repositories/UserRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requireAnyPermission } from '../../auth/utils/permissions';
import { CashTransactionRow, CashShiftRow } from '../../../domain/dbModels';
import { ShiftStatus, RoleCode } from '../../../domain/enums';
import { ValidationError, NotFoundError, ConflictError } from '../../../database/errors';
import { UnauthorizedError } from '../../auth/errors';
import {
  DepositCashDTO,
  WithdrawCashDTO,
  AdjustCashDTO,
  CashRegisterBalanceInfo,
  CashTransactionFilter,
} from '../types';
import { validateDepositInput, validateWithdrawInput, validateAdjustInput } from '../validation';
import { generateId } from '../../../utils/id';

export interface ICashRegisterService {
  deposit(user: AuthenticatedUser, input: DepositCashDTO): Promise<CashTransactionRow>;
  withdraw(user: AuthenticatedUser, input: WithdrawCashDTO): Promise<CashTransactionRow>;
  adjust(user: AuthenticatedUser, input: AdjustCashDTO): Promise<CashTransactionRow>;
  recordExpense(user: AuthenticatedUser, shiftId: string, amount: number, reason: string, expenseId?: string): Promise<CashTransactionRow>;
  getBalanceInfo(user: AuthenticatedUser, shiftId?: string): Promise<CashRegisterBalanceInfo>;
  listTransactions(user: AuthenticatedUser, filter?: CashTransactionFilter): Promise<CashTransactionRow[]>;
}

export class CashRegisterService implements ICashRegisterService {
  private dbManager: DatabaseManager;
  private shiftRepo: IShiftRepository;
  private cashTxRepo: ICashTransactionRepository;
  private auditRepo: IAuditLogRepository;
  private userRepo: IUserRepository;

  constructor(
    dbManager?: DatabaseManager,
    shiftRepo?: IShiftRepository,
    cashTxRepo?: ICashTransactionRepository,
    auditRepo?: IAuditLogRepository,
    userRepo?: IUserRepository
  ) {
    this.dbManager = dbManager || DatabaseManager.getInstance();
    this.shiftRepo = shiftRepo || new ShiftRepository();
    this.cashTxRepo = cashTxRepo || new CashTransactionRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
    this.userRepo = userRepo || new UserRepository();
  }

  /**
   * Records a cash deposit into the active shift drawer.
   */
  public async deposit(user: AuthenticatedUser, input: DepositCashDTO): Promise<CashTransactionRow> {
    requireAnyPermission(user, ['cash.deposit']);
    validateDepositInput(input);

    return await this.dbManager.transaction(async (tx) => {
      const txShiftRepo = new ShiftRepository(tx);
      const txCashTxRepo = new CashTransactionRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      const shift = input.shiftId
        ? await txShiftRepo.findById(input.shiftId)
        : await txShiftRepo.findActiveShift(user.id) || await txShiftRepo.findActiveShift();

      if (!shift) {
        throw new NotFoundError('لا توجد وردية مفتوحة لإجراء الإيداع النقدي.');
      }

      if (shift.status === ShiftStatus.CLOSED) {
        throw new ConflictError(`لا يمكن إجراء إيداع نقدي على وردية مغلقة (${shift.shift_number}).`);
      }

      const now = new Date().toISOString();
      const txRow: CashTransactionRow = {
        id: generateId('ctx'),
        shift_id: shift.id,
        transaction_type: 'DEPOSIT',
        amount: input.amount,
        reason: input.reason.trim(),
        reference_id: input.referenceId || null,
        user_id: user.id,
        created_at: now,
      };

      const created = await txCashTxRepo.create(txRow);

      // Audit Log
      await txAuditRepo.log(
        'CASH_DEPOSIT',
        'cash_transaction',
        created.id,
        user.id,
        {
          shiftId: shift.id,
          shiftNumber: shift.shift_number,
          amount: input.amount,
          reason: input.reason.trim(),
        }
      );

      // Recalculate and update shift expected cash
      const totals = await txCashTxRepo.calculateShiftCashTotals(shift.id);
      await txShiftRepo.updateExpectedCash(shift.id, shift.opening_cash + totals.netCash);

      return created;
    });
  }

  /**
   * Records a cash withdrawal from the active shift drawer.
   * Enforces cash overdraw protection (cannot withdraw more than available expected cash).
   */
  public async withdraw(user: AuthenticatedUser, input: WithdrawCashDTO): Promise<CashTransactionRow> {
    requireAnyPermission(user, ['cash.withdraw']);
    validateWithdrawInput(input);

    return await this.dbManager.transaction(async (tx) => {
      const txShiftRepo = new ShiftRepository(tx);
      const txCashTxRepo = new CashTransactionRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      const shift = input.shiftId
        ? await txShiftRepo.findById(input.shiftId)
        : await txShiftRepo.findActiveShift(user.id) || await txShiftRepo.findActiveShift();

      if (!shift) {
        throw new NotFoundError('لا توجد وردية مفتوحة لإجراء السحب النقدي.');
      }

      if (shift.status === ShiftStatus.CLOSED) {
        throw new ConflictError(`لا يمكن إجراء سحب نقدي من وردية مغلقة (${shift.shift_number}).`);
      }

      // Overdraw protection
      const totals = await txCashTxRepo.calculateShiftCashTotals(shift.id);
      const currentAvailable = shift.opening_cash + totals.netCash;

      if (input.amount > currentAvailable) {
        throw new ConflictError(
          `رصيد الدرج الحالي [${(currentAvailable / 100).toFixed(2)}] غير كافٍ لسحب مبلغ [${(input.amount / 100).toFixed(2)}].`
        );
      }

      const now = new Date().toISOString();
      const txRow: CashTransactionRow = {
        id: generateId('ctx'),
        shift_id: shift.id,
        transaction_type: 'WITHDRAWAL',
        amount: input.amount,
        reason: input.reason.trim(),
        reference_id: input.referenceId || null,
        user_id: user.id,
        created_at: now,
      };

      const created = await txCashTxRepo.create(txRow);

      // Audit Log
      await txAuditRepo.log(
        'CASH_WITHDRAWAL',
        'cash_transaction',
        created.id,
        user.id,
        {
          shiftId: shift.id,
          shiftNumber: shift.shift_number,
          amount: input.amount,
          reason: input.reason.trim(),
          remainingBalance: currentAvailable - input.amount,
        }
      );

      // Recalculate and update shift expected cash
      const updatedTotals = await txCashTxRepo.calculateShiftCashTotals(shift.id);
      await txShiftRepo.updateExpectedCash(shift.id, shift.opening_cash + updatedTotals.netCash);

      return created;
    });
  }

  /**
   * Records a manager cash adjustment (positive or negative).
   */
  public async adjust(user: AuthenticatedUser, input: AdjustCashDTO): Promise<CashTransactionRow> {
    requireAnyPermission(user, ['cash.adjust', 'shifts.view_all']);
    validateAdjustInput(input);

    return await this.dbManager.transaction(async (tx) => {
      const txShiftRepo = new ShiftRepository(tx);
      const txCashTxRepo = new CashTransactionRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      const shift = input.shiftId
        ? await txShiftRepo.findById(input.shiftId)
        : await txShiftRepo.findActiveShift(user.id) || await txShiftRepo.findActiveShift();

      if (!shift) {
        throw new NotFoundError('لا توجد وردية مفتوحة لإجراء التسوية النقدية.');
      }

      if (shift.status === ShiftStatus.CLOSED) {
        throw new ConflictError(`لا يمكن إجراء تسوية نقدية على وردية مغلقة (${shift.shift_number}).`);
      }

      const now = new Date().toISOString();
      const txRow: CashTransactionRow = {
        id: generateId('ctx'),
        shift_id: shift.id,
        transaction_type: 'ADJUSTMENT',
        amount: input.amount,
        reason: input.reason.trim(),
        reference_id: input.referenceId || null,
        user_id: user.id,
        created_at: now,
      };

      const created = await txCashTxRepo.create(txRow);

      // Audit Log
      await txAuditRepo.log(
        'CASH_ADJUSTMENT',
        'cash_transaction',
        created.id,
        user.id,
        {
          shiftId: shift.id,
          shiftNumber: shift.shift_number,
          amount: input.amount,
          reason: input.reason.trim(),
        }
      );

      // Recalculate and update shift expected cash
      const totals = await txCashTxRepo.calculateShiftCashTotals(shift.id);
      await txShiftRepo.updateExpectedCash(shift.id, shift.opening_cash + totals.netCash);

      return created;
    });
  }

  /**
   * Records a cash drawer expense directly into the ledger.
   */
  public async recordExpense(
    user: AuthenticatedUser,
    shiftId: string,
    amount: number,
    reason: string,
    expenseId?: string
  ): Promise<CashTransactionRow> {
    requireAnyPermission(user, ['expenses.create', 'cash.withdraw']);

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('مبلغ المصروف النقدي يجب أن يكون عدداً صحيحاً أكبر من صفر.');
    }

    return await this.dbManager.transaction(async (tx) => {
      const txShiftRepo = new ShiftRepository(tx);
      const txCashTxRepo = new CashTransactionRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      const shift = await txShiftRepo.findById(shiftId);
      if (!shift) throw new NotFoundError('الوردية المحددة غير موجودة.');
      if (shift.status === ShiftStatus.CLOSED) {
        throw new ConflictError('لا يمكن صرف مصروفات من درج وردية مغلقة.');
      }

      // Check drawer balance
      const totals = await txCashTxRepo.calculateShiftCashTotals(shift.id);
      const currentAvailable = shift.opening_cash + totals.netCash;
      if (amount > currentAvailable) {
        throw new ConflictError(
          `رصيد الدرج الحالي [${(currentAvailable / 100).toFixed(2)}] غير كافٍ لصرف مصروف بقيمة [${(amount / 100).toFixed(2)}].`
        );
      }

      const now = new Date().toISOString();
      const txRow: CashTransactionRow = {
        id: generateId('ctx'),
        shift_id: shift.id,
        transaction_type: 'EXPENSE',
        amount,
        reason: reason.trim(),
        reference_id: expenseId || null,
        user_id: user.id,
        created_at: now,
      };

      const created = await txCashTxRepo.create(txRow);

      await txAuditRepo.log(
        'EXPENSE_RECORDED',
        'cash_transaction',
        created.id,
        user.id,
        {
          shiftId: shift.id,
          amount,
          reason,
        }
      );

      const updatedTotals = await txCashTxRepo.calculateShiftCashTotals(shift.id);
      await txShiftRepo.updateExpectedCash(shift.id, shift.opening_cash + updatedTotals.netCash);

      return created;
    });
  }

  /**
   * Retrieves real-time register balance information.
   */
  public async getBalanceInfo(user: AuthenticatedUser, shiftId?: string): Promise<CashRegisterBalanceInfo> {
    requireAnyPermission(user, ['cash.view', 'cash.view_balance', 'shifts.view', 'shifts.open']);

    const shift = shiftId
      ? await this.shiftRepo.getRequiredById(shiftId)
      : await this.shiftRepo.findActiveShift(user.id) || await this.shiftRepo.findActiveShift();

    if (!shift) {
      throw new NotFoundError('لا توجد وردية نشطة حالياً.');
    }

    const cashier = await this.userRepo.findById(shift.user_id);
    const cashierName = cashier ? cashier.name : 'كاشير';

    const breakdown = await this.cashTxRepo.calculateShiftCashTotals(shift.id);
    const currentExpectedCash = shift.opening_cash + breakdown.netCash;

    return {
      shiftId: shift.id,
      shiftNumber: shift.shift_number,
      cashierName,
      openingCash: shift.opening_cash,
      cashSales: breakdown.cashSales,
      deposits: breakdown.deposits,
      expenses: breakdown.expenses,
      withdrawals: breakdown.withdrawals,
      refunds: breakdown.refunds,
      adjustments: breakdown.adjustments,
      currentExpectedCash,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Lists cash transactions with optional filters.
   */
  public async listTransactions(user: AuthenticatedUser, filter?: CashTransactionFilter): Promise<CashTransactionRow[]> {
    requireAnyPermission(user, ['cash.view', 'cash.view_balance', 'shifts.view', 'shifts.view_all']);

    if (filter?.shiftId) {
      return await this.cashTxRepo.listByShift(filter.shiftId);
    }
    return await this.cashTxRepo.listRecent(100);
  }
}
