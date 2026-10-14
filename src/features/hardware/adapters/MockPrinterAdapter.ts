/**
 * NASAQ POS — Mock Printer Adapter for Automated Tests (Phase 12B)
 *
 * Dedicated strictly to automated unit and integration tests.
 * NEVER active in standard production deployment.
 */

import { IPrinterAdapter } from './IPrinterAdapter';
import { PrinterRow } from '../../../domain/dbModels';
import { PrinterAdapterStatus, PrinterConnectionStatus } from '../types';

export interface RecordedPrint {
  printerId: string;
  data: Uint8Array;
  timestamp: string;
}

export interface RecordedDrawerPulse {
  printerId: string;
  timestamp: string;
}

export class MockPrinterAdapter implements IPrinterAdapter {
  public readonly id = 'mock_adapter';
  public readonly name = 'Automated Test Mock Printer Adapter';

  private status: PrinterConnectionStatus = 'ONLINE';
  private statusMessage?: string = 'طابعة وهمية متصلة للاختبار';
  private shouldFailNextPrint: boolean = false;
  private failPrintMessage: string = 'خطأ محاكاة في إرسال أمر الطباعة';
  private shouldFailNextDrawer: boolean = false;
  private failDrawerMessage: string = 'خطأ محاكاة في فتح درج الكاشير';

  public sentPrints: RecordedPrint[] = [];
  public drawerPulses: RecordedDrawerPulse[] = [];

  public isAvailable(): boolean {
    return true;
  }

  public setSimulatedStatus(status: PrinterConnectionStatus, message?: string): void {
    this.status = status;
    this.statusMessage = message;
  }

  public failNextPrint(message: string = 'خطأ محاكاة في إرسال أمر الطباعة'): void {
    this.shouldFailNextPrint = true;
    this.failPrintMessage = message;
  }

  public failNextDrawer(message: string = 'خطأ محاكاة في فتح درج الكاشير'): void {
    this.shouldFailNextDrawer = true;
    this.failDrawerMessage = message;
  }

  public clearHistory(): void {
    this.sentPrints = [];
    this.drawerPulses = [];
    this.shouldFailNextPrint = false;
    this.shouldFailNextDrawer = false;
  }

  public async checkStatus(_printer: PrinterRow): Promise<PrinterAdapterStatus> {
    return {
      connected: this.status === 'ONLINE',
      status: this.status,
      message: this.statusMessage,
    };
  }

  public async sendRaw(printer: PrinterRow, data: Uint8Array): Promise<void> {
    if (this.shouldFailNextPrint) {
      this.shouldFailNextPrint = false;
      throw new Error(this.failPrintMessage);
    }

    if (this.status !== 'ONLINE') {
      throw new Error(`تعذر الطباعة: حالة الطابعة هي [${this.status}]`);
    }

    this.sentPrints.push({
      printerId: printer.id,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  public async openCashDrawer(printer: PrinterRow): Promise<void> {
    if (this.shouldFailNextDrawer) {
      this.shouldFailNextDrawer = false;
      throw new Error(this.failDrawerMessage);
    }

    if (this.status !== 'ONLINE') {
      throw new Error(`تعذر فتح الدرج: حالة الطابعة هي [${this.status}]`);
    }

    this.drawerPulses.push({
      printerId: printer.id,
      timestamp: new Date().toISOString(),
    });
  }
}
