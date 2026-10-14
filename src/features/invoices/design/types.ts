export type InvoiceTemplateId =
  | 'classic'
  | 'modern_minimal'
  | 'compact_pos'
  | 'bold_restaurant'
  | 'elegant';

export type ThermalPaperWidth = '80mm' | '58mm';

export interface InvoiceReceiptItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number; // minor units (piasters)
  total: number; // minor units
  notes?: string | null;
  barcode?: string | null;
}

export interface InvoiceReceiptPayment {
  id: string;
  method: 'CASH' | 'CARD' | 'SPLIT';
  amount: number; // minor units
  tenderAmount?: number; // minor units
  changeAmount?: number; // minor units
  referenceNumber?: string | null;
}

export interface InvoiceReceiptData {
  invoiceNumber: string;
  orderNumber: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  createdAt: string;
  cashierName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  tableNumber?: string | null;
  deliveryAddress?: string | null;
  deliveryDriverName?: string | null;

  items: InvoiceReceiptItem[];

  subtotal: number; // minor units
  discountAmount: number; // minor units
  taxAmount: number; // minor units
  taxRate?: number;
  deliveryFee: number; // minor units
  total: number; // minor units (net_amount)

  payments: InvoiceReceiptPayment[];
  printedCount?: number;
}

export interface InvoiceDesignConfig {
  version: number;
  templateId: InvoiceTemplateId;
  paperWidth: ThermalPaperWidth;

  // Identity
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storePhone2: string;
  taxNumber: string;
  commercialReg: string;

  // Header Visibility
  showStoreName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showPhone2: boolean;
  showTaxNumber: boolean;
  showCommercialReg: boolean;
  showInvoiceNumber: boolean;
  showOrderNumber: boolean;
  showDateTime: boolean;
  showCashier: boolean;
  showOrderType: boolean;

  // Order Details Visibility
  showTable: boolean;
  showCustomerName: boolean;
  showCustomerPhone: boolean;
  showDeliveryAddress: boolean;
  showDeliveryDriver: boolean;

  // Items Visibility
  showItemQuantity: boolean;
  showItemUnitPrice: boolean;
  showItemTotal: boolean;
  showItemBarcode: boolean;
  showItemNotes: boolean;

  // Totals Visibility
  showSubtotal: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showDeliveryFee: boolean;
  // Note: Total must ALWAYS remain visible!

  // Payment Visibility
  showPaymentMethod: boolean;
  showAmountReceived: boolean;
  showChange: boolean;

  // Footer
  showFooter: boolean;
  footerText: string;
  showFooter2: boolean;
  footerText2: string;
}

export interface InvoiceTemplateMeta {
  id: InvoiceTemplateId;
  name: string;
  nameEn: string;
  description: string;
  badge: string;
  features: string[];
}
