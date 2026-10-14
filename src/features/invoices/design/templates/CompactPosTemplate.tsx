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

export const CompactPosTemplate: React.FC<TemplateProps> = ({
  data,
  config,
  isCompactPaper = false,
}) => {
  const { dateStr, timeStr } = formatReceiptDate(data.createdAt);

  return (
    <div
      className={`font-mono text-black leading-tight select-none ${
        isCompactPaper ? 'p-1.5 text-[10px]' : 'p-2.5 text-[11px]'
      }`}
      dir="rtl"
    >
      {/* Compact Header */}
      <div className="text-center pb-1">
        {config.showStoreName && (
          <h1 className="text-sm font-black tracking-tight text-black">
            {config.storeName || 'مطعم نسق'}
          </h1>
        )}

        <div className="text-[9px] text-zinc-600 flex flex-wrap justify-center gap-x-2">
          {config.showAddress && config.storeAddress && <span>{config.storeAddress}</span>}
          {config.showPhone && config.storePhone && <span>ت: {config.storePhone}</span>}
          {config.showTaxNumber && config.taxNumber && <span>ض: {config.taxNumber}</span>}
          {config.showCommercialReg && config.commercialReg && <span>س: {config.commercialReg}</span>}
        </div>
      </div>

      {/* Dotted Separator */}
      <div className="border-b border-dotted border-zinc-400 my-1" />

      {/* Condensed Inline Metadata */}
      <div className="text-[9px] text-zinc-700 space-y-0.5">
        <div className="flex justify-between font-bold">
          {config.showInvoiceNumber && <span>فاتورة: {data.invoiceNumber}</span>}
          {config.showOrderType && <span>[{getOrderTypeName(data.orderType)}]</span>}
        </div>

        <div className="flex justify-between">
          {config.showOrderNumber && <span>طلب: {data.orderNumber}</span>}
          {config.showTable && data.tableNumber && (
            <span className="font-bold">{data.tableNumber}</span>
          )}
          {config.showDateTime && (
            <span dir="ltr">
              {dateStr} {timeStr}
            </span>
          )}
        </div>

        {(config.showCashier || config.showCustomerName) && (
          <div className="flex justify-between">
            {config.showCashier && <span>كاشير: {data.cashierName}</span>}
            {config.showCustomerName && data.customerName && (
              <span>عميل: {data.customerName}</span>
            )}
          </div>
        )}

        {config.showDeliveryAddress && data.deliveryAddress && (
          <div className="text-[8px] truncate">ع: {data.deliveryAddress}</div>
        )}
      </div>

      {/* Dotted Separator */}
      <div className="border-b border-dotted border-zinc-400 my-1" />

      {/* Compact Items List */}
      <div className="space-y-1">
        {data.items.map((item) => (
          <div key={item.id} className="flex justify-between items-start text-[10px]">
            <div className="flex-1 pr-1 truncate">
              <span className="font-bold">
                {config.showItemQuantity && (
                  <span className="ml-1 font-mono font-normal">{item.quantity}&times;</span>
                )}
                {item.name}
              </span>
              {config.showItemNotes && item.notes && (
                <span className="block text-[8px] text-zinc-500 truncate">*{item.notes}</span>
              )}
            </div>

            <div className="text-left font-mono font-bold whitespace-nowrap">
              {config.showItemTotal && formatReceiptCurrency(item.total)}
            </div>
          </div>
        ))}
      </div>

      {/* Dotted Separator */}
      <div className="border-b border-dotted border-zinc-400 my-1" />

      {/* Compact Totals Block */}
      <div className="text-[10px] space-y-0.5">
        {config.showSubtotal && (
          <div className="flex justify-between text-zinc-600">
            <span>المجموع:</span>
            <span className="font-mono">{formatReceiptCurrency(data.subtotal)}</span>
          </div>
        )}

        {config.showDiscount && data.discountAmount > 0 && (
          <div className="flex justify-between text-zinc-600">
            <span>خصم:</span>
            <span className="font-mono">-{formatReceiptCurrency(data.discountAmount)}</span>
          </div>
        )}

        {config.showDeliveryFee && data.deliveryFee > 0 && (
          <div className="flex justify-between text-zinc-600">
            <span>توصيل:</span>
            <span className="font-mono">+{formatReceiptCurrency(data.deliveryFee)}</span>
          </div>
        )}

        {config.showTax && data.taxAmount > 0 && (
          <div className="flex justify-between text-zinc-600">
            <span>ضريبة{data.taxRate !== undefined ? ` (${data.taxRate}%)` : ''}:</span>
            <span className="font-mono">+{formatReceiptCurrency(data.taxAmount)}</span>
          </div>
        )}

        {/* Compact Bold Total */}
        <div className="border-t border-black pt-0.5 mt-0.5 flex justify-between font-bold text-xs">
          <span>الإجمالي:</span>
          <span className="font-mono text-sm">{formatReceiptCurrency(data.total)}</span>
        </div>
      </div>

      {/* Compact Payment */}
      {data.payments && data.payments.length > 0 && (
        <div className="border-t border-dotted border-zinc-300 mt-1 pt-0.5 text-[9px] text-zinc-700">
          {data.payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{getPaymentMethodName(p.method)}</span>
              <span className="font-mono font-bold">{formatReceiptCurrency(p.amount)}</span>
              {p.method === 'CASH' && config.showChange && (p.changeAmount || 0) > 0 && (
                <span className="font-mono text-zinc-800">
                  (باقي: {formatReceiptCurrency(p.changeAmount!)})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Compact Footer */}
      {config.showFooter && (
        <div className="border-t border-dotted border-zinc-400 mt-1.5 pt-1 text-center text-[9px] text-zinc-600">
          {config.footerText && <p>{config.footerText}</p>}
          {config.showFooter2 && config.footerText2 && (
            <p className="text-[8px] text-zinc-500">{config.footerText2}</p>
          )}
        </div>
      )}
    </div>
  );
};
