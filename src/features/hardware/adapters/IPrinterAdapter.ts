/**
 * NASAQ POS — Hardware Printer Adapter Interface (Phase 12B)
 */

import { PrinterRow } from '../../../domain/dbModels';
import { PrinterAdapterStatus } from '../types';

export interface IPrinterAdapter {
  readonly id: string;
  readonly name: string;

  /**
   * Checks if this adapter is supported in the current runtime environment.
   */
  isAvailable(): boolean;

  /**
   * Checks the physical or logical status of the specified printer.
   */
  checkStatus(printer: PrinterRow): Promise<PrinterAdapterStatus>;

  /**
   * Transmits raw ESC/POS byte sequence to the printer.
   */
  sendRaw(printer: PrinterRow, data: Uint8Array): Promise<void>;

  /**
   * Triggers the cash drawer kick pulse connected to the printer.
   */
  openCashDrawer(printer: PrinterRow): Promise<void>;
}
