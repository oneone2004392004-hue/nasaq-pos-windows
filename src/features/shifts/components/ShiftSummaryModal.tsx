import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useAuth } from '../../auth/context/AuthContext';
import { ShiftService } from '../services/ShiftService';
import { ShiftSummary } from '../types';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import {
  FileText,
  Printer,
  TrendingUp,
  CreditCard,
  Banknote,
  MinusCircle,
  PlusCircle,
  Clock,
  User,
  AlertCircle,
  Receipt,
} from 'lucide-react';

interface ShiftSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string | null;
}

export const ShiftSummaryModal: React.FC<ShiftSummaryModalProps> = ({
  isOpen,
  onClose,
  shiftId,
}) => {
  const { user } = useAuth();
  const shiftService = useMemo(() => new ShiftService(), []);

  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && shiftId && user) {
      setLoading(true);
      setErrorMessage(null);

      shiftService
        .getShiftSummary(user, shiftId)
        .then((res) => setSummary(res))
        .catch((err) => setErrorMessage(err?.message || 'تعذر تحميل ملخص الوردية'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, shiftId, user, shiftService]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`تقرير وملخص الوردية ${summary?.shift.shift_number || ''}`}
      size="lg"
    >
      <div className="flex flex-col gap-4 text-right" dir="rtl">
        {errorMessage && (
          <div className="p-3 bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] rounded-md text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[#61748D]">
            <div className="w-7 h-7 rounded-full border-2 border-[#1464D9] border-t-transparent animate-spin" />
            <span>جاري استرجاع بيانات التدقيق المالي للوردية...</span>
          </div>
        ) : summary ? (
          <>
            {/* Header info */}
            <div className="bg-[#F5F8FC] p-3 rounded-md border border-[#E8EEF6] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[#52657D]">
                  <User size={14} />
                  <span>الكاشير: <strong>{summary.cashierName}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[#52657D]">
                  <Clock size={14} />
                  <span>المدة: <strong>{summary.durationMinutes} دقيقة</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={summary.status === 'OPEN' ? 'success' : 'neutral'} size="sm">
                  {summary.status === 'OPEN' ? 'وردية مفتوحة' : 'وردية مغلقة'}
                </Badge>
                {summary.varianceType !== 'PENDING' && (
                  <Badge
                    variant={
                      summary.varianceType === 'BALANCED'
                        ? 'success'
                        : summary.varianceType === 'OVERAGE'
                        ? 'neutral'
                        : 'danger'
                    }
                    size="sm"
                  >
                    {summary.varianceType === 'BALANCED'
                      ? 'الدرج متطابق'
                      : summary.varianceType === 'OVERAGE'
                      ? 'زيادة بالدرج'
                      : 'عجز بالدرج'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-2 text-xs text-[#61748D] bg-white p-2.5 rounded border border-[#E8EEF6]">
              <div>
                <span>وقت الافتتاح: </span>
                <span className="font-mono tabular-nums text-[#132238]">
                  {formatDateTime(summary.shift.opened_at)}
                </span>
              </div>
              <div>
                <span>وقت الإغلاق: </span>
                <span className="font-mono tabular-nums text-[#132238]">
                  {summary.shift.closed_at ? formatDateTime(summary.shift.closed_at) : 'مستمرة حتى الآن'}
                </span>
              </div>
            </div>

            {/* Key Figures Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3 rounded border border-[#E8EEF6]">
                <div className="flex items-center justify-between text-[#61748D] text-xs">
                  <span>العهدة الافتتاحية</span>
                  <Banknote size={14} />
                </div>
                <div className="text-sm font-bold font-mono text-[#132238] tabular-nums mt-1">
                  {formatCurrency(summary.openingCash)}
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-[#E8EEF6]">
                <div className="flex items-center justify-between text-[#61748D] text-xs">
                  <span>المبيعات النقدية</span>
                  <TrendingUp size={14} className="text-[#3C8D67]" />
                </div>
                <div className="text-sm font-bold font-mono text-[#3C8D67] tabular-nums mt-1">
                  +{formatCurrency(summary.cashSales)}
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-[#E8EEF6]">
                <div className="flex items-center justify-between text-[#61748D] text-xs">
                  <span>مبيعات الشبكة / الفيزا</span>
                  <CreditCard size={14} className="text-[#1464D9]" />
                </div>
                <div className="text-sm font-bold font-mono text-[#1464D9] tabular-nums mt-1">
                  {formatCurrency(summary.cardSales)}
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-[#E8EEF6]">
                <div className="flex items-center justify-between text-[#61748D] text-xs">
                  <span>إجمالي المبيعات</span>
                  <Receipt size={14} />
                </div>
                <div className="text-sm font-bold font-mono text-[#132238] tabular-nums mt-1">
                  {formatCurrency(summary.totalSales)}
                </div>
              </div>
            </div>

            {/* Secondary Ledger Figures */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-[#FBFBFB] p-2.5 rounded border border-[#ECECEC] text-xs">
                <span className="text-[#61748D] block">إيداعات نقدية (+)</span>
                <span className="font-bold font-mono text-[#3C8D67] tabular-nums mt-0.5 block">
                  +{formatCurrency(summary.deposits)}
                </span>
              </div>
              <div className="bg-[#FBFBFB] p-2.5 rounded border border-[#ECECEC] text-xs">
                <span className="text-[#61748D] block">مسحوبات نقدية (-)</span>
                <span className="font-bold font-mono text-[#D9534F] tabular-nums mt-0.5 block">
                  -{formatCurrency(summary.withdrawals)}
                </span>
              </div>
              <div className="bg-[#FBFBFB] p-2.5 rounded border border-[#ECECEC] text-xs">
                <span className="text-[#61748D] block">مصروفات من الدرج (-)</span>
                <span className="font-bold font-mono text-[#D9534F] tabular-nums mt-0.5 block">
                  -{formatCurrency(summary.cashExpenses)}
                </span>
              </div>
            </div>

            {/* Reconciliation Box */}
            <div className="p-3.5 bg-[#F4F6F8] rounded-md border border-[#D8DEE4] flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-[#31445D]">الرصيد الدفتري المتوقع بالدرج:</span>
                <span className="font-bold font-mono text-sm tabular-nums text-[#132238]">
                  {formatCurrency(summary.expectedCash)}
                </span>
              </div>

              {summary.actualCash !== null && (
                <div className="flex justify-between items-center py-1 border-t border-[#E0E5EA]">
                  <span className="text-[#31445D]">الرصيد الفعلي المجرود:</span>
                  <span className="font-bold font-mono text-sm tabular-nums text-[#132238]">
                    {formatCurrency(summary.actualCash)}
                  </span>
                </div>
              )}

              {summary.variance !== null && (
                <div className="flex justify-between items-center py-1.5 border-t border-[#E0E5EA] font-semibold">
                  <span>فارق التسوية (عجز / زيادة):</span>
                  <span
                    className={`font-mono text-base font-bold tabular-nums ${
                      summary.variance === 0
                        ? 'text-[#166534]'
                        : summary.variance < 0
                        ? 'text-[#991B1B]'
                        : 'text-[#1E40AF]'
                    }`}
                  >
                    {formatCurrency(summary.variance)}
                  </span>
                </div>
              )}
            </div>

            {/* Volume Stats */}
            <div className="flex items-center justify-between text-xs text-[#8291A5] px-1">
              <span>عدد الفواتير الصادرة: <strong>{summary.invoicesCount}</strong></span>
              <span>عدد الطلبات: <strong>{summary.ordersCount}</strong></span>
            </div>

            {summary.shift.notes && (
              <div className="text-xs bg-white p-2.5 rounded border border-[#E8EEF6]">
                <span className="text-[#8291A5] block mb-0.5">ملاحظات الوردية:</span>
                <span className="text-[#333333]">{summary.shift.notes}</span>
              </div>
            )}
          </>
        ) : null}

        <div className="flex items-center justify-between pt-3 border-t border-[#E8EEF6]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            disabled={!summary}
            className="flex items-center gap-1.5"
          >
            <Printer size={14} />
            <span>طباعة التقرير</span>
          </Button>

          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
};
