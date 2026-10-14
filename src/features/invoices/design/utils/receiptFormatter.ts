import { InvoiceReceiptData, InvoiceReceiptItem, InvoiceReceiptPayment } from '../types';
import { InvoiceDetailsDTO } from '../../types';

/**
 * Formats minor units (e.g. piasters) to Egyptian Pounds string
 */
export function formatReceiptCurrency(minorUnits: number): string {
  const pounds = (minorUnits / 100).toFixed(2);
  return `${pounds} ج.م`;
}

/**
 * Formats pure numeric string with 2 decimals
 */
export function formatNumericPounds(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

/**
 * Formats date and time into readable Arabic format
 */
export function formatReceiptDate(isoString: string): { dateStr: string; timeStr: string; fullStr: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return { dateStr: isoString, timeStr: '', fullStr: isoString };
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}/${month}/${day}`;

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const timeStr = `${hours}:${minutes} ${ampm}`;

    return {
      dateStr,
      timeStr,
      fullStr: `${dateStr}  ${timeStr}`,
    };
  } catch {
    return { dateStr: isoString, timeStr: '', fullStr: isoString };
  }
}

/**
 * Returns Arabic name for order type
 */
export function getOrderTypeName(type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'): string {
  switch (type) {
    case 'DINE_IN':
      return 'صالة (Dine-In)';
    case 'TAKEAWAY':
      return 'تيك أواي (Takeaway)';
    case 'DELIVERY':
      return 'دليفري (Delivery)';
    default:
      return type;
  }
}

/**
 * Returns Arabic name for payment method
 */
export function getPaymentMethodName(method: 'CASH' | 'CARD' | 'SPLIT'): string {
  switch (method) {
    case 'CASH':
      return 'نقدي (Cash)';
    case 'CARD':
      return 'بطاقة إلكترونية (Card)';
    case 'SPLIT':
      return 'دفع مركب (Split)';
    default:
      return method;
  }
}

/**
 * Converts InvoiceDetailsDTO from the invoices domain into universal InvoiceReceiptData
 */
export function mapInvoiceDetailsToReceiptData(
  details: InvoiceDetailsDTO & {
    customer?: { id?: string; name?: string | null; phone?: string | null; address?: string | null } | null;
    delivery?: { id?: string; driver_name_snapshot?: string | null; delivery_address_snapshot?: string | null } | null;
  },
  additionalInfo?: {
    customerPhone?: string | null;
    deliveryAddress?: string | null;
    deliveryDriverName?: string | null;
  }
): InvoiceReceiptData {
  const { invoice, order, items, payments, customer, delivery } = details;

  const receiptItems: InvoiceReceiptItem[] = items.map((item) => ({
    id: item.id,
    name: item.product_name_snapshot,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    total: item.total,
    notes: item.notes,
    barcode: 'barcode' in item && typeof item.barcode === 'string' ? item.barcode : null,
  }));

  const receiptPayments: InvoiceReceiptPayment[] = payments.map((p) => ({
    id: p.id,
    method: p.payment_method,
    amount: p.amount,
    tenderAmount: p.tender_amount,
    changeAmount: p.change_amount,
    referenceNumber: p.reference_number,
  }));

  return {
    invoiceNumber: invoice.invoice_number,
    orderNumber: order.order_number,
    orderType: order.order_type,
    createdAt: invoice.created_at,
    cashierName: invoice.cashier_name_snapshot,
    customerName: customer?.name || invoice.customer_name_snapshot || null,
    customerPhone: customer?.phone || additionalInfo?.customerPhone || null,
    tableNumber: order.table_number || null,
    deliveryAddress: delivery?.delivery_address_snapshot || customer?.address || additionalInfo?.deliveryAddress || null,
    deliveryDriverName: delivery?.driver_name_snapshot || additionalInfo?.deliveryDriverName || null,
    items: receiptItems,
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: invoice.tax_amount || order.tax_amount,
    taxRate: order.tax_rate,
    deliveryFee: order.delivery_fee,
    total: invoice.net_amount,
    payments: receiptPayments,
    printedCount: invoice.printed_count,
  };
}
