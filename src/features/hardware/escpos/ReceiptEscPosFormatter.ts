/**
 * NASAQ POS — Receipt & Kitchen Ticket ESC/POS Formatter (Phase 12B)
 *
 * Formats:
 * 1. Customer Invoices / Receipts according to Phase 12A design config.
 * 2. Kitchen Tickets strictly focused on preparation (items, quantities, notes, tables).
 */

import { EscPosBuilder, EscPosCodePage } from './EscPosBuilder';
import { InvoiceReceiptData, InvoiceDesignConfig } from '../../invoices/design/types';
import { KitchenTicketData } from '../types';
import {
  formatReceiptCurrency,
  formatReceiptDate,
  getOrderTypeName,
  getPaymentMethodName,
} from '../../invoices/design/utils/receiptFormatter';

export class ReceiptEscPosFormatter {
  /**
   * Generates ESC/POS byte stream for Customer Receipt.
   */
  public static formatCustomerReceipt(
    data: InvoiceReceiptData,
    config: InvoiceDesignConfig,
    paperWidth: 58 | 80 = 80,
    codePage: EscPosCodePage = 'CP864',
    codePageId?: number
  ): Uint8Array {
    const builder = new EscPosBuilder(codePage, codePageId);
    const cols = paperWidth === 58 ? 32 : 48;
    const { dateStr, timeStr } = formatReceiptDate(data.createdAt);

    // 1. Header & Branding
    builder.align('center');
    if (config.showStoreName && config.storeName) {
      builder.bold(true).textSize(2, 2).line(config.storeName).bold(false).textSize(1, 1);
    }

    if (config.showAddress && config.storeAddress) {
      builder.line(config.storeAddress);
    }

    if (config.showPhone && config.storePhone) {
      builder.line(`هاتف: ${config.storePhone}`);
    }

    if (config.showTaxNumber && config.taxNumber) {
      builder.line(`الرقم الضريبي: ${config.taxNumber}`);
    }

    if (config.showCommercialReg && config.commercialReg) {
      builder.line(`السجل التجاري: ${config.commercialReg}`);
    }

    builder.doubleRule(cols);

    // 2. Metadata / Order Details
    builder.align('right');
    if (config.showInvoiceNumber) {
      builder.twoColumnRow('رقم الفاتورة:', data.invoiceNumber, cols);
    }
    if (config.showOrderNumber) {
      builder.twoColumnRow('رقم الطلب:', data.orderNumber, cols);
    }
    if (config.showOrderType) {
      builder.twoColumnRow('نوع الطلب:', getOrderTypeName(data.orderType), cols);
    }
    if (config.showTable && data.tableNumber) {
      builder.twoColumnRow('رقم الطاولة:', `طاولة ${data.tableNumber}`, cols);
    }
    if (config.showCashier && data.cashierName) {
      builder.twoColumnRow('الكاشير:', data.cashierName, cols);
    }
    if (config.showDateTime) {
      builder.twoColumnRow('التاريخ والوقت:', `${dateStr} ${timeStr}`, cols);
    }
    if (config.showCustomerName && data.customerName) {
      builder.twoColumnRow('العميل:', data.customerName, cols);
    }
    if (config.showCustomerPhone && data.customerPhone) {
      builder.twoColumnRow('هاتف العميل:', data.customerPhone, cols);
    }
    if (config.showDeliveryAddress && data.deliveryAddress) {
      builder.line(`عنوان التوصيل: ${data.deliveryAddress}`);
    }

    builder.rule('-', cols);

    // 3. Items Header
    if (paperWidth === 58) {
      builder.line('الصنف             الكمية   الإجمالي');
    } else {
      builder.line('الصنف                          الكمية   الإجمالي');
    }
    builder.rule('-', cols);

    // 4. Items List
    for (const item of data.items) {
      const qtyStr = `${item.quantity}x`;
      const totalStr = formatReceiptCurrency(item.total);
      builder.itemRow(item.name, qtyStr, totalStr, cols);

      if (config.showItemNotes && item.notes) {
        builder.line(`  * ${item.notes}`);
      }
    }

    builder.doubleRule(cols);

    // 5. Financial Totals
    if (config.showSubtotal) {
      builder.twoColumnRow('المجموع الفرعي:', formatReceiptCurrency(data.subtotal), cols);
    }

    if (config.showDiscount && data.discountAmount > 0) {
      builder.twoColumnRow('الخصم:', `-${formatReceiptCurrency(data.discountAmount)}`, cols);
    }

    if (config.showTax && data.taxAmount > 0) {
      const taxLabel = data.taxRate !== undefined && data.taxRate > 0
        ? `ضريبة القيمة المضافة (${data.taxRate}%):`
        : 'ضريبة القيمة المضافة:';
      builder.twoColumnRow(taxLabel, formatReceiptCurrency(data.taxAmount), cols);
    }

    if (config.showDeliveryFee && data.deliveryFee > 0) {
      builder.twoColumnRow('رسوم التوصيل:', formatReceiptCurrency(data.deliveryFee), cols);
    }

    // Net Total is ALWAYS prominent
    builder.rule('=', cols);
    builder.bold(true).textSize(1, 2);
    builder.twoColumnRow('الإجمالي النهائي:', formatReceiptCurrency(data.total), cols);
    builder.bold(false).textSize(1, 1);
    builder.rule('=', cols);

    // 6. Payments
    if (config.showPaymentMethod && data.payments.length > 0) {
      for (const p of data.payments) {
        const methodStr = getPaymentMethodName(p.method);
        builder.twoColumnRow(`طريقة الدفع (${methodStr}):`, formatReceiptCurrency(p.amount), cols);

        if (config.showAmountReceived && p.tenderAmount && p.tenderAmount > p.amount) {
          builder.twoColumnRow('المبلغ المستلم:', formatReceiptCurrency(p.tenderAmount), cols);
        }
        if (config.showChange && p.changeAmount && p.changeAmount > 0) {
          builder.twoColumnRow('المتبقي:', formatReceiptCurrency(p.changeAmount), cols);
        }
      }
      builder.rule('-', cols);
    }

    // 7. Reprint Notice
    if (data.printedCount && data.printedCount > 1) {
      builder.align('center').bold(true);
      builder.line(`*** نسخة معاد طباعتها (#${data.printedCount}) ***`);
      builder.bold(false);
      builder.rule('-', cols);
    }

    // 8. Footer
    builder.align('center');
    if (config.showFooter && config.footerText) {
      builder.line(config.footerText);
    }
    if (config.showFooter2 && config.footerText2) {
      builder.line(config.footerText2);
    }

    // Cut paper
    builder.cut();

    return builder.build();
  }

  /**
   * Generates ESC/POS byte stream for Kitchen Ticket.
   * Strictly operational: clear item names, bold quantities, preparation notes, table number.
   * Omits financial details.
   */
  public static formatKitchenTicket(data: KitchenTicketData, paperWidth: 58 | 80 = 80, codePage: EscPosCodePage = 'CP864', codePageId?: number): Uint8Array {
    const builder = new EscPosBuilder(codePage, codePageId);
    const cols = paperWidth === 58 ? 32 : 48;
    const { dateStr, timeStr } = formatReceiptDate(data.createdAt);

    // Kitchen Header
    builder.align('center').bold(true).textSize(1, 2);
    builder.line('*** تذكرة تجهيز الطلب (المطبخ) ***');
    builder.textSize(2, 2);
    builder.line(`طلب #${data.orderNumber}`);
    builder.bold(false).textSize(1, 1);
    builder.doubleRule(cols);

    // Operational Details
    builder.align('right');
    builder.twoColumnRow('نوع الطلب:', getOrderTypeName(data.orderType), cols);

    if (data.tableNumber) {
      builder.bold(true).textSize(1, 2);
      builder.twoColumnRow('رقم الطاولة:', `طاولة [ ${data.tableNumber} ]`, cols);
      builder.bold(false).textSize(1, 1);
    }

    if (data.cashierName) {
      builder.twoColumnRow('الكاشير / المنفذ:', data.cashierName, cols);
    }
    builder.twoColumnRow('وقت الطلب:', `${dateStr} ${timeStr}`, cols);

    if (data.orderType === 'DELIVERY') {
      if (data.customerName) builder.twoColumnRow('العميل:', data.customerName, cols);
      if (data.customerPhone) builder.twoColumnRow('هاتف العميل:', data.customerPhone, cols);
      if (data.deliveryAddress) builder.line(`العنوان: ${data.deliveryAddress}`);
      if (data.deliveryDriverName) builder.twoColumnRow('السائق:', data.deliveryDriverName, cols);
    }

    builder.doubleRule(cols);

    // Items List
    builder.align('right');
    for (const item of data.items) {
      // Big bold quantity & item name
      builder.bold(true).textSize(1, 2);
      builder.line(`[ ${item.quantity}x ]  ${item.name}`);
      builder.bold(false).textSize(1, 1);

      if (item.notes) {
        builder.bold(true);
        builder.line(`    >> ملاحظة: ${item.notes}`);
        builder.bold(false);
      }

      builder.rule('-', cols);
    }

    builder.align('center');
    builder.line('--- يرجى التأكد من اكتمال الأصناف قبل التسليم ---');

    builder.cut();

    return builder.build();
  }

  /**
   * Formats a Diagnostic Test Receipt.
   */
  public static formatTestPrint(printerName: string, paperWidth: 58 | 80 = 80, codePage: EscPosCodePage = 'CP864', codePageId?: number): Uint8Array {
    const builder = new EscPosBuilder(codePage, codePageId);
    const cols = paperWidth === 58 ? 32 : 48;
    const now = new Date().toISOString();
    const { dateStr, timeStr } = formatReceiptDate(now);

    builder.align('center');
    builder.bold(true).textSize(2, 2).line('نظام نسق كاشير');
    builder.bold(false).textSize(1, 1);
    builder.line('NASAQ POS — TEST RECEIPT');
    builder.doubleRule(cols);

    builder.align('right');
    builder.twoColumnRow('اسم الطابعة:', printerName, cols);
    builder.twoColumnRow('عرض الورق:', `${paperWidth}mm (${cols} حرف)`, cols);
    builder.twoColumnRow('التاريخ:', dateStr, cols);
    builder.twoColumnRow('الوقت:', timeStr, cols);
    builder.rule('-', cols);

    builder.align('center');
    builder.bold(true).line('اختبار تشكيل وحروف اللغة العربية');
    builder.bold(false);
    builder.line('أ ب ت ث ج ح خ د ذ ر ز س ش ص ض');
    builder.line('مطعم نسق - مأكولات شرقية وغربية');
    builder.line('الأرقام: 0 1 2 3 4 5 6 7 8 9');
    builder.rule('-', cols);

    builder.align('center').bold(true);
    builder.line('تم إرسال أمر اختبار الطباعة بنجاح!');
    builder.line('*** SUCCESSFUL TEST ***');

    builder.cut();

    return builder.build();
  }

  /**
   * Generates standalone ESC/POS Cash Drawer Pulse sequence.
   */
  public static cashDrawerPulse(pin: number = 0): Uint8Array {
    const builder = new EscPosBuilder();
    builder.pulseDrawer(pin);
    return builder.build();
  }
}
