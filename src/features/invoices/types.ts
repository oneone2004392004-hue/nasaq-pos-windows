import { InvoiceRow, OrderRow, OrderItemRow, PaymentRow } from '../../domain/dbModels';

export type InvoiceDatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH';

export interface InvoiceFilter {
  search?: string;
  status?: 'ALL' | 'PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  paymentMethod?: 'ALL' | 'CASH' | 'CARD' | 'SPLIT';
  datePreset?: InvoiceDatePreset;
  startDate?: string;
  endDate?: string;
  shiftId?: string;
}

export interface InvoiceListItemDTO {
  id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  table_number: string | null;
  customer_name: string | null;
  cashier_name: string;
  status: 'PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  total_amount: number; // minor units
  tax_amount: number;
  discount_amount: number;
  net_amount: number; // minor units
  payment_methods: string[];
  items_count: number;
  printed_count: number;
  created_at: string;
}

export interface InvoiceDetailsDTO {
  invoice: InvoiceRow;
  order: OrderRow;
  items: OrderItemRow[];
  payments: PaymentRow[];
}
