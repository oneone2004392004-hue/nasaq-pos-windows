import { errorMessage } from '../../../utils/errors';
import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../auth/context/AuthContext';
import { CashRegisterService } from '../services/CashRegisterService';
import { MinusCircle, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string | null;
  availableCashMinor: number;
  onWithdrawSuccess: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  shiftId,
  availableCashMinor,
  onWithdrawSuccess,
}) => {
  const { user } = useAuth();
  const [amountInput, setAmountInput] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cashService = React.useMemo(() => new CashRegisterService(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsed = parseFloat(amountInput);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMessage('يرجى إدخال مبلغ سحب صحيح أكبر من صفر.');
      return;
    }

    const minorUnits = Math.round(parsed * 100);

    if (minorUnits > availableCashMinor) {
      setErrorMessage(
        `المبلغ المطلوب سحبه (${formatCurrency(minorUnits)}) يتجاوز رصيد النقدية المتاح بالدرج (${formatCurrency(availableCashMinor)}).`
      );
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('بيان سبب السحب إلزامي لأغراض الرقابة المالية.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await cashService.withdraw(user, {
        amount: minorUnits,
        reason: reason.trim(),
        shiftId: shiftId || undefined,
      });

      setAmountInput('');
      setReason('');
      onWithdrawSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(errorMessage(err, 'تعذر تسجيل حركة سحب النقدية'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="سحب نقدية من درج الكاشير (-)"
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-right" dir="rtl">
        {errorMessage && (
          <div className="p-3 bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] rounded-md text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="bg-[#F5F8FC] p-3 rounded-md border border-[#E8EEF6] text-xs flex justify-between items-center">
          <span className="text-[#61748D]">الرصيد المتاح حالياً بالدرج:</span>
          <span className="font-mono font-bold text-sm text-[#132238] tabular-nums">
            {formatCurrency(availableCashMinor)}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            مبلغ السحب النقدي (ج.م) *
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.25"
              min="0.25"
              max={availableCashMinor / 100}
              required
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.00"
              className="font-mono text-base font-bold pr-10"
              autoFocus
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-[#D9534F]">
              <MinusCircle size={18} />
            </div>
          </div>
          <p className="text-[11px] text-[#8291A5] mt-1">
            مثال: توريد نقدي للخزينة الرئيسية أو سحب أرباح مؤقتة
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            سبب / بيان السحب *
          </label>
          <Input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: توريد جزء من السيولة للخزينة المركزية"
            className="text-xs"
          />
        </div>

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
            disabled={submitting}
          >
            {submitting ? 'جاري التسجيل...' : 'تأكيد السحب من الدرج'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
