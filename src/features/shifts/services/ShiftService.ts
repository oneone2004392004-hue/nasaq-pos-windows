import { DatabaseManager } from '../../../database/DatabaseManager';
import { IShiftRepository, ShiftRepository } from '../../../repositories/ShiftRepository';
import { ICashTransactionRepository, CashTransactionRepository } from '../../../repositories/CashTransactionRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { IUserRepository, UserRepository } from '../../../repositories/UserRepository';
import { IOrderRepository, OrderRepository } from '../../../repositories/OrderRepository';
import { IPaymentRepository, PaymentRepository } from '../../../repositories/PaymentRepository';
import { IInvoiceRepository, InvoiceRepository } from '../../../repositories/InvoiceRepository';
import { ProductRepository } from '../../../repositories/ProductRepository';
import { InventoryMovementRepository } from '../../../repositories/InventoryMovementRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requireAnyPermission } from '../../auth/utils/permissions';
import { CashShiftRow } from '../../../domain/dbModels';
import { ShiftStatus, RoleCode } from '../../../domain/enums';
import { ValidationError, NotFoundError, ConflictError } from '../../../database/errors';
import { UnauthorizedError } from '../../auth/errors';
import { OpenShiftDTO, CloseShiftDTO, ShiftSummary } from '../types';
import { validateOpenShiftInput, validateCloseShiftInput } from '../validation';
import { generateId } from '../../../utils/id';

export interface PendingShiftOrder {
  id: string;
  order_number: string;
  order_type: string;
  table_number: string | null;
  total: number;
}

export interface IShiftService {
  openShift(user: AuthenticatedUser, input: OpenShiftDTO): Promise<CashShiftRow>;
  closeShift(user: AuthenticatedUser, input: CloseShiftDTO): Promise<CashShiftRow>;
  listPendingOrdersForShift(user: AuthenticatedUser, shiftId: string): Promise<PendingShiftOrder[]>;
  getActiveShift(userId?: string): Promise<CashShiftRow | null>;
  calculateExpectedCash(shiftId: string): Promise<number>;
  getShiftSummary(user: AuthenticatedUser, shiftId: string): Promise<ShiftSummary>;
  listShifts(user: AuthenticatedUser, limit?: number): Promise<CashShiftRow[]>;
}

export class ShiftService implements IShiftService {
  private dbManager: DatabaseManager;
  private shiftRepo: IShiftRepository;
  private cashTxRepo: ICashTransactionRepository;
  private auditRepo: IAuditLogRepository;
  private userRepo: IUserRepository;
  private orderRepo: IOrderRepository;
  private paymentRepo: IPaymentRepository;
  private invoiceRepo: IInvoiceRepository;

  constructor(
    dbManager?: DatabaseManager,
    shiftRepo?: IShiftRepository,
    cashTxRepo?: ICashTransactionRepository,
    auditRepo?: IAuditLogRepository,
    userRepo?: IUserRepository,
    orderRepo?: IOrderRepository,
    paymentRepo?: IPaymentRepository,
    invoiceRepo?: IInvoiceRepository
  ) {
    this.dbManager = dbManager || DatabaseManager.getInstance();
    this.shiftRepo = shiftRepo || new ShiftRepository();
    this.cashTxRepo = cashTxRepo || new CashTransactionRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
    this.userRepo = userRepo || new UserRepository();
    this.orderRepo = orderRepo || new OrderRepository();
    this.paymentRepo = paymentRepo || new PaymentRepository();
    this.invoiceRepo = invoiceRepo || new InvoiceRepository();
  }

  /**
   * Opens a new cash register shift for an authenticated cashier.
   * Enforces:
   * 1. RBAC permission (shifts.open)
   * 2. Integer minor units for opening cash
   * 3. Single active shift per cashier isolation
   * 4. Sequential collision-safe shift numbering
   * 5. Audit log tracking
   */
  public async openShift(user: AuthenticatedUser, input: OpenShiftDTO): Promise<CashShiftRow> {
    requireAnyPermission(user, ['shifts.open']);
    validateOpenShiftInput(input);

    return await this.dbManager.transaction(async (tx) => {
      const txShiftRepo = new ShiftRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      // Check if user already has an active OPEN shift
      const existing = await txShiftRepo.findActiveShift(user.id);
      if (existing) {
        throw new ConflictError(
          `يوجد بالفعل وردية مفتوحة للكاشير (${user.name}) برقم [${existing.shift_number}]. يجب إغلاقها أولاً.`
        );
      }

      const shiftNumber = await txShiftRepo.getNextShiftNumber();
      const shiftId = generateId('shift');
      const now = new Date().toISOString();

      const newShift: CashShiftRow = {
        id: shiftId,
        shift_number: shiftNumber,
        user_id: user.id,
        opened_at: now,
        closed_at: null,
        opening_cash: input.openingCash,
        expected_cash: input.openingCash,
        actual_cash: null,
        cash_difference: null,
        status: ShiftStatus.OPEN,
        notes: input.notes ? input.notes.trim() : null,
      };

      const createdShift = await txShiftRepo.create(newShift);

      // Log financial audit trail
      await txAuditRepo.log(
        'SHIFT_OPENED',
        'cash_shift',
        createdShift.id,
        user.id,
        {
          shiftNumber: createdShift.shift_number,
          openingCash: input.openingCash,
          openedAt: now,
        }
      );

      return createdShift;
    });
  }

  /**
   * Closes an active shift with exact cash count.
   * Enforces:
   * 1. RBAC permission (shifts.close)
   * 2. Cashier ownership check or managerial override (shifts.view_all / admin / manager)
   * 3. Atomic transaction
   * 4. Trusted server-side calculation of expected cash from ledger
   * 5. Variance calculation: actual_cash - expected_cash
   * 6. Audit logging for closure and variance tracking
   */
  public async closeShift(user: AuthenticatedUser, input: CloseShiftDTO): Promise<CashShiftRow> {
    requireAnyPermission(user, ['shifts.close']);
    validateCloseShiftInput(input);

    return await this.dbManager.transaction(async (tx) => {
      const txShiftRepo = new ShiftRepository(tx);
      const txCashTxRepo = new CashTransactionRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);

      const shift = await txShiftRepo.findById(input.shiftId);
      if (!shift) {
        throw new NotFoundError('وردية الكاشير غير موجودة.');
      }

      if (shift.status === ShiftStatus.CLOSED) {
        throw new ConflictError(`الوردية (${shift.shift_number}) مغلقة بالفعل.`);
      }

      // Cashier isolation: Cashier can only close their own shift, unless Manager/Admin
      const isOwner = shift.user_id === user.id;
      const canManageAll =
        user.permissions.includes('shifts.view_all') ||
        user.roleCode === RoleCode.ADMIN ||
        user.roleCode === RoleCode.MANAGER;

      if (!isOwner && !canManageAll) {
        throw new UnauthorizedError('غير مصرح لك بإغلاق وردية كاشير آخر.');
      }

      const pendingOrders = await tx.query<PendingShiftOrder>(
        `SELECT id, order_number, order_type, table_number, total FROM orders
         WHERE shift_id = ? AND status IN ('PENDING', 'HOLD') ORDER BY order_number;`,
        [shift.id]
      );
      if (pendingOrders.length && input.confirmPendingOrders !== true) {
        const details = pendingOrders.map((order) =>
          `${order.order_number} (${order.order_type})، الطاولة: ${order.table_number || '—'}، الإجمالي: ${order.total} قرش`
        ).join('؛ ');
        throw new ConflictError(`توجد طلبات معلقة تمنع إغلاق الوردية: ${details}. ألغها أو أكد إلغاءها كمدير.`);
      }
      if (pendingOrders.length && input.confirmPendingOrders === true) {
        requireAnyPermission(user, ['shifts.view_all', 'orders.manage'], txAuditRepo);
        const txProducts = new ProductRepository(tx);
        const txMovements = new InventoryMovementRepository(tx);
        const cancelledAt = new Date().toISOString();
        for (const order of pendingOrders) {
          await tx.execute(
            `UPDATE orders SET status = 'CANCELLED', delivery_status = CASE WHEN order_type = 'DELIVERY' THEN 'CANCELLED' ELSE delivery_status END, updated_at = ?
             WHERE id = ? AND status IN ('PENDING', 'HOLD');`,
            [cancelledAt, order.id]
          );
          const saleMovements = await tx.query<{ id: string; product_id: string; quantity: number; user_id: string }>(
            `SELECT id, product_id, quantity, user_id FROM inventory_movements
             WHERE reference_type = 'ORDER' AND reference_id = ? AND movement_type = 'SALE';`,
            [order.id]
          );
          for (const movement of saleMovements) {
            const reversed = await tx.queryOne<{ id: string }>(
              `SELECT id FROM inventory_movements WHERE reference_type = 'RETURN' AND reference_id = ? LIMIT 1;`,
              [movement.id]
            );
            if (reversed) continue;
            await txProducts.updateStock(movement.product_id, movement.quantity);
            await txMovements.create({
              id: generateId('mov'), product_id: movement.product_id, movement_type: 'RETURN',
              quantity: movement.quantity, reference_type: 'RETURN', reference_id: movement.id,
              notes: `تحرير مخزون الطلب الملغى ${order.order_number} عند إغلاق الوردية`,
              user_id: user.id || movement.user_id, created_at: cancelledAt,
            });
          }
          await txAuditRepo.log('ORDER_CANCELLED', 'order', order.id, user.id, {
            order_number: order.order_number, order_type: order.order_type,
            table_number: order.table_number, total_minor: order.total,
            reason: 'إلغاء تلقائي بسبب إغلاق الوردية',
          });
        }
        await tx.execute(
          `UPDATE tables SET status = 'AVAILABLE', updated_at = ?
           WHERE status = 'OCCUPIED' AND id IN (
             SELECT DISTINCT t.id FROM tables t JOIN orders o ON (o.table_id = t.id OR o.table_number = t.name)
             WHERE o.shift_id = ? AND o.status = 'CANCELLED'
           ) AND NOT EXISTS (
             SELECT 1 FROM orders active WHERE (active.table_id = tables.id OR active.table_number = tables.name)
               AND active.status IN ('PENDING', 'HOLD')
           );`,
          [cancelledAt, shift.id]
        );
        await txAuditRepo.log('SHIFT_PENDING_ORDERS_CANCELLED', 'cash_shift', shift.id, user.id, {
          order_numbers: pendingOrders.map((order) => order.order_number),
          order_ids: pendingOrders.map((order) => order.id),
        });
      }

      // 1. Calculate trusted expected cash from ledger transactions
      const totals = await txCashTxRepo.calculateShiftCashTotals(shift.id);
      const expectedCash = shift.opening_cash + totals.netCash;

      // 2. Calculate variance
      const actualCash = input.actualCash;
      const cashDifference = actualCash - expectedCash;
      const now = new Date().toISOString();

      // 3. Update shift to CLOSED
      const updatedShift = await txShiftRepo.update(shift.id, {
        status: ShiftStatus.CLOSED,
        expected_cash: expectedCash,
        actual_cash: actualCash,
        cash_difference: cashDifference,
        closed_at: now,
        notes: input.notes
          ? shift.notes
            ? `${shift.notes} | ${input.notes.trim()}`
            : input.notes.trim()
          : shift.notes,
      });

      // 4. Audit Log for shift closure
      await txAuditRepo.log(
        'SHIFT_CLOSED',
        'cash_shift',
        updatedShift.id,
        user.id,
        {
          shiftNumber: updatedShift.shift_number,
          expectedCash,
          actualCash,
          cashDifference,
          closedAt: now,
        }
      );

      // 5. Special Audit Log for variance for shortages or overages
      if (cashDifference !== 0) {
        await txAuditRepo.log(
          'SHIFT_CLOSE_VARIANCE',
          'cash_shift',
          updatedShift.id,
          user.id,
          {
            shiftNumber: updatedShift.shift_number,
            varianceType: cashDifference < 0 ? 'SHORTAGE' : 'OVERAGE',
            difference: cashDifference,
            expectedCash,
            actualCash,
          }
        );
      }

      return updatedShift;
    });
  }

  /**
   * Retrieves current active shift for a given user or system-wide.
   */
  public async listPendingOrdersForShift(user: AuthenticatedUser, shiftId: string): Promise<PendingShiftOrder[]> {
    requireAnyPermission(user, ['shifts.close', 'shifts.view_all', 'orders.view'], this.auditRepo);
    const shift = await this.shiftRepo.getRequiredById(shiftId);
    const canViewAll = user.permissions.includes('shifts.view_all') || user.roleCode === RoleCode.ADMIN || user.roleCode === RoleCode.MANAGER;
    if (shift.user_id !== user.id && !canViewAll) throw new UnauthorizedError('غير مصرح لك بعرض طلبات وردية كاشير آخر.');
    return this.dbManager.query<PendingShiftOrder>(
      `SELECT id, order_number, order_type, table_number, total FROM orders
       WHERE shift_id = ? AND status IN ('PENDING', 'HOLD') ORDER BY order_number;`,
      [shiftId]
    );
  }

  public async getActiveShift(userId?: string): Promise<CashShiftRow | null> {
    return await this.shiftRepo.findActiveShift(userId);
  }

  /**
   * Calculates live expected cash in register for a given shift.
   */
  public async calculateExpectedCash(shiftId: string): Promise<number> {
    const shift = await this.shiftRepo.getRequiredById(shiftId);
    const totals = await this.cashTxRepo.calculateShiftCashTotals(shiftId);
    return shift.opening_cash + totals.netCash;
  }

  /**
   * Retrieves comprehensive financial summary for a shift.
   */
  public async getShiftSummary(user: AuthenticatedUser, shiftId: string): Promise<ShiftSummary> {
    requireAnyPermission(user, ['shifts.view', 'shifts.view_all', 'shifts.open', 'shifts.close', 'cash.view', 'cash.view_balance']);

    const shift = await this.shiftRepo.getRequiredById(shiftId);

    // Enforce cashier isolation if viewing details of another cashier's shift
    const isOwner = shift.user_id === user.id;
    const canViewAll =
      user.permissions.includes('shifts.view_all') ||
      user.roleCode === RoleCode.ADMIN ||
      user.roleCode === RoleCode.MANAGER;

    if (!isOwner && !canViewAll) {
      throw new UnauthorizedError('غير مصرح لك بعرض تفاصيل وردية كاشير آخر.');
    }

    const cashier = await this.userRepo.findById(shift.user_id);
    const cashierName = cashier ? cashier.name : 'كاشير غير محدد';

    const breakdown = await this.cashTxRepo.calculateShiftCashTotals(shift.id);
    const expectedCash = shift.opening_cash + breakdown.netCash;

    // Calculate duration in minutes
    const startTime = new Date(shift.opened_at).getTime();
    const endTime = shift.closed_at ? new Date(shift.closed_at).getTime() : Date.now();
    const durationMinutes = Math.max(0, Math.floor((endTime - startTime) / (1000 * 60)));

    // Calculate non-cash sales (CARD)
    const cardPayments = await this.dbManager.query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE shift_id = ? AND payment_method = 'CARD';`,
      [shift.id]
    );
    const cardSales = cardPayments[0]?.total || 0;

    // Query invoices and orders count
    const invoiceCountRes = await this.dbManager.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM invoices WHERE shift_id = ?;`,
      [shift.id]
    );
    const invoicesCount = invoiceCountRes[0]?.count || 0;

    const orderCountRes = await this.dbManager.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM orders WHERE shift_id = ?;`,
      [shift.id]
    );
    const ordersCount = orderCountRes[0]?.count || 0;

    let variance: number | null = null;
    let varianceType: 'BALANCED' | 'SHORTAGE' | 'OVERAGE' | 'PENDING' = 'PENDING';

    if (shift.status === ShiftStatus.CLOSED && shift.actual_cash !== null) {
      variance = shift.cash_difference !== null ? shift.cash_difference : (shift.actual_cash - expectedCash);
      if (variance === 0) varianceType = 'BALANCED';
      else if (variance < 0) varianceType = 'SHORTAGE';
      else varianceType = 'OVERAGE';
    }

    return {
      shift,
      cashierName,
      durationMinutes,
      openingCash: shift.opening_cash,
      cashSales: breakdown.cashSales,
      cardSales,
      totalSales: breakdown.cashSales + cardSales,
      invoicesCount,
      ordersCount,
      cashExpenses: breakdown.expenses,
      deposits: breakdown.deposits,
      withdrawals: breakdown.withdrawals,
      refunds: breakdown.refunds,
      adjustments: breakdown.adjustments,
      expectedCash: shift.status === ShiftStatus.CLOSED ? shift.expected_cash : expectedCash,
      actualCash: shift.actual_cash,
      variance,
      varianceType,
      status: shift.status === 'OPEN' ? ShiftStatus.OPEN : ShiftStatus.CLOSED,
    };
  }

  /**
   * Lists shifts according to user role and permissions.
   */
  public async listShifts(user: AuthenticatedUser, limit: number = 30): Promise<CashShiftRow[]> {
    requireAnyPermission(user, ['shifts.view', 'shifts.view_all', 'shifts.open', 'shifts.close']);

    const canViewAll =
      user.permissions.includes('shifts.view_all') ||
      user.roleCode === RoleCode.ADMIN ||
      user.roleCode === RoleCode.MANAGER;

    if (canViewAll) {
      return await this.shiftRepo.listRecent(limit);
    }
    return await this.shiftRepo.listByUser(user.id, limit);
  }
}
