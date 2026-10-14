/**
 * NASAQ POS — Hardware & Printing Types (Phase 12B)
 * Pure domain interfaces and DTOs for hardware integration (Thermal printers, ESC/POS, Cash drawer, Barcode).
 */

import { PrinterRow } from '../../domain/dbModels';

export type PrinterConnectionStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'UNAVAILABLE'
  | 'BUSY'
  | 'PAPER_OUT'
  | 'COVER_OPEN'
  | 'ERROR';

export type PrinterHardwareType = 'RECEIPT' | 'KITCHEN';
export type PrinterConnectionType = 'USB' | 'NETWORK' | 'SERIAL';
export type PrinterPaperWidth = 58 | 80;

export interface PrinterDevice extends PrinterRow {
  status: PrinterConnectionStatus;
  statusMessage?: string;
}

export interface KitchenTicketItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string | null;
}

export interface KitchenTicketData {
  orderNumber: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryDriverName?: string | null;
  cashierName: string;
  createdAt: string;
  items: KitchenTicketItem[];
}

export type PrintJobType = 'CUSTOMER_RECEIPT' | 'KITCHEN_TICKET' | 'TEST_PRINT' | 'REPRINT';
export type PrintJobStatus = 'QUEUED' | 'PRINTING' | 'COMPLETED' | 'FAILED';

export interface PrintJob {
  id: string;
  type: PrintJobType;
  targetPrinterId: string;
  invoiceId?: string;
  orderId?: string;
  status: PrintJobStatus;
  attempts: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface PrintResult {
  success: boolean;
  jobId: string;
  printerName: string;
  error?: string;
  rawBytesCount?: number;
}

export interface CashDrawerResult {
  success: boolean;
  opened: boolean;
  error?: string;
}

export interface BarcodeScanResult {
  barcode: string;
  found: boolean;
  product?: {
    id: string;
    name: string;
    barcode: string | null;
    price: number;
    category_id: string;
    is_active: number;
  };
  error?: string;
}

export interface PrinterAdapterStatus {
  connected: boolean;
  status: PrinterConnectionStatus;
  message?: string;
}
