import { errorMessage } from '../../../utils/errors';
import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../auth/context/AuthContext';
import { CashRegisterService } from '../services/CashRegisterService';
import { PlusCircle, AlertCircle } from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string | null;
  onDepositSuccess: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  shiftId,
  onDepositSuccess,
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
      setErrorMessage('يرجى إدخال مبلغ إيداع صحيح أكبر من صفر.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('بيان سبب الإيداع إلزامي لأغراض التدقيق المالي.');
      return;
    }

    const minorUnits = Math.round(parsed * 100);

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await cashService.deposit(user, {
        amount: minorUnits,
        reason: reason.trim(),
        shiftId: shiftId || undefined,
      });

      setAmountInput('');
      setReason('');
      onDepositSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(errorMessage(err, 'تعذر تسجيل حركة الإيداع النقدي'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إيداع نقدية في درج الكاشير (+)"
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-right" dir="rtl">
        {errorMessage && (
          <div className="p-3 bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] rounded-md text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            مبلغ الإيداع النقدي (ج.م) *
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.25"
              min="0.25"
              required
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.00"
              className="font-mono text-base font-bold pr-10"
              autoFocus
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-[#3C8D67]">
              <PlusCircle size={18} />
            </div>
          </div>
          <p className="text-[11px] text-[#8291A5] mt-1">
            مثال: إضافة فكة سيولة نقدية أو تغذية الدرج من الخزينة الرئيسية
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            سبب / بيان الإيداع *
          </label>
          <Input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: إضافة فكة 100 ج.م فئات صغيرة من الإدارة"
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
            variant="primary"
            size="sm"
            disabled={submitting}
          >
            {submitting ? 'جاري التسجيل...' : 'تأكيد الإيداع بالدرج'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
