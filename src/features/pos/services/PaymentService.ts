import { DatabaseManager } from '../../../database/DatabaseManager';
import { validatePaymentAmounts } from './PaymentValidator';
import { ISqlExecutor } from '../../../database/contracts';
import { CreateOrderDraftDTO } from '../../orders/validation';
import { OrderService } from '../../orders/services/OrderService';
import { SettingsRepository } from '../../../repositories/SettingsRepository';
import { IOrderRepository, OrderRepository } from '../../../repositories/OrderRepository';
import { IOrderItemRepository, OrderItemRepository } from '../../../repositories/OrderItemRepository';
import { IPaymentRepository, PaymentRepository } from '../../../repositories/PaymentRepository';
import { IInvoiceRepository, InvoiceRepository } from '../../../repositories/InvoiceRepository';
import { IShiftRepository, ShiftRepository } from '../../../repositories/ShiftRepository';
import { ICashTransactionRepository, CashTransactionRepository } from '../../../repositories/CashTransactionRepository';
import { ICustomerRepository, CustomerRepository } from '../../../repositories/CustomerRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { ProductRepository } from '../../../repositories/ProductRepository';
import { InventoryMovementRepository } from '../../../repositories/InventoryMovementRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requireAnyPermission } from '../../auth/utils/permissions';
import { OrderRow, OrderItemRow, InvoiceRow, PaymentRow, CashTransactionRow } from '../../../domain/dbModels';
import { ValidationError, NotFoundError, ConflictError } from '../../../database/errors';
import { generateId } from '../../../utils/id';

export interface PaymentItemInput {
  method: 'CASH' | 'CARD';
  amount: number;       // Revenue portion (minor units)
  tenderAmount: number; // Given tender (minor units)
  referenceNumber?: string | null;
}

export interface CompleteSaleInput {
  orderId: string;
  payments: PaymentItemInput[];
}

export interface CompleteSaleResult {
  order: OrderRow;
  items: OrderItemRow[];
  invoice: InvoiceRow;
  payments: PaymentRow[];
  changeAmount: number; // Total change returned in minor units
}

export interface IPaymentService {
  validatePayment(totalMinor: number, payments: PaymentItemInput[]): {
    isValid: boolean;
    error?: string;
    totalPaid: number;
    remaining: number;
    change: number;
  };
  completeSale(user: AuthenticatedUser, input: CompleteSaleInput, executor?: ISqlExecutor): Promise<CompleteSaleResult>;
  createAndPayOrder(user: AuthenticatedUser, orderService: OrderService, data: CreateOrderDraftDTO, payments: PaymentItemInput[]): Promise<CompleteSaleResult>;
  getPaymentsByOrder(orderId: string): Promise<PaymentRow[]>;
}

export class PaymentService implements IPaymentService {
  private dbManager: DatabaseManager;
  private orderRepo: IOrderRepository;
  private orderItemRepo: IOrderItemRepository;
  private paymentRepo: IPaymentRepository;
  private invoiceRepo: IInvoiceRepository;
  private shiftRepo: IShiftRepository;
  private cashTxRepo: ICashTransactionRepository;
  private customerRepo: ICustomerRepository;
  private auditRepo: IAuditLogRepository;

  constructor(
    dbManager?: DatabaseManager,
    orderRepo?: IOrderRepository,
    orderItemRepo?: IOrderItemRepository,
    paymentRepo?: IPaymentRepository,
    invoiceRepo?: IInvoiceRepository,
    shiftRepo?: IShiftRepository,
    customerRepo?: ICustomerRepository,
    auditRepo?: IAuditLogRepository,
    cashTxRepo?: ICashTransactionRepository
  ) {
    this.dbManager = dbManager || DatabaseManager.getInstance();
    this.orderRepo = orderRepo || new OrderRepository();
    this.orderItemRepo = orderItemRepo || new OrderItemRepository();
    this.paymentRepo = paymentRepo || new PaymentRepository();
    this.invoiceRepo = invoiceRepo || new InvoiceRepository();
    this.shiftRepo = shiftRepo || new ShiftRepository();
    this.customerRepo = customerRepo || new CustomerRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
    this.cashTxRepo = cashTxRepo || new CashTransactionRepository();
  }

  /**
   * Pure financial validation for payment amounts against order total.
   * Integer minor units only. No floating point.
   */
  public validatePayment(
    totalMinor: number,
    payments: PaymentItemInput[]
  ): {
    isValid: boolean;
    error?: string;
    totalPaid: number;
    remaining: number;
    change: number;
  } {
    return validatePaymentAmounts(totalMinor, payments);
  }

  /**
   * Complete Sale Transaction:
   * 1. Check permissions (pos.create_order or orders.manage).
   * 2. Begin atomic database transaction.
   * 3. Load order with row lock & verify status is PENDING.
   * 4. Verify no completed payments or invoices already exist for this order.
   * 5. Recalculate trusted order total from database snapshots.
   * 6. Validate payments against trusted total.
   * 7. Insert payment rows.
   * 8. Generate collision-safe sequential invoice number and insert invoice row.
   * 9. Mark order COMPLETED.
   * 10. Write financial audit logs.
   * 11. Commit transaction and return results.
   */
  public async completeSale(
    user: AuthenticatedUser,
    input: CompleteSaleInput,
    executor?: ISqlExecutor
  ): Promise<CompleteSaleResult> {
    // 1. RBAC Permission Check
    requireAnyPermission(user, ['pos.create_order', 'orders.manage'], this.auditRepo);

    if (!input.orderId || !input.orderId.trim()) {
      throw new ValidationError('معرف الطلب مطلوب لإتمام السداد.');
    }

    const executeSale = async (tx: ISqlExecutor) => {
      const txOrderRepo = new OrderRepository(tx);
      const txOrderItemRepo = new OrderItemRepository(tx);
      const txPaymentRepo = new PaymentRepository(tx);
      const txInvoiceRepo = new InvoiceRepository(tx);
      const txShiftRepo = new ShiftRepository(tx);
      const txCustomerRepo = new CustomerRepository(tx);
      const txAuditRepo = new AuditLogRepository(tx);
      const txProductRepo = new ProductRepository(tx);
      const txMovementRepo = new InventoryMovementRepository(tx);
      const txSettingsRepo = new SettingsRepository(tx);

      // 2. Fetch fresh order inside transaction
      const order = await txOrderRepo.findById(input.orderId);
      if (!order) {
        throw new NotFoundError('Order', input.orderId);
      }

      // 3. Idempotency & Double Payment Protection:
      // Status MUST be PENDING or HOLD
      if (order.status !== 'PENDING' && order.status !== 'HOLD') {
        throw new ConflictError(
          `لا يمكن سداد الطلب (${order.order_number}) لأنه بحالة "${order.status}". تم سداده مسبقاً أو إلغاؤه.`
        );
      }

      // Verify no invoice already issued for this order
      const existingInvoice = await txInvoiceRepo.findByOrderId(order.id);
      if (existingInvoice) {
        throw new ConflictError(
          `توجد فاتورة صادرة مسبقاً لهذا الطلب برقم (${existingInvoice.invoice_number}). لا يمكن تكرار السداد.`
        );
      }

      // Verify no payments already recorded
      const existingPayments = await txPaymentRepo.listByOrderId(order.id);
      if (existingPayments.length > 0) {
        throw new ConflictError(
          `تم تسجيل مدفوعات مسبقة لهذا الطلب (${order.order_number}). عملية الدفع غير مسموح بتكرارها.`
        );
      }

      // Verify active OPEN shift exists for the order
      const shift = await txShiftRepo.findById(order.shift_id);
      if (!shift || shift.status !== 'OPEN') {
        throw new ConflictError(
          `لا يمكن إتمام سداد الطلب (${order.order_number}) لأن وردية الكاشير المرتبطة به غير مفتوحة.`
        );
      }

      // 4. Recalculate trusted total from database order items snapshots
      const items = await txOrderItemRepo.listByOrderId(order.id);
      if (!items || items.length === 0) {
        throw new ValidationError('لا يمكن سداد طلب فارغ لا يحتوي على أصناف.');
      }

      let recalculatedSubtotal = 0;
      for (const item of items) {
        if (!Number.isInteger(item.unit_price) || item.unit_price <= 0) {
          throw new ValidationError(`سعر الصنف (${item.product_name_snapshot}) غير صالح.`);
        }
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new ValidationError(`كمية الصنف (${item.product_name_snapshot}) غير صالحة.`);
        }
        recalculatedSubtotal += (item.unit_price * item.quantity);
      }

      if (order.discount_amount > recalculatedSubtotal) {
        throw new ValidationError('الخصم المخزن يتجاوز الإجمالي الفرعي للطلب.');
      }
      const taxableBase = Math.max(0, recalculatedSubtotal - order.discount_amount);
      const taxInclusive = (await txSettingsRepo.get('tax_inclusive')) === '1';
      const recalculatedTax = order.tax_rate > 0
        ? Math.round(taxInclusive ? taxableBase * order.tax_rate / (100 + order.tax_rate) : taxableBase * order.tax_rate / 100)
        : 0;
      const recalculatedTotal = Math.max(0, taxableBase + order.delivery_fee + (taxInclusive ? 0 : recalculatedTax));

      if (recalculatedTotal <= 0) {
        throw new ValidationError('إجمالي الطلب بعد إعادة الحساب يجب أن يكون أكبر من صفر.');
      }

      const now = new Date().toISOString();
      const allowNegativeStock = (await txSettingsRepo.get('allow_negative_stock')) === '1';
      // Reserve tracked stock inside same transaction as payment. Rollback restores stock on failure.
      for (const item of items) {
        const product = await txProductRepo.findById(item.product_id);
        if (!product) {
          throw new NotFoundError('Product', item.product_id);
        }
        if (product.track_stock === 1) {
          if (!allowNegativeStock && product.current_stock < item.quantity) {
            throw new ConflictError(`المخزون غير كافٍ للصنف "${product.name}". المتاح: ${product.current_stock}`);
          }
          await txProductRepo.updateStock(product.id, -item.quantity);
          await txMovementRepo.create({
            id: generateId('mov'),
            product_id: product.id,
            movement_type: 'SALE',
            quantity: item.quantity,
            reference_type: 'ORDER',
            reference_id: order.id,
            notes: `بيع الفاتورة ${order.order_number}`,
            user_id: user.id,
            created_at: now,
          });
        }
      }

      // 5. Validate Payments against Trusted Total
      const valResult = this.validatePayment(recalculatedTotal, input.payments);
      if (!valResult.isValid) {
        await txAuditRepo.log(
          'PAYMENT_FAILED',
          'order',
          order.id,
          user.id,
          {
            order_number: order.order_number,
            reason: valResult.error,
            recalculatedTotal,
          }
        );
        throw new ValidationError(valResult.error || 'بيانات الدفع غير صالحة.');
      }

      // 6. Insert Payments & Cash Drawer Ledger
      const txCashTxRepo = new CashTransactionRepository(tx);
      let totalCashAmount = 0;
      const insertedPayments: PaymentRow[] = [];
      for (const p of input.payments) {
        const change = p.method === 'CASH' ? (p.tenderAmount - p.amount) : 0;
        const paymentRow: PaymentRow = {
          id: generateId('pay'),
          order_id: order.id,
          shift_id: order.shift_id,
          payment_method: p.method,
          amount: p.amount,
          tender_amount: p.tenderAmount,
          change_amount: change,
          reference_number: p.referenceNumber || null,
          created_at: now,
        };

        const createdPayment = await txPaymentRepo.create(paymentRow);
        insertedPayments.push(createdPayment);

        // Record net cash in register for CASH payment
        if (p.method === 'CASH' && p.amount > 0) {
          totalCashAmount += p.amount;
          const cashTxRow: CashTransactionRow = {
            id: generateId('ctx'),
            shift_id: order.shift_id,
            transaction_type: 'SALE_PAYMENT',
            amount: p.amount,
            reason: `مبيعات نقدية للطلب (${order.order_number})`,
            reference_id: createdPayment.id,
            user_id: user.id,
            created_at: now,
          };
          await txCashTxRepo.create(cashTxRow);
        }
      }

      if (totalCashAmount > 0) {
        const cashTotals = await txCashTxRepo.calculateShiftCashTotals(order.shift_id);
        await txShiftRepo.updateExpectedCash(order.shift_id, shift.opening_cash + cashTotals.netCash);
      }

      // 7. Generate Invoice Number & Create Invoice
      const invoiceNumber = await txInvoiceRepo.getNextInvoiceNumber();

      let customerName: string | null = null;
      if (order.customer_id) {
        const customer = await txCustomerRepo.findById(order.customer_id);
        if (customer) {
          customerName = customer.name;
        }
      }

      const invoiceRow: InvoiceRow = {
        id: generateId('inv'),
        invoice_number: invoiceNumber,
        order_id: order.id,
        shift_id: order.shift_id,
        status: 'PAID',
        total_amount: recalculatedSubtotal,
        tax_amount: recalculatedTax,
        discount_amount: order.discount_amount,
        net_amount: recalculatedTotal,
        customer_name_snapshot: customerName,
        cashier_name_snapshot: user.name,
        printed_count: 0,
        last_printed_at: null,
        created_at: now,
      };

      const createdInvoice = await txInvoiceRepo.create(invoiceRow);

      // 8. Mark Order COMPLETED
      await tx.execute(
        `UPDATE orders
         SET status = 'COMPLETED', subtotal = ?, tax_amount = ?, total = ?, updated_at = ?
         WHERE id = ?;`,
        [recalculatedSubtotal, recalculatedTax, recalculatedTotal, now, order.id]
      );

      // Release table to AVAILABLE if Dine-In and no other pending orders occupy it
      if (order.table_id || order.table_number) {
        const tableLookup = order.table_id || order.table_number;
        const otherOrder = await tx.queryOne(
          `SELECT id FROM orders WHERE (table_id = ? OR table_number = ?) AND status IN ('PENDING', 'HOLD') AND id != ? LIMIT 1;`,
          [tableLookup, tableLookup, order.id]
        );
        if (!otherOrder) {
          if (order.table_id) {
            await tx.execute(`UPDATE tables SET status = 'AVAILABLE', updated_at = ? WHERE id = ?;`, [now, order.table_id]);
          } else if (order.table_number) {
            await tx.execute(`UPDATE tables SET status = 'AVAILABLE', updated_at = ? WHERE name = ?;`, [now, order.table_number]);
          }
        }
      }

      const completedOrder: OrderRow = {
        ...order,
        status: 'COMPLETED',
        subtotal: recalculatedSubtotal,
        tax_amount: recalculatedTax,
        total: recalculatedTotal,
        updated_at: now,
      };

      // 9. Financial Audit Logging
      await txAuditRepo.log(
        'PAYMENT_CREATED',
        'payment',
        order.id,
        user.id,
        {
          order_id: order.id,
          order_number: order.order_number,
          invoice_number: invoiceNumber,
          net_revenue: recalculatedTotal,
          payments_count: insertedPayments.length,
          change_returned: valResult.change,
        }
      );

      await txAuditRepo.log(
        'INVOICE_CREATED',
        'invoice',
        createdInvoice.id,
        user.id,
        {
          invoice_number: invoiceNumber,
          order_number: order.order_number,
          net_amount: recalculatedTotal,
        }
      );

      await txAuditRepo.log(
        'ORDER_COMPLETED',
        'order',
        order.id,
        user.id,
        {
          order_number: order.order_number,
          invoice_number: invoiceNumber,
          final_total: recalculatedTotal,
        }
      );

      return {
        order: completedOrder,
        items,
        invoice: createdInvoice,
        payments: insertedPayments,
        changeAmount: valResult.change,
      };
    };
    return executor ? executeSale(executor) : this.dbManager.transaction(executeSale);
  }

  public async createAndPayOrder(user: AuthenticatedUser, orderService: OrderService, data: CreateOrderDraftDTO, payments: PaymentItemInput[]): Promise<CompleteSaleResult> {
    return this.dbManager.transaction(async (tx) => {
      const { order } = await orderService.createDraft(user, data, tx);
      const normalizedPayments = payments.map((payment) => payment.method === 'CASH' && payment.amount === 0
        ? { ...payment, amount: order.total, tenderAmount: order.total }
        : payment);
      return this.completeSale(user, { orderId: order.id, payments: normalizedPayments }, tx);
    });
  }

  public async getPaymentsByOrder(orderId: string): Promise<PaymentRow[]> {
    return await this.paymentRepo.listByOrderId(orderId);
  }
}
