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

export class PrinterServiceCore {
  protected printerRepo: IPrinterRepository;
  protected invoiceRepo: IInvoiceRepository;
  protected orderRepo: IOrderRepository;
  protected orderItemRepo: IOrderItemRepository;
  protected paymentRepo: IPaymentRepository;
  protected auditRepo: IAuditLogRepository;
  protected designService: InvoiceDesignService;
  protected adapter: IPrinterAdapter;

  // In-flight print jobs lock to protect against accidental duplicate clicks
  protected inFlightLocks: Set<string> = new Set();

  // In-memory print job log (last 50 jobs)
  protected printJobs: Map<string, PrintJob> = new Map();

  constructor(
    printerRepo?: IPrinterRepository,
    invoiceRepo?: IInvoiceRepository,
    orderRepo?: IOrderRepository,
    auditRepo?: IAuditLogRepository,
    designService?: InvoiceDesignService,
    adapter?: IPrinterAdapter,
    orderItemRepo?: IOrderItemRepository,
    paymentRepo?: IPaymentRepository
  ) {
    this.printerRepo = printerRepo || new PrinterRepository();
    this.invoiceRepo = invoiceRepo || new InvoiceRepository();
    this.orderRepo = orderRepo || new OrderRepository();
    this.orderItemRepo = orderItemRepo || new OrderItemRepository();
    this.paymentRepo = paymentRepo || new PaymentRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
    this.designService = designService || new InvoiceDesignService();

    if (adapter) {
      this.adapter = adapter;
    } else {
      const native = new WindowsNativePrinterAdapter();
      this.adapter = native.isAvailable() ? native : new BrowserPrinterAdapter();
    }
  }

  /**
   * Allows injecting a custom adapter (e.g. MockPrinterAdapter in tests)
   */
  public setAdapter(adapter: IPrinterAdapter): void {
    this.adapter = adapter;
  }

  public getAdapter(): IPrinterAdapter {
    return this.adapter;
  }

  /**
   * Lists all active printers along with real-time status check.
   */
  public async listPrinters(): Promise<PrinterDevice[]> {
    const rows = await this.printerRepo.listActive();
    const result: PrinterDevice[] = [];

    for (const p of rows) {
      let status: PrinterConnectionStatus = 'UNAVAILABLE';
      let statusMessage: string | undefined;

      try {
        const adapterStatus = await this.adapter.checkStatus(p);
        status = adapterStatus.status;
        statusMessage = adapterStatus.message;
      } catch (err: unknown) {
        status = 'ERROR';
        statusMessage = errorMessage(err, 'خطأ في فحص حالة الطابعة');
      }

      result.push({
        ...p,
        status,
        statusMessage,
      });
    }

    return result;
  }

  /**
   * Retrieves single printer by ID.
   */
  public async getPrinterById(id: string): Promise<PrinterRow | null> {
    return await this.printerRepo.findById(id);
  }

  /**
   * Retrieves default printer for a given category.
   */
  public async getDefaultPrinter(type: 'RECEIPT' | 'KITCHEN'): Promise<PrinterRow | null> {
    return await this.printerRepo.getDefault(type);
  }

  /**
   * Sets default printer for a category. Requires `settings.edit`.
   */
  public async setDefaultPrinter(
    user: AuthenticatedUser,
    id: string,
    type: 'RECEIPT' | 'KITCHEN'
  ): Promise<void> {
    if (!hasPermission(user, 'settings.edit')) {
      throw new UnauthorizedError('ليس لديك صلاحية تعديل إعدادات الطابعات');
    }

    const printer = await this.printerRepo.findById(id);
    if (!printer) {
      throw new NotFoundError('printers', id);
    }

    if (printer.printer_type !== type) {
      throw new ValidationError(`الطابعة المحددة ليست من نوع ${type}`);
    }

    await this.printerRepo.setDefault(id, type);

    await this.auditRepo.log(
      'PRINTER_DEFAULT_CHANGED',
      'printer',
      id,
      user.id,
      { printerName: printer.name, type }
    );
  }

  /**
   * Saves or updates a printer configuration. Requires `settings.edit`.
   */
  public async savePrinter(
    user: AuthenticatedUser,
    data: {
      id?: string;
      name: string;
      printer_type: 'RECEIPT' | 'KITCHEN';
      connection_type: 'USB' | 'NETWORK' | 'SERIAL';
      address?: string | null;
      paper_width?: number;
      code_page?: 'CP864' | 'WPC1256';
      print_mode?: 'RAW' | 'RASTER';
      is_default?: number;
      is_active?: number;
    }
  ): Promise<PrinterRow> {
    if (!hasPermission(user, 'settings.edit')) {
      throw new UnauthorizedError('ليس لديك صلاحية إدارة الطابعات');
    }

    if (!data.name || !data.name.trim()) {
      throw new ValidationError('اسم الطابعة مطلوب');
    }

    const paperWidth = data.paper_width === 58 ? 58 : 80;

    if (data.id) {
      // Update existing
      const existing = await this.printerRepo.findById(data.id);
      if (!existing) {
        throw new NotFoundError('printers', data.id);
      }

      const updated = await this.printerRepo.update(data.id, {
        name: data.name.trim(),
        printer_type: data.printer_type,
        connection_type: data.connection_type,
        address: data.address || null,
        paper_width: paperWidth,
        code_page: data.code_page || existing.code_page || 'CP864',
        print_mode: data.print_mode || existing.print_mode || 'RAW',
        is_default: data.is_default !== undefined ? data.is_default : existing.is_default,
        is_active: data.is_active !== undefined ? data.is_active : existing.is_active,
      });

      if (data.is_default === 1) {
        await this.printerRepo.setDefault(data.id, data.printer_type);
      }

      await this.auditRepo.log(
        'PRINTER_CONFIGURED',
        'printer',
        data.id,
        user.id,
        { name: updated.name, type: updated.printer_type, updated: true }
      );

      return updated;
    } else {
      // Create new printer
      const newId = generateId('prn');
      const newPrinter: PrinterRow = {
        id: newId,
        name: data.name.trim(),
        printer_type: data.printer_type,
        connection_type: data.connection_type,
        address: data.address || null,
        paper_width: paperWidth,
        code_page: data.code_page || 'CP864',
        print_mode: data.print_mode || 'RAW',
        is_default: data.is_default ? 1 : 0,
        is_active: data.is_active !== undefined ? data.is_active : 1,
      };

      const created = await this.printerRepo.create(newPrinter);

      if (data.is_default === 1) {
        await this.printerRepo.setDefault(newId, data.printer_type);
      }

      await this.auditRepo.log(
        'PRINTER_CONFIGURED',
        'printer',
        newId,
        user.id,
        { name: created.name, type: created.printer_type, created: true }
      );

      return created;
    }
  }

  /**
   * Deactivates a printer. Requires `settings.edit`.
   */
  public async deletePrinter(user: AuthenticatedUser, id: string): Promise<void> {
    if (!hasPermission(user, 'settings.edit')) {
      throw new UnauthorizedError('ليس لديك صلاحية حذف الطابعات');
    }

    const printer = await this.printerRepo.findById(id);
    if (!printer) {
      throw new NotFoundError('printers', id);
    }

    await this.printerRepo.update(id, { is_active: 0, is_default: 0 });

    await this.auditRepo.log(
      'PRINTER_DELETED',
      'printer',
      id,
      user.id,
      { printerName: printer.name }
    );
  }

  /**
   * Prints Diagnostic Test Slip on the specified or default receipt printer.
   * Creates NO financial records, orders, or payments!
   */
  public async testPrint(user: AuthenticatedUser, printerId?: string): Promise<PrintResult> {
    if (!hasPermission(user, 'settings.edit') && !hasPermission(user, 'pos.reprint_receipt')) {
      throw new UnauthorizedError('ليس لديك صلاحية إجراء اختبار الطباعة');
    }

    let printer: PrinterRow | null = null;
    if (printerId) {
      printer = await this.printerRepo.findById(printerId);
    } else {
      printer = await this.printerRepo.getDefault('RECEIPT');
    }

    if (!printer) {
      return {
        success: false,
        jobId: generateId('job'),
        printerName: 'غير محددة',
        error: 'لم يتم العثور على طابعة مهيأة للاختبار',
      };
    }

    const jobId = generateId('job');
    const paperWidth = (printer.paper_width === 58 ? 58 : 80) as 58 | 80;
    const testBytes = ReceiptEscPosFormatter.formatTestPrint(printer.name, paperWidth, printer.code_page || 'CP864');

    try {
      await this.adapter.sendRaw(printer, testBytes);

      await this.auditRepo.log(
        'PRINTER_TEST',
        'printer',
        printer.id,
        user.id,
        { printerName: printer.name, paperWidth }
      );

      return {
        success: true,
        jobId,
        printerName: printer.name,
        rawBytesCount: testBytes.length,
      };
    } catch (err: unknown) {
      return {
        success: false,
        jobId,
        printerName: printer.name,
        error: errorMessage(err, 'فشل إرسال أمر اختبار الطباعة إلى الطابعة'),
      };
    }
  }

  /**
   * Prints a Customer Receipt for an existing invoice.
   * Includes duplicate print protection, updates print count, and logs audit events.
   * Printer failure does NOT throw or fail financial state.
   */
  protected recordJob(job: PrintJob): void {
    this.printJobs.set(job.id, job);
    if (this.printJobs.size > 50) {
      const firstKey = this.printJobs.keys().next().value;
      if (firstKey) this.printJobs.delete(firstKey);
    }
  }

  public getRecentJobs(): PrintJob[] {
    return Array.from(this.printJobs.values()).reverse();
  }
}
