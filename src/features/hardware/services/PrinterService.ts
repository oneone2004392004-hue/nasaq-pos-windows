import { errorMessage } from '../../../utils/errors';
/**
 * NASAQ POS — Hardware Printer Service (Phase 12B)
 *
 * Orchestrates:
 * 1. Printer management (List, Get, Set Default, Save, Delete).
 * 2. Status inspection via hardware adapters.
 * 3. Customer receipt printing with Phase 12A template styles.
 * 4. Kitchen ticket printing for preparation staff.
 * 5. Diagnostic test printing.
 * 6. Historical invoice reprinting with duplicate protection.
 * 7. Non-blocking error handling preserving financial transaction integrity.
 */

import { IPrinterRepository, PrinterRepository } from '../../../repositories/PrinterRepository';
import { IInvoiceRepository, InvoiceRepository } from '../../../repositories/InvoiceRepository';
import { IOrderRepository, OrderRepository } from '../../../repositories/OrderRepository';
import { IOrderItemRepository, OrderItemRepository } from '../../../repositories/OrderItemRepository';
import { IPaymentRepository, PaymentRepository } from '../../../repositories/PaymentRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { InvoiceDesignService } from '../../invoices/design/services/InvoiceDesignService';
import { IPrinterAdapter } from '../adapters/IPrinterAdapter';
import { WindowsNativePrinterAdapter } from '../adapters/WindowsNativePrinterAdapter';
import { BrowserPrinterAdapter } from '../adapters/BrowserPrinterAdapter';
import { PrinterRow } from '../../../domain/dbModels';
import {
  PrinterDevice,
  PrinterConnectionStatus,
  KitchenTicketData,
  PrintJob,
  PrintResult,
} from '../types';
import { AuthenticatedUser } from '../../auth/types';
import { hasPermission } from '../../auth/utils/permissions';
import { UnauthorizedError } from '../../auth/errors';
import { ValidationError, NotFoundError } from '../../../database/errors';
import { generateId } from '../../../utils/id';
import { InvoiceDetailsDTO } from '../../invoices/types';
import { mapInvoiceDetailsToReceiptData } from '../../invoices/design/utils/receiptFormatter';
import { ReceiptEscPosFormatter } from '../escpos/ReceiptEscPosFormatter';


import { PrinterServiceCore } from './PrinterServiceCore';

export class PrinterService extends PrinterServiceCore {
  public async printCustomerReceipt(
    user: AuthenticatedUser,
    invoiceDetails: InvoiceDetailsDTO,
    options?: { printerId?: string }
  ): Promise<PrintResult> {
    const invoiceId = invoiceDetails.invoice.id;

    // 1. Duplicate in-flight lock protection
    if (this.inFlightLocks.has(invoiceId)) {
      return {
        success: false,
        jobId: generateId('job'),
        printerName: 'طابعة الإيصالات',
        error: 'عملية الطباعة لهذه الفاتورة قيد التنفيذ حالياً، يرجى الانتظار.',
      };
    }

    this.inFlightLocks.add(invoiceId);
    const jobId = generateId('job');

    try {
      // 2. Resolve target printer
      let printer: PrinterRow | null = null;
      if (options?.printerId) {
        printer = await this.printerRepo.findById(options.printerId);
      } else {
        printer = await this.printerRepo.getDefault('RECEIPT');
      }

      if (!printer) {
        const activePrinters = await this.printerRepo.listActive();
        printer = activePrinters.find((p) => p.printer_type === 'RECEIPT') || null;
      }

      if (!printer) {
        await this.auditRepo.log(
          'PRINT_FAILED',
          'invoice',
          invoiceId,
          user.id,
          { error: 'لم يتم العثور على طابعة إيصالات مهيأة' }
        );

        return {
          success: false,
          jobId,
          printerName: 'طابعة الإيصالات',
          error: 'لم يتم العثور على طابعة إيصالات مهيأة في النظام. يرجى تهيئة طابعة من الإعدادات.',
        };
      }

      // 3. Format receipt
      const receiptData = mapInvoiceDetailsToReceiptData(invoiceDetails);
      const config = await this.designService.getConfig();
      const paperWidth = (printer.paper_width === 58 ? 58 : 80) as 58 | 80;
      const rawBytes = ReceiptEscPosFormatter.formatCustomerReceipt(receiptData, config, paperWidth, printer.code_page || 'CP864');

      // 4. Send to physical/hardware adapter
      await this.adapter.sendRaw(printer, rawBytes);

      // 5. Success: update print count in database & audit
      await this.invoiceRepo.incrementPrintCount(invoiceId);

      await this.auditRepo.log(
        'PRINT_SUCCESS',
        'invoice',
        invoiceId,
        user.id,
        {
          printerName: printer.name,
          invoiceNumber: invoiceDetails.invoice.invoice_number,
          paperWidth,
          bytes: rawBytes.length,
        }
      );

      this.recordJob({
        id: jobId,
        type: 'CUSTOMER_RECEIPT',
        targetPrinterId: printer.id,
        invoiceId,
        orderId: invoiceDetails.order.id,
        status: 'COMPLETED',
        attempts: 1,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      return {
        success: true,
        jobId,
        printerName: printer.name,
        rawBytesCount: rawBytes.length,
      };
    } catch (err: unknown) {
      // Non-blocking failure
      await this.auditRepo.log(
        'PRINT_FAILED',
        'invoice',
        invoiceId,
        user.id,
        { error: errorMessage(err, 'تعذر إرسال أمر الطباعة') }
      );

      this.recordJob({
        id: jobId,
        type: 'CUSTOMER_RECEIPT',
        targetPrinterId: options?.printerId || 'unknown',
        invoiceId,
        orderId: invoiceDetails.order.id,
        status: 'FAILED',
        attempts: 1,
        createdAt: new Date().toISOString(),
        error: errorMessage(err, 'تعذر إرسال أمر الطباعة إلى الطابعة'),
      });

      return {
        success: false,
        jobId,
        printerName: 'طابعة الإيصالات',
        error: errorMessage(err, 'تعذر إرسال أمر الطباعة إلى الطابعة'),
      };
    } finally {
      this.inFlightLocks.delete(invoiceId);
    }
  }

  /**
   * Prints Kitchen Preparation Ticket for kitchen staff.
   */
  public async printKitchenTicket(
    user: AuthenticatedUser,
    ticketData: KitchenTicketData,
    options?: { printerId?: string }
  ): Promise<PrintResult> {
    const jobId = generateId('job');

    try {
      let printer: PrinterRow | null = null;
      if (options?.printerId) {
        printer = await this.printerRepo.findById(options.printerId);
      } else {
        printer = await this.printerRepo.getDefault('KITCHEN');
      }

      if (!printer) {
        const activePrinters = await this.printerRepo.listActive();
        printer = activePrinters.find((p) => p.printer_type === 'KITCHEN') || null;
      }

      if (!printer) {
        return {
          success: false,
          jobId,
          printerName: 'طابعة المطبخ',
          error: 'لم يتم العثور على طابعة مطبخ مهيأة في النظام.',
        };
      }

      const paperWidth = (printer.paper_width === 58 ? 58 : 80) as 58 | 80;
      const rawBytes = ReceiptEscPosFormatter.formatKitchenTicket(ticketData, paperWidth, printer.code_page || 'CP864');

      await this.adapter.sendRaw(printer, rawBytes);

      await this.auditRepo.log(
        'PRINT_SUCCESS',
        'kitchen_ticket',
        ticketData.orderNumber,
        user.id,
        {
          printerName: printer.name,
          orderNumber: ticketData.orderNumber,
          itemsCount: ticketData.items.length,
        }
      );

      this.recordJob({
        id: jobId,
        type: 'KITCHEN_TICKET',
        targetPrinterId: printer.id,
        status: 'COMPLETED',
        attempts: 1,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      return {
        success: true,
        jobId,
        printerName: printer.name,
        rawBytesCount: rawBytes.length,
      };
    } catch (err: unknown) {
      this.recordJob({
        id: jobId,
        type: 'KITCHEN_TICKET',
        targetPrinterId: options?.printerId || 'unknown',
        status: 'FAILED',
        attempts: 1,
        createdAt: new Date().toISOString(),
        error: errorMessage(err, 'تعذر إرسال تذكرة المطبخ إلى الطابعة'),
      });

      return {
        success: false,
        jobId,
        printerName: 'طابعة المطبخ',
        error: errorMessage(err, 'تعذر إرسال تذكرة المطبخ إلى الطابعة'),
      };
    }
  }

  /**
   * Historical Invoice Reprinting.
   * Requires `pos.reprint_receipt`.
   * Strictly preserves historical financial data; never creates new invoices/payments.
   */
  public async reprintInvoice(
    user: AuthenticatedUser,
    invoiceId: string,
    options?: { printerId?: string }
  ): Promise<PrintResult> {
    if (!hasPermission(user, 'pos.reprint_receipt')) {
      throw new UnauthorizedError('ليس لديك صلاحية إعادة طباعة الفاتورة (pos.reprint_receipt)');
    }

    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundError('invoices', invoiceId);
    }

    // Retrieve order details
    const order = await this.orderRepo.findById(invoice.order_id);
    if (!order) {
      throw new NotFoundError('orders', invoice.order_id);
    }

    const items = await this.orderItemRepo.listByOrderId(order.id);
    const payments = await this.paymentRepo.listByOrderId(order.id);

    const invoiceDetails: InvoiceDetailsDTO = {
      invoice,
      order,
      items,
      payments,
    };

    const result = await this.printCustomerReceipt(user, invoiceDetails, options);

    if (result.success) {
      await this.auditRepo.log(
        'INVOICE_REPRINTED',
        'invoice',
        invoiceId,
        user.id,
        {
          invoiceNumber: invoice.invoice_number,
          newPrintedCount: (invoice.printed_count || 0) + 1,
          printerName: result.printerName,
        }
      );
    }

    return result;
  }

}
