import React from 'react';
import { InvoiceDesignConfig, InvoiceReceiptData } from '../types';
import {
  formatReceiptCurrency,
  formatReceiptDate,
  getOrderTypeName,
  getPaymentMethodName,
} from '../utils/receiptFormatter';

interface TemplateProps {
  data: InvoiceReceiptData;
  config: InvoiceDesignConfig;
  isCompactPaper?: boolean;
}

export const BoldRestaurantTemplate: React.FC<TemplateProps> = ({
  data,
  config,
  isCompactPaper = false,
}) => {
  const { fullStr: dateTimeStr } = formatReceiptDate(data.createdAt);

  return (
    <div
      className={`font-mono text-black select-none ${
        isCompactPaper ? 'p-2 text-[11px]' : 'p-4 text-xs'
      }`}
      dir="rtl"
    >
      {/* High Contrast Banner Header */}
      {config.showStoreName && (
        <div className="bg-black text-white text-center py-2 px-1 mb-2 rounded-sm">
          <h1 className="text-sm sm:text-base font-black tracking-wider uppercase">
            {config.storeName || 'مطعم نسق'}
          </h1>
        </div>
      )}

      {/* Address & Phone Details */}
      <div className="text-center text-[10px] space-y-0.5 pb-1">
        {config.showAddress && config.storeAddress && (
          <p className="font-bold text-zinc-800">{config.storeAddress}</p>
        )}
        <div className="flex justify-center gap-2 font-mono">
          {config.showPhone && config.storePhone && <span>هاتف: {config.storePhone}</span>}
          {config.showPhone2 && config.storePhone2 && <span>| {config.storePhone2}</span>}
        </div>
        {config.showTaxNumber && config.taxNumber && (
          <p className="font-mono text-[9px] text-zinc-700">رقم ضريبي: {config.taxNumber}</p>
        )}
        {config.showCommercialReg && config.commercialReg && (
          <p className="font-mono text-[9px] text-zinc-700">سجل تجاري: {config.commercialReg}</p>
        )}
      </div>

      {/* Solid Black Separator Bar */}
      <div className="h-0.5 bg-black my-2" />

      {/* Prominent Order Type Badge & Metadata */}
      <div className="flex items-center justify-between mb-2">
        {config.showOrderType && (
          <span className="bg-zinc-900 text-white font-black px-2 py-0.5 text-[10px] tracking-wide rounded-sm">
            {getOrderTypeName(data.orderType)}
          </span>
        )}
        {config.showTable && data.tableNumber && (
          <span className="border border-black font-black px-2 py-0.5 text-[10px]">
            {data.tableNumber}
          </span>
        )}
      </div>

      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between font-bold">
          {config.showInvoiceNumber && <span>فاتورة: {data.invoiceNumber}</span>}
          {config.showOrderNumber && <span>طلب: {data.orderNumber}</span>}
        </div>

        {config.showDateTime && (
          <div className="flex justify-between text-zinc-700">
            <span>التاريخ والوقت:</span>
            <span dir="ltr" className="font-mono">
              {dateTimeStr}
            </span>
          </div>
        )}

        {config.showCashier && (
          <div className="flex justify-between text-zinc-700">
            <span>الكاشير:</span>
            <span className="font-bold">{data.cashierName}</span>
          </div>
        )}

        {config.showCustomerName && data.customerName && (
          <div className="flex justify-between border-t border-zinc-300 pt-1 mt-1 font-bold">
            <span>العميل:</span>
            <span>{data.customerName}</span>
          </div>
        )}

        {config.showCustomerPhone && data.customerPhone && (
          <div className="flex justify-between text-zinc-700">
            <span>هاتف:</span>
            <span className="font-mono">{data.customerPhone}</span>
          </div>
        )}

        {config.showDeliveryAddress && data.deliveryAddress && (
          <div className="bg-zinc-100 border-l-2 border-black p-1 text-[9px]">
            <span className="font-bold block">العنوان:</span>
            <span>{data.deliveryAddress}</span>
          </div>
        )}

        {config.showDeliveryDriver && data.deliveryDriverName && (
          <div className="flex justify-between text-zinc-700">
            <span>مندوب:</span>
            <span className="font-bold">{data.deliveryDriverName}</span>
          </div>
        )}
      </div>

      {/* Solid Black Separator Bar */}
      <div className="h-0.5 bg-black my-2" />

      {/* Items Section */}
      <div>
        <div className="flex justify-between font-black text-[11px] pb-1 border-b-2 border-zinc-800">
          <span className="w-1/2 text-right">الصنف</span>
          {config.showItemQuantity && <span className="w-1/6 text-center">الكمية</span>}
          {config.showItemUnitPrice && <span className="w-1/6 text-center">السعر</span>}
          {config.showItemTotal && <span className="w-1/4 text-left">الإجمالي</span>}
        </div>

        <div className="divide-y divide-zinc-200 my-1">
          {data.items.map((item) => (
            <div key={item.id} className="py-1.5">
              <div className="flex justify-between items-baseline text-[11px]">
                <div className="w-1/2 text-right font-black">
                  {item.name}
                  {config.showItemBarcode && item.barcode && (
                    <span className="block text-[8px] text-zinc-500 font-mono">
                      #{item.barcode}
                    </span>
                  )}
                </div>
                {config.showItemQuantity && (
                  <span className="w-1/6 text-center font-mono font-bold">{item.quantity}</span>
                )}
                {config.showItemUnitPrice && (
                  <span className="w-1/6 text-center font-mono text-zinc-600">
                    {(item.unitPrice / 100).toFixed(1)}
                  </span>
                )}
                {config.showItemTotal && (
                  <span className="w-1/4 text-left font-mono font-black">
                    {formatReceiptCurrency(item.total)}
                  </span>
                )}
              </div>
              {config.showItemNotes && item.notes && (
                <div className="text-[9px] text-zinc-700 font-medium pr-1 mt-0.5">
                  &bull; {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Solid Separator */}
      <div className="h-0.5 bg-black my-2" />

      {/* Breakdown */}
      <div className="space-y-1 text-[11px]">
        {config.showSubtotal && (
          <div className="flex justify-between font-medium text-zinc-700">
            <span>المجموع الفرعي:</span>
            <span className="font-mono">{formatReceiptCurrency(data.subtotal)}</span>
          </div>
        )}

        {config.showDiscount && data.discountAmount > 0 && (
          <div className="flex justify-between font-bold text-zinc-800">
            <span>الخصم المعتمد:</span>
            <span className="font-mono">-{formatReceiptCurrency(data.discountAmount)}</span>
          </div>
        )}

        {config.showDeliveryFee && data.deliveryFee > 0 && (
          <div className="flex justify-between font-medium text-zinc-700">
            <span>رسوم التوصيل:</span>
            <span className="font-mono">+{formatReceiptCurrency(data.deliveryFee)}</span>
          </div>
        )}

        {config.showTax && data.taxAmount > 0 && (
          <div className="flex justify-between font-medium text-zinc-700">
            <span>ضريبة مبيعات{data.taxRate !== undefined ? ` (${data.taxRate}%)` : ''}:</span>
            <span className="font-mono">+{formatReceiptCurrency(data.taxAmount)}</span>
          </div>
        )}
      </div>

      {/* BOXED / FRAMED BOLD TOTAL SECTION */}
      <div className="border-2 border-black p-2 my-2.5 bg-white text-black">
        <div className="flex justify-between items-center">
          <span className="text-xs font-black uppercase tracking-wider">الإجمالي المطلوب</span>
          <span className="font-mono text-base font-black tracking-tight">
            {formatReceiptCurrency(data.total)}
          </span>
        </div>
      </div>

      {/* Payment Details */}
      {data.payments && data.payments.length > 0 && (
        <div className="space-y-1 text-[10px] text-zinc-800 pb-1">
          {data.payments.map((p) => (
            <div key={p.id}>
              <div className="flex justify-between font-bold">
                {config.showPaymentMethod && (
                  <span>الدفع: {getPaymentMethodName(p.method)}</span>
                )}
                <span className="font-mono">{formatReceiptCurrency(p.amount)}</span>
              </div>
              {p.method === 'CASH' && config.showAmountReceived && p.tenderAmount && (
                <div className="flex justify-between text-zinc-600">
                  <span>المبلغ المسلم:</span>
                  <span className="font-mono">{formatReceiptCurrency(p.tenderAmount)}</span>
                </div>
              )}
              {p.method === 'CASH' && config.showChange && (p.changeAmount || 0) > 0 && (
                <div className="flex justify-between font-black text-black">
                  <span>المتبقي (الباقي):</span>
                  <span className="font-mono">{formatReceiptCurrency(p.changeAmount!)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Framed Footer */}
      {config.showFooter && (
        <div className="border border-black p-2 mt-3 text-center text-[10px] space-y-0.5">
          {config.footerText && <p className="font-black">{config.footerText}</p>}
          {config.showFooter2 && config.footerText2 && (
            <p className="text-zinc-600 text-[9px]">{config.footerText2}</p>
          )}
        </div>
      )}
    </div>
  );
};
