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

export const ClassicTemplate: React.FC<TemplateProps> = ({
  data,
  config,
  isCompactPaper = false,
}) => {
  const { fullStr: dateTimeStr } = formatReceiptDate(data.createdAt);

  return (
    <div
      className={`font-mono text-black text-xs leading-relaxed select-none ${
        isCompactPaper ? 'p-2 text-[11px]' : 'p-4'
      }`}
      dir="rtl"
    >
      {/* Header Section */}
      <div className="text-center pb-2">
        {config.showStoreName && (
          <h1 className="text-base font-bold tracking-tight text-black mb-0.5">
            {config.storeName || 'مطعم نسق'}
          </h1>
        )}

        {config.showAddress && config.storeAddress && (
          <p className="text-[11px] text-zinc-700">{config.storeAddress}</p>
        )}

        {config.showPhone && config.storePhone && (
          <p className="text-[11px] text-zinc-700">هاتف: {config.storePhone}</p>
        )}

        {config.showPhone2 && config.storePhone2 && (
          <p className="text-[11px] text-zinc-700">هاتف إضافي: {config.storePhone2}</p>
        )}

        {config.showTaxNumber && config.taxNumber && (
          <p className="text-[10px] text-zinc-600">الرقم الضريبي: {config.taxNumber}</p>
        )}

        {config.showCommercialReg && config.commercialReg && (
          <p className="text-[10px] text-zinc-600">س.ت: {config.commercialReg}</p>
        )}
      </div>

      {/* Dashed Separator */}
      <div className="border-b border-dashed border-zinc-400 my-2" />

      {/* Invoice & Order Metadata */}
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          {config.showInvoiceNumber && (
            <span>
              رقم الفاتورة: <strong className="font-mono">{data.invoiceNumber}</strong>
            </span>
          )}
          {config.showOrderType && (
            <span className="font-bold">[{getOrderTypeName(data.orderType)}]</span>
          )}
        </div>

        {config.showOrderNumber && (
          <div className="flex justify-between">
            <span>رقم الطلب: {data.orderNumber}</span>
            {config.showTable && data.tableNumber && (
              <span className="font-bold">{data.tableNumber}</span>
            )}
          </div>
        )}

        {config.showDateTime && (
          <div className="flex justify-between text-zinc-600 text-[10px]">
            <span>التاريخ والوقت:</span>
            <span dir="ltr">{dateTimeStr}</span>
          </div>
        )}

        {config.showCashier && (
          <div className="flex justify-between text-zinc-600 text-[10px]">
            <span>الكاشير:</span>
            <span>{data.cashierName}</span>
          </div>
        )}

        {config.showCustomerName && data.customerName && (
          <div className="flex justify-between text-[10px]">
            <span>العميل:</span>
            <span className="font-medium">{data.customerName}</span>
          </div>
        )}

        {config.showCustomerPhone && data.customerPhone && (
          <div className="flex justify-between text-[10px]">
            <span>هاتف العميل:</span>
            <span>{data.customerPhone}</span>
          </div>
        )}

        {config.showDeliveryAddress && data.deliveryAddress && (
          <div className="text-[10px] bg-zinc-100 p-1 rounded mt-1">
            <span className="font-bold block">عنوان التوصيل:</span>
            <span>{data.deliveryAddress}</span>
          </div>
        )}

        {config.showDeliveryDriver && data.deliveryDriverName && (
          <div className="flex justify-between text-[10px]">
            <span>مندوب التوصيل:</span>
            <span>{data.deliveryDriverName}</span>
          </div>
        )}
      </div>

      {/* Dashed Separator */}
      <div className="border-b border-dashed border-zinc-400 my-2" />

      {/* Items Table */}
      <div>
        <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-zinc-300">
          <span className="w-1/2 text-right">الصنف</span>
          {config.showItemQuantity && <span className="w-1/6 text-center">الكمية</span>}
          {config.showItemUnitPrice && <span className="w-1/6 text-center">السعر</span>}
          {config.showItemTotal && <span className="w-1/4 text-left">الإجمالي</span>}
        </div>

        <div className="divide-y divide-dashed divide-zinc-200 my-1">
          {data.items.map((item) => (
            <div key={item.id} className="py-1">
              <div className="flex justify-between items-baseline text-[11px]">
                <div className="w-1/2 text-right font-medium">
                  {item.name}
                  {config.showItemBarcode && item.barcode && (
                    <span className="block text-[9px] text-zinc-500 font-mono">
                      #{item.barcode}
                    </span>
                  )}
                </div>
                {config.showItemQuantity && (
                  <span className="w-1/6 text-center font-mono">{item.quantity}</span>
                )}
                {config.showItemUnitPrice && (
                  <span className="w-1/6 text-center font-mono">
                    {(item.unitPrice / 100).toFixed(1)}
                  </span>
                )}
                {config.showItemTotal && (
                  <span className="w-1/4 text-left font-mono font-bold">
                    {formatReceiptCurrency(item.total)}
                  </span>
                )}
              </div>
              {config.showItemNotes && item.notes && (
                <div className="text-[10px] text-zinc-600 pr-2">
                  * {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dashed Separator */}
      <div className="border-b border-dashed border-zinc-400 my-2" />

      {/* Totals Section */}
      <div className="space-y-1 text-[11px]">
        {config.showSubtotal && (
          <div className="flex justify-between text-zinc-700">
            <span>المجموع الفرعي:</span>
            <span className="font-mono">{formatReceiptCurrency(data.subtotal)}</span>
          </div>
        )}

        {config.showDiscount && data.discountAmount > 0 && (
          <div className="flex justify-between text-zinc-700">
            <span>الخصم الممنوح:</span>
            <span className="font-mono">-{formatReceiptCurrency(data.discountAmount)}</span>
          </div>
        )}

        {config.showDeliveryFee && data.deliveryFee > 0 && (
          <div className="flex justify-between text-zinc-700">
            <span>رسوم التوصيل:</span>
            <span className="font-mono">+{formatReceiptCurrency(data.deliveryFee)}</span>
          </div>
        )}

        {config.showTax && data.taxAmount > 0 && (
          <div className="flex justify-between text-zinc-700">
            <span>ضريبة القيمة المضافة{data.taxRate !== undefined ? ` (${data.taxRate}%)` : ''}:</span>
            <span className="font-mono">+{formatReceiptCurrency(data.taxAmount)}</span>
          </div>
        )}

        {/* Double Dashed Line for Grand Total */}
        <div className="border-t-2 border-dashed border-zinc-600 my-1 pt-1">
          <div className="flex justify-between items-center text-sm font-bold text-black">
            <span>صافي المطلوب سداده:</span>
            <span className="font-mono text-base">{formatReceiptCurrency(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      {data.payments && data.payments.length > 0 && (
        <>
          <div className="border-b border-dashed border-zinc-300 my-2" />
          <div className="space-y-1 text-[10px] text-zinc-700">
            {data.payments.map((p) => (
              <div key={p.id}>
                <div className="flex justify-between font-medium">
                  {config.showPaymentMethod && (
                    <span>طريقة السداد: {getPaymentMethodName(p.method)}</span>
                  )}
                  <span className="font-mono font-bold">{formatReceiptCurrency(p.amount)}</span>
                </div>
                {p.method === 'CASH' && config.showAmountReceived && p.tenderAmount && (
                  <div className="flex justify-between text-zinc-600">
                    <span>المبلغ المستلم:</span>
                    <span className="font-mono">{formatReceiptCurrency(p.tenderAmount)}</span>
                  </div>
                )}
                {p.method === 'CASH' && config.showChange && (p.changeAmount || 0) > 0 && (
                  <div className="flex justify-between text-zinc-800 font-bold">
                    <span>المتبقي للعميل (الباقي):</span>
                    <span className="font-mono">{formatReceiptCurrency(p.changeAmount!)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer Section */}
      {config.showFooter && (
        <div className="border-t border-dashed border-zinc-400 mt-3 pt-2 text-center text-[10px] space-y-0.5">
          {config.footerText && <p className="font-bold">{config.footerText}</p>}
          {config.showFooter2 && config.footerText2 && (
            <p className="text-zinc-600">{config.footerText2}</p>
          )}
        </div>
      )}
    </div>
  );
};
