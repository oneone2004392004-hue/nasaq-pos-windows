import { AuthenticatedUser } from '../../auth/types';
import { requirePermission, requireAnyPermission } from '../../auth/utils/permissions';
import { IInvoiceRepository, InvoiceRepository } from '../../../repositories/InvoiceRepository';
import { IOrderRepository, OrderRepository } from '../../../repositories/OrderRepository';
import { IOrderItemRepository, OrderItemRepository } from '../../../repositories/OrderItemRepository';
import { IPaymentRepository, PaymentRepository } from '../../../repositories/PaymentRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { InvoiceFilter, InvoiceListItemDTO, InvoiceDetailsDTO } from '../types';
import { NotFoundError } from '../../../database/errors';

export interface IInvoiceService {
  listInvoices(user: AuthenticatedUser, filter?: InvoiceFilter): Promise<InvoiceListItemDTO[]>;
  getInvoiceWithDetails(user: AuthenticatedUser, invoiceId: string): Promise<InvoiceDetailsDTO>;
  cancel(user: AuthenticatedUser, invoiceId: string, reason: string): Promise<void>;
  reprint(user: AuthenticatedUser, invoiceId: string): Promise<void>;
}

export class InvoiceService implements IInvoiceService {
  private invoiceRepo: IInvoiceRepository;
  private auditRepo: IAuditLogRepository;
  private orderRepo: IOrderRepository;
  private orderItemRepo: IOrderItemRepository;
  private paymentRepo: IPaymentRepository;

  constructor(
    invoiceRepo?: IInvoiceRepository,
    auditRepo?: IAuditLogRepository,
    orderRepo?: IOrderRepository,
    orderItemRepo?: IOrderItemRepository,
    paymentRepo?: IPaymentRepository
  ) {
    this.invoiceRepo = invoiceRepo || new InvoiceRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
    this.orderRepo = orderRepo || new OrderRepository();
    this.orderItemRepo = orderItemRepo || new OrderItemRepository();
    this.paymentRepo = paymentRepo || new PaymentRepository();
  }

  /**
   * Lists invoices with query filters and snapshot metrics
   */
  public async listInvoices(
    user: AuthenticatedUser,
    filter?: InvoiceFilter
  ): Promise<InvoiceListItemDTO[]> {
    requireAnyPermission(user, ['orders.view', 'pos.create_order', 'orders.manage'], this.auditRepo);
    return await this.invoiceRepo.listInvoices(filter);
  }

  /**
   * Retrieves an invoice along with its historical order items snapshot and payments.
   * Completely immune to future catalog price changes.
   */
  public async getInvoiceWithDetails(
    user: AuthenticatedUser,
    invoiceId: string
  ): Promise<InvoiceDetailsDTO> {
    requireAnyPermission(user, ['orders.view', 'pos.create_order', 'orders.manage'], this.auditRepo);

    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    const order = await this.orderRepo.findById(invoice.order_id);
    if (!order) {
      throw new NotFoundError('Order', invoice.order_id);
    }

    const items = await this.orderItemRepo.listByOrderId(order.id);
    const payments = await this.paymentRepo.listByOrderId(order.id);

    return {
      invoice,
      order,
      items,
      payments,
    };
  }

  /**
   * Cancels an invoice.
   * STRICT SERVICE-LAYER ENFORCEMENT:
   * Requires 'orders.manage' or throws UnauthorizedError and logs unauthorized action.
   */
  public async cancel(user: AuthenticatedUser, invoiceId: string, reason: string): Promise<void> {
    // 1. Service-layer authorization check
    requirePermission(user, 'orders.manage', this.auditRepo);

    // 2. Fetch invoice and ensure exists
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      throw new Error(`الفاتورة رقم ${invoiceId} غير موجودة.`);
    }

    // 3. Mark as cancelled in database
    await this.invoiceRepo.updateStatus(invoiceId, 'REFUNDED');

    // 4. Log successful business action
    await this.auditRepo.log(
      'INVOICE_CANCELLED',
      'invoice',
      invoiceId,
      user.id,
      { invoice_number: invoice.invoice_number, reason }
    );
  }

  /**
   * Reprints receipt.
   * Requires 'pos.reprint_receipt'.
   */
  public async reprint(user: AuthenticatedUser, invoiceId: string): Promise<void> {
    requirePermission(user, 'pos.reprint_receipt', this.auditRepo);
    await this.invoiceRepo.incrementPrintCount(invoiceId);
    await this.auditRepo.log(
      'INVOICE_REPRINTED',
      'invoice',
      invoiceId,
      user.id
    );
  }
}
