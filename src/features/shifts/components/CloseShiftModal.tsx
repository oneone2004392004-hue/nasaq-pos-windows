import { errorMessage } from '../../../utils/errors';
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../auth/context/AuthContext';
import { ShiftService } from '../services/ShiftService';
import { CashShiftRow } from '../../../domain/dbModels';
import { formatCurrency } from '../../../utils/formatters';
import { AlertTriangle, CheckCircle2, AlertCircle, Calculator } from 'lucide-react';
import { PendingShiftOrder } from '../services/ShiftService';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: CashShiftRow | null;
  onShiftClosed: () => void;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  shift,
  onShiftClosed,
}) => {
  const { user } = useAuth();
  const shiftService = useMemo(() => new ShiftService(), []);

  const [expectedCash, setExpectedCash] = useState<number>(0);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loadingExpected, setLoadingExpected] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingShiftOrder[]>([]);
  const [confirmPendingOrders, setConfirmPendingOrders] = useState(false);

  // Load current calculated expected cash whenever modal opens
  useEffect(() => {
    if (isOpen && shift) {
      setLoadingExpected(true);
      setErrorMessage(null);
      setConfirmPendingOrders(false);
      Promise.all([
        shiftService.calculateExpectedCash(shift.id),
        user ? shiftService.listPendingOrdersForShift(user, shift.id) : Promise.resolve([]),
      ])
        .then(([exp, pending]) => {
          setExpectedCash(exp);
          setPendingOrders(pending);
          // Default actual cash input to empty for blind/honest cash counting
          setActualCashInput('');
        })
        .catch((err) => {
          setErrorMessage(errorMessage(err, 'تعذر حساب رصيد الدرج المتوقع'));
        })
        .finally(() => {
          setLoadingExpected(false);
        });
    }
  }, [isOpen, shift, shiftService, user]);

  const parsedActualCash = parseFloat(actualCashInput || '0');
  const actualMinor = isNaN(parsedActualCash) ? 0 : Math.round(parsedActualCash * 100);
  const difference = actualMinor - expectedCash;

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !shift) return;

    if (isNaN(parsedActualCash) || parsedActualCash < 0) {
      setErrorMessage('يرجى إدخال مبلغ نقدية فعلي صحيح تم جَرْدُه.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await shiftService.closeShift(user, {
        shiftId: shift.id,
        actualCash: actualMinor,
        notes: notes.trim() || undefined,
        confirmPendingOrders,
      });

      onShiftClosed();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(errorMessage(err, 'تعذر إغلاق الوردية'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`إغلاق الوردية وجرد النقدية (${shift?.shift_number || ''})`}
      size="md"
    >
      <form onSubmit={handleCloseShift} className="flex flex-col gap-4 text-right" dir="rtl">
        {errorMessage && (
          <div className="p-3 bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] rounded-md text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {pendingOrders.length > 0 && (
          <section className="rounded-md border border-amber-300 bg-amber-50 p-3" aria-label="الطلبات المعلقة">
            <h3 className="mb-2 text-sm font-bold text-amber-950">طلبات تمنع إغلاق الوردية</h3>
            <ul className="max-h-40 space-y-2 overflow-y-auto text-xs text-amber-950">
              {pendingOrders.map((order) => (
                <li key={order.id} className="border-b border-amber-200 pb-2 last:border-0">
                  <span className="font-bold">{order.order_number}</span>
                  {' — '}{order.order_type}{' — الطاولة: '}{order.table_number || '—'}
                  {' — الإجمالي: '}{formatCurrency(order.total)}
                </li>
              ))}
            </ul>
            {user && (user.permissions.includes('shifts.view_all') || user.permissions.includes('orders.manage') || user.roleCode === 'ADMIN' || user.roleCode === 'MANAGER') ? (
              <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-amber-200 pt-3 text-xs font-semibold">
                <input type="checkbox" checked={confirmPendingOrders} onChange={(event) => setConfirmPendingOrders(event.target.checked)} />
                إلغاء الطلبات تلقائياً بسبب إغلاق الوردية، وتحرير الطاولات والمخزون.
              </label>
            ) : <p className="mt-3 border-t border-amber-200 pt-3 text-xs">اطلب من مدير إلغاء الطلبات قبل إغلاق الوردية.</p>}
          </section>
        )}

        {/* Shift Financial Overview */}
        <div className="grid grid-cols-2 gap-2 bg-[#F5F8FC] p-3 rounded-md border border-[#E8EEF6] text-xs">
          <div>
            <span className="text-[#8291A5] block">رصيد الافتتاح:</span>
            <span className="font-bold text-[#132238] font-mono tabular-nums">
              {formatCurrency(shift?.opening_cash || 0)}
            </span>
          </div>
          <div>
            <span className="text-[#8291A5] block">الرصيد الدفتري المتوقع بالدرج:</span>
            <span className="font-bold text-[#132238] font-mono tabular-nums text-sm">
              {loadingExpected ? 'جاري الحساب...' : formatCurrency(expectedCash)}
            </span>
          </div>
        </div>

        {/* Actual Count Input */}
        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            المبلغ الفعلي المجرود بالدرج (ج.م) *
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.25"
              min="0"
              required
              value={actualCashInput}
              onChange={(e) => setActualCashInput(e.target.value)}
              placeholder="أدخل المبلغ بعد الجرد الفعلي..."
              className="font-mono text-base font-bold pr-10"
              autoFocus
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-[#92A0B2]">
              <Calculator size={18} />
            </div>
          </div>
          <p className="text-[11px] text-[#8291A5] mt-1">
            قم بعدّ جميع الأوراق والنقود المعدنية داخل الدرج بدقة قبل الإدخال.
          </p>
        </div>

        {/* Real-time Variance Preview */}
        {actualCashInput !== '' && (
          <div
            className={`p-3 rounded-md border text-xs flex items-center justify-between ${
              difference === 0
                ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                : difference < 0
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]'
            }`}
          >
            <div className="flex items-center gap-2">
              {difference === 0 ? (
                <CheckCircle2 size={18} className="text-[#16A34A]" />
              ) : (
                <AlertTriangle size={18} className={difference < 0 ? 'text-[#DC2626]' : 'text-[#2563EB]'} />
              )}
              <span className="font-semibold">
                {difference === 0
                  ? 'الخزينة متطابقة تماماً (لا يوجد فرق)'
                  : difference < 0
                  ? 'يوجد عجز نقدي في الدرج'
                  : 'توجد زيادة نقدية في الدرج'}
              </span>
            </div>
            <span className="font-mono font-bold text-sm tabular-nums" dir="ltr">
              {formatCurrency(difference)}
            </span>
          </div>
        )}

        {/* Closing Notes */}
        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            ملاحظات الإغلاق والتسوية (اختياري)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مبررات الفروقات إن وُجدت أو أية ملاحظات ختامية..."
            className="w-full text-xs p-2.5 rounded-md border border-[#D8E3F0] focus:outline-none focus:border-[#1464D9] focus:ring-1 focus:ring-[#1464D9] bg-white min-h-[70px]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8EEF6]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="sm"
            disabled={submitting || actualCashInput === '' || (pendingOrders.length > 0 && !confirmPendingOrders)}
          >
            {submitting ? 'جاري الإغلاق والتسوية...' : 'تأكيد إغلاق الوردية'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
