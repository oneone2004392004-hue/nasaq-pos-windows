/**
 * NASAQ POS — Browser Fallback Printer Adapter (Phase 12B)
 *
 * Used when running within web preview environments.
 * Strictly adheres to project rules:
 * - Does NOT fake hardware connectivity
 * - Never claims "Printer connected" unless real hardware adapter confirms it
 * - Provides honest status indication to cashiers and administrators
 */

import { IPrinterAdapter } from './IPrinterAdapter';
import { PrinterRow } from '../../../domain/dbModels';
import { PrinterAdapterStatus } from '../types';

export class BrowserPrinterAdapter implements IPrinterAdapter {
  public readonly id = 'browser_fallback';
  public readonly name = 'Browser Web Mode Adapter';

  public isAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  public async checkStatus(_printer: PrinterRow): Promise<PrinterAdapterStatus> {
    return {
      connected: false,
      status: 'UNAVAILABLE',
      message: 'وضع المتصفح — الاتصال المباشر بمنفذ الطابعة الحرارية يتطلب تشغيل تطبيق سطح المكتب (Desktop Native)',
    };
  }

  public async sendRaw(_printer: PrinterRow, _data: Uint8Array): Promise<void> {
    // In pure browser mode without native bridge or WebUSB, direct ESC/POS byte streaming to physical ports is unavailable.
    throw new Error('الاتصال المباشر بمنفذ الطابعة الحرارية غير متاح من المتصفح. استخدم تطبيق سطح المكتب.');
  }

  public async openCashDrawer(_printer: PrinterRow): Promise<void> {
    throw new Error('فتح درج الكاشير عبر نبضات ESC/POS يتطلب تطبيق سطح المكتب.');
  }
}
