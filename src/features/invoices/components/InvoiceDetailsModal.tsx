import { errorMessage } from '../../../utils/errors';
import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  Printer,
  Calendar,
  User,
  CreditCard,
  Banknote,
  UtensilsCrossed,
  Bike,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Receipt,
  LayoutList,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useAuth } from '../../auth/context/AuthContext';
import { InvoiceService } from '../services/InvoiceService';
import { PrinterService } from '../../hardware/services/PrinterService';
import { InvoiceDetailsDTO } from '../types';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { InvoiceDesignService } from '../design/services/InvoiceDesignService';
import { ThermalReceiptRenderer } from '../design/components/ThermalReceiptRenderer';
import { InvoiceDesignConfig } from '../design/types';
import { DEFAULT_INVOICE_DESIGN_CONFIG } from '../design/constants';
import { ReturnService } from '../../returns/services/ReturnService';

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string | null;
}

export const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  isOpen,
  onClose,
  invoiceId,
}) => {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<InvoiceDetailsDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reprinting, setReprinting] = useState<boolean>(false);
  const [reprintSuccess, setReprintSuccess] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'standard' | 'receipt'>('standard');
  const [designConfig, setDesignConfig] = useState<InvoiceDesignConfig>(DEFAULT_INVOICE_DESIGN_CONFIG);
  const [returnReason, setReturnReason] = useState('');
  const [returnMethod, setReturnMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [confirmCashOverdraw, setConfirmCashOverdraw] = useState(false);
  const [returning, setReturning] = useState(false);
  const returnService = React.useMemo(() => new ReturnService(), []);

  const invoiceService = React.useMemo(() => new InvoiceService(), []);
  const invoiceDesignService = React.useMemo(() => new InvoiceDesignService(), []);
  const printerService = React.useMemo(() => new PrinterService(), []);

  useEffect(() => {
    if (!isOpen || !invoiceId || !user) return;

    let isMounted = true;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        setReprintSuccess(false);
        const [details, config] = await Promise.all([
          invoiceService.getInvoiceWithDetails(user, invoiceId),
          invoiceDesignService.getConfig(),
        ]);
        if (isMounted) {
          setData(details);
          setDesignConfig(config);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(errorMessage(err, 'تعذر تحميل بيانات الفاتورة.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId, user, invoiceService, invoiceDesignService]);

  const handleReprint = async () => {
    if (!user || !data) return;
    try {
      setReprinting(true);
      setError(null);
      // Hardware print command
      const printRes = await printerService.printCustomerReceipt(user, data);

      // Record reprint audit
      await invoiceService.reprint(user, data.invoice.id);
      setReprintSuccess(true);

      // Update print count locally
      setData((prev) =>
        prev
          ? {
              ...prev,
              invoice: {
                ...prev.invoice,
                printed_count: prev.invoice.printed_count + 1,
                last_printed_at: new Date().toISOString(),
              },
            }
          : null
      );

      if (!printRes.success && printRes.error) {
        setError(`تنبيه عتاد: ${printRes.error}`);
      }
    } catch (err: unknown) {
      setError(errorMessage(err, 'تعذر تسجيل إعادة الطباعة'));
    } finally {
      setReprinting(false);
    }
  };

  const handleReturn = async () => {
    if (!user || !data) return;
    try {
      setReturning(true); setError(null);
      const items = data.items.filter((item) => item.product_id && (returnQty[item.id] || 0) > 0).map((item) => ({ orderItemId: item.id, productId: item.product_id as string, quantity: returnQty[item.id], restock: true }));
      await returnService.create(user, { invoiceId: data.invoice.id, items, reason: returnReason, refundMethod: returnMethod, confirmCashOverdraw });
      setReturnReason(''); setReturnQty({}); setConfirmCashOverdraw(false);
      setData((prev) => prev ? { ...prev, invoice: { ...prev.invoice, status: 'PARTIALLY_REFUNDED' } } : prev);
    } catch (err: unknown) { setError(errorMessage(err, 'تعذر تنفيذ المرتجع.')); }
    finally { setReturning(false); }
  };

  if (!isOpen) return null;

  return (
    <div
      id="invoice-details-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div
        id="invoice-details-modal-container"
        className="bg-white rounded-lg shadow-2xl border border-[#E2E8F0] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-[#EFF6FF] text-[#2563EB]">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <span>تفاصيل الفاتورة:</span>
                <span className="font-mono text-sm text-[#2563EB]">
                  {data?.invoice.invoice_number || invoiceId}
                </span>
              </h2>
              <p className="text-xs text-[#64748B]">سجل مالي غير قابل للتعديل (Immutable)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            {data && (
              <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-md border border-[#E2E8F0] text-xs">
                <button
                  type="button"
                  id="btn-invoice-view-standard"
                  onClick={() => setViewMode('standard')}
                  className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'standard'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <LayoutList size={13} />
                  <span>عرض تفصيلي</span>
                </button>
                <button
                  type="button"
                  id="btn-invoice-view-receipt"
                  onClick={() => setViewMode('receipt')}
                  className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'receipt'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <Receipt size={13} />
                  <span>معاينة الإيصال الحراري</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-md hover:bg-[#F1F5F9] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-[#64748B]">جاري استرجاع تفاصيل الفاتورة...</div>
          ) : error ? (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-[#DC2626] flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : data && viewMode === 'receipt' ? (
            <div className="bg-[#EEF3F9] p-4 sm:p-6 rounded-lg border border-[#D1D5DB] flex flex-col items-center justify-start overflow-y-auto max-h-[70vh] shadow-inner">
              <ThermalReceiptRenderer
                data={invoiceDesignService.mapDetailsToReceipt(data)}
                config={designConfig}
                showTearEdges={true}
              />
            </div>
          ) : data ? (
            <>
              {hasPermission('returns.create') && data.invoice.status !== 'REFUNDED' && (
                <div className="border border-orange-200 bg-orange-50 rounded-md p-3 flex flex-col gap-2">
                  <strong className="text-orange-800">مرتجع جزئي أو كلي</strong>
                  {data.items.map((item) => item.product_id && <label key={item.id} className="flex items-center gap-2"><span className="flex-1">{item.product_name_snapshot} (المباع: {item.quantity})</span><input type="number" min="0" max={item.quantity} className="w-20 h-8 border rounded px-2" value={returnQty[item.id] || ''} onChange={(e) => setReturnQty({ ...returnQty, [item.id]: Math.min(item.quantity, Number(e.target.value) || 0) })} /></label>)}
                  <input className="h-8 border rounded px-2" placeholder="سبب المرتجع (إلزامي)" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
                  {returnMethod === 'CASH' && hasPermission('returns.refund') && <label className="flex items-center gap-2 text-orange-900"><input type="checkbox" checked={confirmCashOverdraw} onChange={(event) => setConfirmCashOverdraw(event.target.checked)} />تأكيد مسؤول عند تجاوز النقدية المتاحة</label>}
                  <div className="flex gap-2"><select className="h-8 border rounded px-2" value={returnMethod} onChange={(e) => { setReturnMethod(e.target.value as 'CASH' | 'CARD'); setConfirmCashOverdraw(false); }}><option value="CASH">رد نقدي</option><option value="CARD">رد إلى البطاقة</option></select><Button size="sm" onClick={() => void handleReturn()} disabled={returning}>{returning ? 'جارٍ التنفيذ...' : 'تنفيذ المرتجع'}</Button></div>
                </div>
              )}

              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#F8FAFC] p-3.5 rounded-md border border-[#E2E8F0]">
                <div>
                  <span className="text-[#64748B] block text-[11px]">رقم الطلب:</span>
                  <span className="font-bold text-[#0F172A] font-mono">{data.order.order_number}</span>
                </div>

                <div>
                  <span className="text-[#64748B] block text-[11px]">تاريخ ووقت الإصدار:</span>
                  <span className="font-medium text-[#0F172A] tabular-nums">
                    {formatDateTime(data.invoice.created_at)}
                  </span>
                </div>

                <div>
                  <span className="text-[#64748B] block text-[11px]">الكاشير:</span>
                  <span className="font-medium text-[#0F172A]">
                    {data.invoice.cashier_name_snapshot}
                  </span>
                </div>

                <div>
                  <span className="text-[#64748B] block text-[11px]">نوع الطلب:</span>
                  <span className="font-medium text-[#0F172A]">
                    {data.order.order_type === 'DINE_IN'
                      ? `صالة ${data.order.table_number ? `(طاولة ${data.order.table_number})` : ''}`
                      : data.order.order_type === 'TAKEAWAY'
                      ? 'سفري'
                      : 'توصيل'}
                  </span>
                </div>

                <div>
                  <span className="text-[#64748B] block text-[11px]">العميل:</span>
                  <span className="font-medium text-[#0F172A]">
                    {data.invoice.customer_name_snapshot || 'عميل نقدي مباشر'}
                  </span>
                </div>

                <div>
                  <span className="text-[#64748B] block text-[11px]">حالة الفاتورة:</span>
                  <Badge variant={data.invoice.status === 'PAID' ? 'success' : 'danger'} size="sm">
                    {data.invoice.status === 'PAID' ? 'مدفوعة ومسددة' : data.invoice.status}
                  </Badge>
                </div>
              </div>

              {/* Items Table Snapshot */}
              <div>
                <h3 className="font-bold text-[#0F172A] mb-2">الأصناف المسددة (اللقطة السعرية المحفوظة):</h3>
                <div className="border border-[#E2E8F0] rounded-md overflow-hidden">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-[#F1F5F9] text-[#475569] font-bold text-[11px]">
                      <tr>
                        <th className="py-2 px-3">الصنف</th>
                        <th className="py-2 px-3 text-center">الكمية</th>
                        <th className="py-2 px-3 text-left">سعر الوحدة</th>
                        <th className="py-2 px-3 text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {data.items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F8FAFC]">
                          <td className="py-2 px-3 font-medium text-[#0F172A]">
                            {item.product_name_snapshot}
                            {item.notes && (
                              <span className="block text-[10px] text-[#64748B]">
                                ملاحظة: {item.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-bold font-mono">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-left font-mono text-[#475569]">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-2 px-3 text-left font-bold font-mono text-[#0F172A]">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals Calculation Summary */}
              <div className="bg-[#F8FAFC] p-3.5 rounded-md border border-[#E2E8F0] flex flex-col gap-1.5 font-mono">
                <div className="flex justify-between text-[#475569]">
                  <span>المجموع الفرعي:</span>
                  <span>{formatCurrency(data.invoice.total_amount)}</span>
                </div>
                {data.invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-[#DC2626]">
                    <span>الخصم المطبق:</span>
                    <span>-{formatCurrency(data.invoice.discount_amount)}</span>
                  </div>
                )}
                {data.order.delivery_fee > 0 && (
                  <div className="flex justify-between text-[#475569]">
                    <span>رسوم التوصيل:</span>
                    <span>+{formatCurrency(data.order.delivery_fee)}</span>
                  </div>
                )}
                {data.invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-[#475569]">
                    <span>ضريبة القيمة المضافة:</span>
                    <span>+{formatCurrency(data.invoice.tax_amount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-[#D8E3F0] flex justify-between text-sm font-bold text-[#0F172A]">
                  <span>صافي الإجمالي المدفوع:</span>
                  <span>{formatCurrency(data.invoice.net_amount)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div>
                <h3 className="font-bold text-[#0F172A] mb-2">طرق السداد المعتمدة:</h3>
                <div className="flex flex-col gap-2">
                  {data.payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {p.payment_method === 'CASH' ? (
                          <Banknote size={16} className="text-[#16A34A]" />
                        ) : (
                          <CreditCard size={16} className="text-[#2563EB]" />
                        )}
                        <span className="font-bold text-[#0F172A]">
                          {p.payment_method === 'CASH' ? 'نقدي (Cash)' : 'بطاقة (Card)'}
                        </span>
                        {p.reference_number && (
                          <span className="text-[10px] text-[#64748B] font-mono">
                            مرجع: {p.reference_number}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 font-mono">
                        <div>
                          <span className="text-[10px] text-[#64748B] block">المسدد:</span>
                          <span className="font-bold text-[#0F172A]">{formatCurrency(p.amount)}</span>
                        </div>
                        {p.payment_method === 'CASH' && (
                          <>
                            <div>
                              <span className="text-[10px] text-[#64748B] block">المستلم:</span>
                              <span className="text-[#475569]">{formatCurrency(p.tender_amount)}</span>
                            </div>
                            {p.change_amount > 0 && (
                              <div>
                                <span className="text-[10px] text-[#16A34A] block">الباقي:</span>
                                <span className="font-bold text-[#16A34A]">
                                  {formatCurrency(p.change_amount)}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Print Stats */}
              <div className="text-[11px] text-[#64748B] flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
                <span>مرات الطباعة المسجلة: {data.invoice.printed_count}</span>
                {data.invoice.last_printed_at && (
                  <span>آخر طباعة: {formatDateTime(data.invoice.last_printed_at)}</span>
                )}
              </div>

              {reprintSuccess && (
                <div className="p-2.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>تم توثيق إعادة طباعة الفاتورة بنجاح في سجل التدقيق.</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <Button variant="secondary" onClick={onClose} className="h-10 px-4 text-xs font-bold">
            إغلاق
          </Button>

          {hasPermission('pos.reprint_receipt') && data && (
            <Button
              id="btn-reprint-invoice"
              variant="primary"
              onClick={handleReprint}
              disabled={reprinting}
              className="h-10 px-5 text-xs font-bold flex items-center gap-2"
            >
              <Printer size={15} />
              <span>{reprinting ? 'جاري التوثيق...' : 'توثيق طباعة نسخة'}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
