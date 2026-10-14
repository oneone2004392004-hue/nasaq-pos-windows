import { errorMessage } from '../../../utils/errors';
/**
 * NASAQ POS — Windows / Desktop Native Printer Adapter (Phase 14)
 *
 * Communicates with physical thermal printers via:
 * 1. Windows Print Spooler (winspool.drv) for locally installed USB / Serial printers.
 * 2. Direct Raw TCP socket (port 9100) for network thermal receipt and kitchen printers.
 * 3. RJ11/RJ12 Cash drawer pulse kick through the printer interface.
 *
 * When running inside a pure web browser preview, safely and honestly reports UNAVAILABLE.
 */

import { IPrinterAdapter } from './IPrinterAdapter';
import { PrinterRow } from '../../../domain/dbModels';
import { PrinterAdapterStatus } from '../types';
import { EscPosBuilder } from '../escpos/EscPosBuilder';

export interface NativePrintResult {
  success: boolean;
  bytes_sent: number;
  message: string;
  error_code?: string;
}

export interface WindowsPrinterInfo {
  name: string;
  is_default: boolean;
  status: string;
}

export class WindowsNativePrinterAdapter implements IPrinterAdapter {
  public readonly id = 'windows_native';
  public readonly name = 'Windows Native Spooler / Raw TCP Bridge';

  private customInvoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

  constructor(customInvoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>) {
    this.customInvoke = customInvoke;
  }

  public isAvailable(): boolean {
    if (this.customInvoke) return true;
    if (typeof window === 'undefined') return false;
    const win = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
    return Boolean(win.__TAURI__ || win.__TAURI_INTERNALS__);
  }

  private async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (this.customInvoke) {
      return (await this.customInvoke(cmd, args)) as T;
    }
    const win = window as unknown as {
      __TAURI__?: { invoke?: (cmd: string, args?: unknown) => Promise<T> };
      __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: unknown) => Promise<T> };
    };
    const invoker = win.__TAURI__?.invoke || win.__TAURI_INTERNALS__?.invoke;
    if (!invoker) {
      throw new Error('جسر تواصل سطح المكتب (Tauri IPC) غير متاح في هذه البيئة.');
    }
    return await invoker(cmd, args);
  }

  public async checkStatus(printer: PrinterRow): Promise<PrinterAdapterStatus> {
    if (!this.isAvailable()) {
      return {
        connected: false,
        status: 'UNAVAILABLE',
        message: 'يتطلب تطبيق سطح المكتب ويندوز للاتصال المباشر بمنفذ الطابعة',
      };
    }

    // Network printer status check
    if (printer.connection_type === 'NETWORK') {
      const address = (printer.address || '').trim();
      if (!address) {
        return {
          connected: false,
          status: 'OFFLINE',
          message: 'عنوان IP للطابعة الشبكية غير محدد',
        };
      }
      return {
        connected: true,
        status: 'ONLINE',
        message: `طابعة شبكية جاهزة (${address})`,
      };
    }

    // Windows installed printer check
    try {
      const installed = await this.listInstalledPrinters();
      const targetName = (printer.address || printer.name).trim().toLowerCase();
      const matched = installed.find((p) => p.name.trim().toLowerCase() === targetName);

      if (matched) {
        return {
          connected: true,
          status: 'ONLINE',
          message: `طابعة ويندوز متصلة وجاهزة (${matched.name})`,
        };
      }

      return {
        connected: false,
        status: 'OFFLINE',
        message: `الطابعة '${printer.address || printer.name}' غير موجودة في قائمة طابعات ويندوز`,
      };
    } catch (err: unknown) {
      return {
        connected: false,
        status: 'ERROR',
        message: errorMessage(err, 'تعذر استعلام حالة الطابعة من نظام التشغيل'),
      };
    }
  }

  public async sendRaw(printer: PrinterRow, data: Uint8Array): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('لا يمكن إرسال بيانات ESC/POS مباشرة من وضع المتصفح. يجب تشغيل تطبيق سطح المكتب.');
    }

    if (!data || data.length === 0) {
      throw new Error('بيانات الطباعة الموجهة إلى الطابعة فارغة.');
    }

    const payload = Array.from(data);

    if (printer.connection_type === 'NETWORK') {
      const address = (printer.address || '').trim();
      if (!address) {
        throw new Error('عنوان IP الخاص بالطابعة الشبكية غير محدد.');
      }

      // Parse IP and optional Port (e.g. "192.168.1.100:9100" or "192.168.1.100")
      let ip = address;
      let port = 9100;
      if (address.includes(':')) {
        const parts = address.split(':');
        ip = parts[0];
        port = parseInt(parts[1], 10) || 9100;
      }

      try {
        const res = await this.invoke<NativePrintResult>('print_network_raw', {
          ip,
          port,
          timeoutMs: 5000,
          data: payload,
        });

        if (!res || !res.success) {
          throw new Error(res?.message || 'فشل إرسال البيانات إلى الطابعة الشبكية');
        }
      } catch (err: unknown) {
        const msg = errorMessage(err, String(err));
        if (msg.includes('Connection refused') || msg.includes('تعذر الاتصال')) {
          throw new Error(`تعذر الاتصال بالطابعة الشبكية (${address}): تم رفض الاتصال أو الجهاز مغلق.`);
        }
        if (msg.includes('timed out') || msg.includes('مهلة')) {
          throw new Error(`انتهت مهلة الاتصال بالطابعة الشبكية (${address}). تحقق من اتصال الشبكة.`);
        }
        throw new Error(`خطأ في الطباعة الشبكية: ${msg}`);
      }
    } else {
      // Windows Spooler Raw Print (USB / Virtual COM / Serial)
      const targetPrinterName = (printer.address || printer.name).trim();
      if (!targetPrinterName) {
        throw new Error('اسم طابعة ويندوز غير محدد لإرسال أمر الطباعة المباشر.');
      }

      try {
        const res = await this.invoke<NativePrintResult>('print_raw', {
          printerName: targetPrinterName,
          data: payload,
        });

        if (!res || !res.success) {
          throw new Error(res?.message || `فشل إرسال أمر الطباعة إلى '${targetPrinterName}'`);
        }
      } catch (err: unknown) {
        throw new Error(`خطأ أثناء الإرسال إلى طابعة ويندوز (${targetPrinterName}): ${errorMessage(err, String(err))}`);
      }
    }
  }

  public async openCashDrawer(printer: PrinterRow): Promise<void> {
    // ESC/POS Pulse pin 2 / 5: ESC p 0 25 250 (pulse 50ms on, 500ms off)
    const pulseData = new EscPosBuilder().pulseDrawer().build();
    await this.sendRaw(printer, pulseData);
  }

  public async listInstalledPrinters(): Promise<WindowsPrinterInfo[]> {
    if (!this.isAvailable()) {
      return [];
    }
    try {
      const printers = await this.invoke<WindowsPrinterInfo[]>('list_windows_printers');
      return Array.isArray(printers) ? printers : [];
    } catch {
      return [];
    }
  }
}
