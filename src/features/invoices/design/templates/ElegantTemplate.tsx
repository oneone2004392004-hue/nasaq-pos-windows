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

export const ElegantTemplate: React.FC<TemplateProps> = ({
  data,
  config,
  isCompactPaper = false,
}) => {
  const { dateStr, timeStr } = formatReceiptDate(data.createdAt);

  return (
    <div
      className={`font-serif text-zinc-900 select-none ${
        isCompactPaper ? 'p-2.5 text-[11px]' : 'p-5 text-xs'
      }`}
      dir="rtl"
    >
      {/* Symmetrical Centered Header */}
      <div className="text-center pb-2">
        <div className="text-[10px] text-zinc-400 tracking-widest mb-1">❖ ❖ ❖</div>
        {config.showStoreName && (
          <h1 className="text-base sm:text-lg font-bold tracking-normal text-zinc-950 mb-1">
            {config.storeName || 'مطعم نسق'}
          </h1>
        )}

        <div className="text-[10px] text-zinc-600 space-y-0.5 font-sans">
          {config.showAddress && config.storeAddress && <p>{config.storeAddress}</p>}
          <div className="flex justify-center gap-3">
            {config.showPhone && config.storePhone && <span>هاتف: {config.storePhone}</span>}
            {config.showPhone2 && config.storePhone2 && <span>| {config.storePhone2}</span>}
          </div>
          {config.showTaxNumber && config.taxNumber && (
            <p className="font-mono text-[9px] text-zinc-500">رقم ضريبي: {config.taxNumber}</p>
          )}
          {config.showCommercialReg && config.commercialReg && (
            <p className="font-mono text-[9px] text-zinc-500">سجل تجاري: {config.commercialReg}</p>
          )}
        </div>
      </div>

      {/* Elegant Double Hairline Rule */}
      <div className="border-b-2 border-double border-zinc-400 my-2.5" />

      {/* Symmetrical Order Information */}
      <div className="text-center space-y-1 text-[10px] font-sans">
        <div className="flex justify-between items-center text-zinc-700">
          {config.showOrderType && (
            <span className="border-b border-zinc-400 pb-0.5 font-bold">
              {getOrderTypeName(data.orderType)}
            </span>
          )}
          {config.showTable && data.tableNumber && (
            <span className="font-bold border-b border-zinc-400 pb-0.5">
              {data.tableNumber}
            </span>
          )}
        </div>

        <div className="flex justify-between text-zinc-500 pt-1">
          {config.showInvoiceNumber && (
            <span>فاتورة: <span className="font-mono text-zinc-800">{data.invoiceNumber}</span></span>
          )}
          {config.showOrderNumber && (
            <span>طلب: <span className="font-mono text-zinc-800">{data.orderNumber}</span></span>
          )}
        </div>

        <div className="flex justify-between text-zinc-500">
          {config.showDateTime && (
            <span className="font-mono">
              {dateStr} &bull; {timeStr}
            </span>
          )}
          {config.showCashier && <span>الخدمة: {data.cashierName}</span>}
        </div>

        {config.showCustomerName && data.customerName && (
          <div className="border-t border-dotted border-zinc-300 pt-1 mt-1 text-zinc-800">
            <span>الضيف الكريم: </span>
            <span className="font-bold">{data.customerName}</span>
            {config.showCustomerPhone && data.customerPhone && (
              <span className="font-mono text-zinc-500 mr-2">({data.customerPhone})</span>
            )}
          </div>
        )}

        {config.showDeliveryAddress && data.deliveryAddress && (
          <div className="text-[9px] text-zinc-600 bg-zinc-50 p-1.5 rounded border border-zinc-200 text-right">
            <span className="font-bold block">العنوان المطلوب:</span>
            <span>{data.deliveryAddress}</span>
          </div>
        )}

        {config.showDeliveryDriver && data.deliveryDriverName && (
          <div className="text-right text-zinc-600">
            <span>مسؤول التوصيل: {data.deliveryDriverName}</span>
          </div>
        )}
      </div>

      {/* Elegant Double Hairline Rule */}
      <div className="border-b-2 border-double border-zinc-400 my-2.5" />

      {/* Courses / Items Table */}
      <div className="font-sans">
        <div className="flex justify-between text-[10px] text-zinc-500 uppercase tracking-wider pb-1 border-b border-zinc-200">
          <span className="w-1/2 text-right">الطلب</span>
          {config.showItemQuantity && <span className="w-1/6 text-center">العدد</span>}
          {config.showItemUnitPrice && <span className="w-1/6 text-center">السعر</span>}
          {config.showItemTotal && <span className="w-1/4 text-left">المبلغ</span>}
        </div>

        <div className="divide-y divide-dotted divide-zinc-200 my-1">
          {data.items.map((item) => (
            <div key={item.id} className="py-1.5">
              <div className="flex justify-between items-baseline text-[11px]">
                <div className="w-1/2 text-right font-medium text-zinc-900">
                  {item.name}
                  {config.showItemBarcode && item.barcode && (
                    <span className="block text-[8px] text-zinc-400 font-mono">
                      #{item.barcode}
                    </span>
                  )}
                </div>
                {config.showItemQuantity && (
                  <span className="w-1/6 text-center font-mono text-zinc-600">
                    {item.quantity}
                  </span>
                )}
                {config.showItemUnitPrice && (
                  <span className="w-1/6 text-center font-mono text-zinc-500">
                    {(item.unitPrice / 100).toFixed(1)}
                  </span>
                )}
                {config.showItemTotal && (
                  <span className="w-1/4 text-left font-mono font-bold text-zinc-900">
                    {formatReceiptCurrency(item.total)}
                  </span>
                )}
              </div>
              {config.showItemNotes && item.notes && (
                <div className="text-[10px] text-zinc-500 italic pr-2 mt-0.5">
                  &bull; {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Symmetrical Divider */}
      <div className="border-b border-zinc-300 my-2.5" />

      {/* Totals Section */}
      <div className="space-y-1.5 text-[11px] font-sans">
        {config.showSubtotal && (
          <div className="flex justify-between text-zinc-600">
            <span>مجموع الطلبات:</span>
            <span className="font-mono">{formatReceiptCurrency(data.subtotal)}</span>
          </div>
        )}

        {config.showDiscount && data.discountAmount > 0 && (
          <div className="flex justify-between text-zinc-700">
            <span>خصم خاص:</span>
            <span className="font-mono text-emerald-800">
              -{formatReceiptCurrency(data.discountAmount)}
            </span>
          </div>
        )}

        {config.showDeliveryFee && data.deliveryFee > 0 && (
          <div className="flex justify-between text-zinc-600">
            <span>خدمة التوصيل:</span>
            <span className="font-mono">+{formatReceiptCurrency(data.deliveryFee)}</span>
          </div>
        )}

        {config.showTax && data.taxAmount > 0 && (
          <div className="flex justify-between text-zinc-600">
            <span>ضريبة القيمة المضافة{data.taxRate !== undefined ? ` (${data.taxRate}%)` : ''}:</span>
            <span className="font-mono">+{formatReceiptCurrency(data.taxAmount)}</span>
          </div>
        )}

        {/* Elegant Centered Total Box */}
        <div className="border-t-2 border-double border-zinc-800 pt-2 mt-2">
          <div className="flex justify-between items-baseline font-bold text-zinc-950">
            <span className="text-xs uppercase tracking-wider">صافي الحساب:</span>
            <span className="font-mono text-base font-black">
              {formatReceiptCurrency(data.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Information */}
      {data.payments && data.payments.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-dotted border-zinc-300 text-[10px] text-zinc-600 font-sans space-y-1">
          {data.payments.map((p) => (
            <div key={p.id}>
              <div className="flex justify-between">
                <span>سداد: {getPaymentMethodName(p.method)}</span>
                <span className="font-mono font-medium">{formatReceiptCurrency(p.amount)}</span>
              </div>
              {p.method === 'CASH' && config.showAmountReceived && p.tenderAmount && (
                <div className="flex justify-between text-zinc-400">
                  <span>المبلغ المستلم:</span>
                  <span className="font-mono">{formatReceiptCurrency(p.tenderAmount)}</span>
                </div>
              )}
              {p.method === 'CASH' && config.showChange && (p.changeAmount || 0) > 0 && (
                <div className="flex justify-between font-bold text-zinc-900">
                  <span>الباقي المعاد للضيف:</span>
                  <span className="font-mono">{formatReceiptCurrency(p.changeAmount!)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Elegant Closing Footer */}
      {config.showFooter && (
        <div className="mt-4 pt-3 border-t-2 border-double border-zinc-400 text-center space-y-1">
          <div className="text-[10px] text-zinc-400 tracking-widest">❖ ❖ ❖</div>
          {config.footerText && (
            <p className="text-xs font-bold text-zinc-800">{config.footerText}</p>
          )}
          {config.showFooter2 && config.footerText2 && (
            <p className="text-[10px] text-zinc-500 font-sans">{config.footerText2}</p>
          )}
        </div>
      )}
    </div>
  );
};
