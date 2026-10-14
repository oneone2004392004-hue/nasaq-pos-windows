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

export const ModernMinimalTemplate: React.FC<TemplateProps> = ({
  data,
  config,
  isCompactPaper = false,
}) => {
  const { dateStr, timeStr } = formatReceiptDate(data.createdAt);

  return (
    <div
      className={`font-sans text-zinc-900 select-none ${
        isCompactPaper ? 'p-2.5 text-[11px]' : 'p-5 text-xs'
      }`}
      dir="rtl"
    >
      {/* Modern Minimal Header */}
      <div className="text-center pb-3">
        {config.showStoreName && (
          <h1 className="text-lg font-black tracking-tight text-zinc-950 uppercase mb-1">
            {config.storeName || 'مطعم نسق'}
          </h1>
        )}

        <div className="text-[10px] text-zinc-500 font-medium space-y-0.5">
          {config.showAddress && config.storeAddress && <p>{config.storeAddress}</p>}
          <div className="flex justify-center gap-3">
            {config.showPhone && config.storePhone && <span>هاتف: {config.storePhone}</span>}
            {config.showPhone2 && config.storePhone2 && <span>هاتف: {config.storePhone2}</span>}
          </div>
          {config.showTaxNumber && config.taxNumber && (
            <p className="font-mono text-[9px]">رقم ضريبي: {config.taxNumber}</p>
          )}
          {config.showCommercialReg && config.commercialReg && (
            <p className="font-mono text-[9px]">س.ت: {config.commercialReg}</p>
          )}
        </div>
      </div>

      {/* Clean Hairline */}
      <div className="border-t border-zinc-200 my-2.5" />

      {/* Modern Order Badge & Info */}
      <div className="flex items-center justify-between py-1 text-[10px]">
        {config.showOrderType && (
          <span className="font-bold text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded text-[10px]">
            {getOrderTypeName(data.orderType)}
          </span>
        )}
        {config.showTable && data.tableNumber && (
          <span className="font-bold text-zinc-800">{data.tableNumber}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-y-1 py-1 text-[10px] text-zinc-600">
        {config.showInvoiceNumber && (
          <div>
            <span className="text-zinc-400 block text-[9px]">رقم الفاتورة</span>
            <span className="font-mono font-bold text-zinc-800">{data.invoiceNumber}</span>
          </div>
        )}

        {config.showOrderNumber && (
          <div className="text-left">
            <span className="text-zinc-400 block text-[9px]">رقم الطلب</span>
            <span className="font-mono text-zinc-800">{data.orderNumber}</span>
          </div>
        )}

        {config.showDateTime && (
          <div>
            <span className="text-zinc-400 block text-[9px]">التاريخ والوقت</span>
            <span className="font-mono text-zinc-700">
              {dateStr} &bull; {timeStr}
            </span>
          </div>
        )}

        {config.showCashier && (
          <div className="text-left">
            <span className="text-zinc-400 block text-[9px]">الكاشير</span>
            <span className="text-zinc-700">{data.cashierName}</span>
          </div>
        )}
      </div>

      {/* Customer / Delivery Info if present */}
      {((config.showCustomerName && data.customerName) ||
        (config.showDeliveryAddress && data.deliveryAddress)) && (
        <div className="bg-zinc-50 border border-zinc-200 rounded p-2 my-2 text-[10px] space-y-0.5">
          {config.showCustomerName && data.customerName && (
            <div className="flex justify-between">
              <span className="text-zinc-500">العميل:</span>
              <span className="font-bold text-zinc-800">{data.customerName}</span>
            </div>
          )}
          {config.showCustomerPhone && data.customerPhone && (
            <div className="flex justify-between">
              <span className="text-zinc-500">الهاتف:</span>
              <span className="font-mono text-zinc-800">{data.customerPhone}</span>
            </div>
          )}
          {config.showDeliveryAddress && data.deliveryAddress && (
            <div className="pt-1 border-t border-zinc-200">
              <span className="text-zinc-500 block">العنوان:</span>
              <span className="text-zinc-800 font-medium">{data.deliveryAddress}</span>
            </div>
          )}
          {config.showDeliveryDriver && data.deliveryDriverName && (
            <div className="flex justify-between pt-0.5">
              <span className="text-zinc-500">المندوب:</span>
              <span className="text-zinc-800">{data.deliveryDriverName}</span>
            </div>
          )}
        </div>
      )}

      {/* Hairline Divider */}
      <div className="border-t border-zinc-200 my-2.5" />

      {/* Items Section */}
      <div className="space-y-2">
        {data.items.map((item) => (
          <div key={item.id} className="text-[11px]">
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-zinc-900 flex-1">
                {config.showItemQuantity && (
                  <span className="font-mono text-zinc-500 font-normal ml-1.5">
                    {item.quantity}&times;
                  </span>
                )}
                {item.name}
              </span>

              {config.showItemTotal && (
                <span className="font-mono font-bold text-zinc-950 mr-2 text-left">
                  {formatReceiptCurrency(item.total)}
                </span>
              )}
            </div>

            <div className="flex justify-between text-[9px] text-zinc-400 mt-0.5 font-mono">
              {config.showItemUnitPrice && (
                <span>سعر الوحدة: {(item.unitPrice / 100).toFixed(2)} ج.م</span>
              )}
              {config.showItemBarcode && item.barcode && <span>#{item.barcode}</span>}
            </div>

            {config.showItemNotes && item.notes && (
              <p className="text-[10px] text-zinc-500 italic mt-0.5 pr-2">
                &bull; {item.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Hairline Divider */}
      <div className="border-t border-zinc-200 my-3" />

      {/* Totals Section */}
      <div className="space-y-1.5 text-[11px]">
        {config.showSubtotal && (
          <div className="flex justify-between text-zinc-500">
            <span>المجموع</span>
            <span className="font-mono text-zinc-800">{formatReceiptCurrency(data.subtotal)}</span>
          </div>
        )}

        {config.showDiscount && data.discountAmount > 0 && (
          <div className="flex justify-between text-zinc-600">
            <span>الخصم</span>
            <span className="font-mono font-medium text-emerald-700">
              -{formatReceiptCurrency(data.discountAmount)}
            </span>
          </div>
        )}

        {config.showDeliveryFee && data.deliveryFee > 0 && (
          <div className="flex justify-between text-zinc-500">
            <span>خدمة التوصيل</span>
            <span className="font-mono text-zinc-800">+{formatReceiptCurrency(data.deliveryFee)}</span>
          </div>
        )}

        {config.showTax && data.taxAmount > 0 && (
          <div className="flex justify-between text-zinc-500">
            <span>الضريبة{data.taxRate !== undefined ? ` (${data.taxRate}%)` : ''}</span>
            <span className="font-mono text-zinc-800">+{formatReceiptCurrency(data.taxAmount)}</span>
          </div>
        )}

        {/* Big Prominent Modern Total */}
        <div className="pt-2 border-t-2 border-zinc-900 mt-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-black tracking-wide text-zinc-900 uppercase">
              الإجمالي النهائي
            </span>
            <span className="font-mono text-lg font-black text-zinc-950">
              {formatReceiptCurrency(data.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Information */}
      {data.payments && data.payments.length > 0 && (
        <div className="mt-3 pt-2 border-t border-zinc-200 text-[10px] text-zinc-600 space-y-1">
          {data.payments.map((p) => (
            <div key={p.id}>
              <div className="flex justify-between font-medium text-zinc-800">
                {config.showPaymentMethod && (
                  <span>طريقة الدفع: {getPaymentMethodName(p.method)}</span>
                )}
                <span className="font-mono">{formatReceiptCurrency(p.amount)}</span>
              </div>
              {p.method === 'CASH' && config.showAmountReceived && p.tenderAmount && (
                <div className="flex justify-between text-zinc-400">
                  <span>المدفوع نقداً:</span>
                  <span className="font-mono text-zinc-600">
                    {formatReceiptCurrency(p.tenderAmount)}
                  </span>
                </div>
              )}
              {p.method === 'CASH' && config.showChange && (p.changeAmount || 0) > 0 && (
                <div className="flex justify-between text-zinc-900 font-bold">
                  <span>الباقي المستحق:</span>
                  <span className="font-mono text-zinc-900">
                    {formatReceiptCurrency(p.changeAmount!)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modern Minimal Footer */}
      {config.showFooter && (
        <div className="mt-4 pt-3 border-t border-zinc-200 text-center text-[10px] text-zinc-400 space-y-1">
          {config.footerText && (
            <p className="font-medium text-zinc-700">{config.footerText}</p>
          )}
          {config.showFooter2 && config.footerText2 && (
            <p className="text-zinc-400 text-[9px]">{config.footerText2}</p>
          )}
        </div>
      )}
    </div>
  );
};
