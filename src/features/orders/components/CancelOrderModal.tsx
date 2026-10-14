import { errorMessage } from '../../../utils/errors';
/**
 * NASAQ POS — Cancel Order Confirmation Modal (Phase 6)
 * Soft cancellation with audit log. No hard delete.
 */

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { OrderListItemDTO } from '../types';
import { formatCurrency } from '../../../utils/formatters';

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderListItemDTO | null;
  onConfirm: (orderId: string, reason: string) => Promise<void>;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  onConfirm,
}) => {
  const [reason, setReason] = useState('إلغاء بناء على رغبة العميل');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await onConfirm(order.id, reason.trim() || 'إلغاء يدوي من الكاشير');
      onClose();
    } catch (err: unknown) {
      setError(errorMessage(err, 'تعذر إلغاء الطلب'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl w-full max-w-md overflow-hidden text-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0] bg-[#FEF2F2]">
          <div className="flex items-center gap-2 text-[#991B1B]">
            <AlertTriangle size={20} className="text-[#DC2626]" />
            <h3 className="text-sm font-bold">تأكيد إلغاء الطلب المعلق</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A] p-1 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5">
          <div className="p-3 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] text-xs text-[#334155] space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#64748B]">رقم الطلب:</span>
              <span className="font-bold text-[#0F172A]">{order.order_number}</span>
            </div>
            {order.table_number && (
              <div className="flex justify-between">
                <span className="text-[#64748B]">الطاولة:</span>
                <span className="font-semibold">{order.table_number}</span>
              </div>
            )}
            {order.customer_name && (
              <div className="flex justify-between">
                <span className="text-[#64748B]">العميل:</span>
                <span className="font-semibold">{order.customer_name}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#E2E8F0] pt-1 mt-1">
              <span className="text-[#64748B]">إجمالي الطلب:</span>
              <span className="font-bold text-[#0F172A]">{formatCurrency(order.total)}</span>
            </div>
          </div>

          <div className="text-xs text-[#64748B] leading-relaxed">
            تنبيه: سيتم تحويل حالة الطلب إلى <strong className="text-[#DC2626]">ملغي (CANCELLED)</strong> وتحرير الطاولة المرتبطة به. لن يتم حذف السجل من قاعدة البيانات حفاظاً على النزاهة التدقيقية.
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cancel-reason-input" className="text-xs font-semibold text-[#334155]">
              سبب الإلغاء (اختياري):
            </label>
            <Input
              id="cancel-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب سبب إلغاء الطلب..."
              className="text-xs h-9"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-2.5 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded">
              {error}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <Button
              id="btn-cancel-modal-back"
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              تراجع
            </Button>
            <Button
              id="btn-cancel-modal-confirm"
              type="submit"
              variant="danger"
              size="sm"
              disabled={loading}
              className="font-bold"
            >
              {loading ? 'جاري الإلغاء...' : 'تأكيد إلغاء الطلب'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
