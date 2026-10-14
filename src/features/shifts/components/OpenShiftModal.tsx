import { errorMessage } from '../../../utils/errors';
import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../auth/context/AuthContext';
import { ShiftService } from '../services/ShiftService';
import { formatCurrency } from '../../../utils/formatters';
import { Banknote, AlertCircle } from 'lucide-react';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftOpened: () => void;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  isOpen,
  onClose,
  onShiftOpened,
}) => {
  const { user } = useAuth();
  const [openingCashInput, setOpeningCashInput] = useState<string>('500.00');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shiftService = React.useMemo(() => new ShiftService(), []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsedCash = parseFloat(openingCashInput);
    if (isNaN(parsedCash) || parsedCash < 0) {
      setErrorMessage('يرجى إدخال مبلغ عهدة افتتاحية صالح.');
      return;
    }

    const minorUnits = Math.round(parsedCash * 100);

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await shiftService.openShift(user, {
        openingCash: minorUnits,
        notes: notes.trim() || undefined,
      });

      onShiftOpened();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(errorMessage(err, 'تعذر فتح الوردية'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="فتح وردية نقدية جديدة"
      size="md"
    >
      <form onSubmit={handleOpenShift} className="flex flex-col gap-4 text-right" dir="rtl">
        {errorMessage && (
          <div className="p-3 bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] rounded-md text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="bg-[#F5F8FC] p-3 rounded-md border border-[#E8EEF6] text-xs text-[#52657D]">
          <div className="flex justify-between items-center py-1">
            <span>الكاشير المسؤول:</span>
            <span className="font-bold text-[#132238]">{user?.name}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-t border-[#EEF3F9] mt-1">
            <span>وقت الافتتاح:</span>
            <span className="font-mono text-[#61748D]">{new Date().toLocaleTimeString('ar-EG')}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            مبلغ العهدة الافتتاحية بالدرج (ج.م) *
          </label>
          <div className="relative">
            <Input
              type="number"
              step="0.25"
              min="0"
              required
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(e.target.value)}
              placeholder="0.00"
              className="font-mono text-base font-bold pr-10"
              autoFocus
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-[#92A0B2]">
              <Banknote size={18} />
            </div>
          </div>
          <p className="text-[11px] text-[#8291A5] mt-1">
            المبلغ الفعلي للنقدية الموجودة بالدرج كفكة في بداية العمل
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            ملاحظات افتتاح الوردية (اختياري)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي ملاحظات حول العهدة أو الفكة..."
            className="w-full text-xs p-2.5 rounded-md border border-[#D8E3F0] focus:outline-none focus:border-[#1464D9] focus:ring-1 focus:ring-[#1464D9] bg-white min-h-[70px]"
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
            {submitting ? 'جاري فتح الوردية...' : 'تأكيد فتح الوردية'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
