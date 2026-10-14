import { errorMessage } from '../../../utils/errors';
/**
 * NASAQ POS — Cash Drawer Hardware Service (Phase 12B)
 *
 * Enforces business rules for cash drawer operations:
 * 1. CASH sale -> opens drawer automatically.
 * 2. CARD sale -> keeps drawer closed.
 * 3. SPLIT sale -> opens drawer only if cash portion > 0.
 * 4. Manual diagnostic test -> opens drawer with NO financial mutation or shift transaction.
 * 5. Non-blocking error handling preserving sale transaction integrity.
 */

import { IPrinterRepository, PrinterRepository } from '../../../repositories/PrinterRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { IPrinterAdapter } from '../adapters/IPrinterAdapter';
import { WindowsNativePrinterAdapter } from '../adapters/WindowsNativePrinterAdapter';
import { BrowserPrinterAdapter } from '../adapters/BrowserPrinterAdapter';
import { AuthenticatedUser } from '../../auth/types';
import { hasPermission } from '../../auth/utils/permissions';
import { UnauthorizedError } from '../../auth/errors';
import { generateId } from '../../../utils/id';
import { CashDrawerResult } from '../types';
import { PrinterRow } from '../../../domain/dbModels';

export class CashDrawerService {
  private printerRepo: IPrinterRepository;
  private auditRepo: IAuditLogRepository;
  private adapter: IPrinterAdapter;

  constructor(
    printerRepo?: IPrinterRepository,
    auditRepo?: IAuditLogRepository,
    adapter?: IPrinterAdapter
  ) {
    this.printerRepo = printerRepo || new PrinterRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();

    if (adapter) {
      this.adapter = adapter;
    } else {
      const native = new WindowsNativePrinterAdapter();
      this.adapter = native.isAvailable() ? native : new BrowserPrinterAdapter();
    }
  }

  public setAdapter(adapter: IPrinterAdapter): void {
    this.adapter = adapter;
  }

  public getAdapter(): IPrinterAdapter {
    return this.adapter;
  }

  /**
   * Automatically inspects payments and triggers cash drawer kick pulse if cash was received.
   * Pure CARD -> drawer remains closed.
   * Pure CASH or SPLIT with cash -> drawer opened.
   */
  public async openDrawerOnPayment(
    user: AuthenticatedUser,
    payments: Array<{ method: string; amount: number }>,
    printerId?: string
  ): Promise<CashDrawerResult> {
    const hasCash = payments.some(
      (p) => (p.method === 'CASH' || p.method === 'SPLIT') && p.amount > 0
    );

    // If no cash tender involved, keep drawer securely locked
    if (!hasCash) {
      return {
        success: true,
        opened: false,
      };
    }

    try {
      let printer: PrinterRow | null = null;
      if (printerId) {
        printer = await this.printerRepo.findById(printerId);
      } else {
        printer = await this.printerRepo.getDefault('RECEIPT');
      }

      if (!printer) {
        const activePrinters = await this.printerRepo.listActive();
        printer = activePrinters.find((p) => p.printer_type === 'RECEIPT') || null;
      }

      if (!printer) {
        return {
          success: false,
          opened: false,
          error: 'لم يتم العثور على طابعة كاشير متصلة لفتح درج النقدية',
        };
      }

      await this.adapter.openCashDrawer(printer);

      await this.auditRepo.log(
        'CASH_DRAWER_OPENED',
        'cash_drawer',
        printer.id,
        user.id,
        {
          reason: 'SALE_COMPLETION',
          printerName: printer.name,
        }
      );

      return {
        success: true,
        opened: true,
      };
    } catch (err: unknown) {
      // Non-blocking: drawer failure does NOT fail the sale
      return {
        success: false,
        opened: false,
        error: errorMessage(err, 'تعذر إرسال إشارة فتح درج الكاشير'),
      };
    }
  }

  /**
   * Manual diagnostic test of cash drawer kick pulse.
   * Requires `cash.view_balance` or `settings.edit`.
   * Strictly creates NO sale, NO payment, NO cash transaction, NO shift mutation.
   */
  public async manualTestDrawer(
    user: AuthenticatedUser,
    printerId?: string
  ): Promise<CashDrawerResult> {
    if (!hasPermission(user, 'cash.view_balance') && !hasPermission(user, 'settings.edit')) {
      throw new UnauthorizedError('ليس لديك صلاحية اختبار فتح درج الكاشير');
    }

    let printer: PrinterRow | null = null;
    if (printerId) {
      printer = await this.printerRepo.findById(printerId);
    } else {
      printer = await this.printerRepo.getDefault('RECEIPT');
    }

    if (!printer) {
      const activePrinters = await this.printerRepo.listActive();
      printer = activePrinters.find((p) => p.printer_type === 'RECEIPT') || null;
    }

    if (!printer) {
      return {
        success: false,
        opened: false,
        error: 'لم يتم العثور على طابعة كاشير مهيأة لإرسال نبضة الدرج',
      };
    }

    try {
      await this.adapter.openCashDrawer(printer);

      await this.auditRepo.log(
        'CASH_DRAWER_TEST',
        'cash_drawer',
        printer.id,
        user.id,
        {
          reason: 'MANUAL_TEST',
          printerName: printer.name,
        }
      );

      return {
        success: true,
        opened: true,
      };
    } catch (err: unknown) {
      return {
        success: false,
        opened: false,
        error: errorMessage(err, 'فشل إرسال نبضة فتح درج الكاشير'),
      };
    }
  }
}
