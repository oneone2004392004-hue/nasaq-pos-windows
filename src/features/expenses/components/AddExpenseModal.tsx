import { errorMessage } from '../../../utils/errors';
import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../auth/context/AuthContext';
import { ExpenseService } from '../services/ExpenseService';
import { MinusCircle, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseCreated: () => void;
}

const EXPENSE_CATEGORIES = [
  'نثريات وتشغيل',
  'أدوات تعبئة وتغليف',
  'نظافة ومطهرات',
  'صيانة وتصليح',
  'نقل ومشاوير ومواصلات',
  'ضيافة ومأكولات',
  'أخرى',
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onExpenseCreated,
}) => {
  const { user } = useAuth();
  const expenseService = React.useMemo(() => new ExpenseService(), []);

  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amountInput, setAmountInput] = useState<string>('');
  const [paidFromCashDrawer, setPaidFromCashDrawer] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsed = parseFloat(amountInput);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMessage('يرجى إدخال مبلغ مصروف صحيح أكبر من صفر.');
      return;
    }

    const minorUnits = Math.round(parsed * 100);

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await expenseService.createExpense(user, {
        category,
        amount: minorUnits,
        paidFromCashDrawer,
        notes: notes.trim() || undefined,
      });

      setAmountInput('');
      setNotes('');
      onExpenseCreated();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(errorMessage(err, 'تعذر تسجيل المصروف'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل مصروف يومي جديد"
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
            بند المصروف *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-xs p-2.5 rounded-md border border-[#D8E3F0] bg-white focus:outline-none focus:border-[#1464D9]"
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            مبلغ المصروف (ج.م) *
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
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-[#D9534F]">
              <MinusCircle size={18} />
            </div>
          </div>
        </div>

        <div className="bg-[#F5F8FC] p-3 rounded-md border border-[#E8EEF6] flex items-center gap-3">
          <input
            type="checkbox"
            id="paidFromCashDrawer"
            checked={paidFromCashDrawer}
            onChange={(e) => setPaidFromCashDrawer(e.target.checked)}
            className="w-4 h-4 rounded text-[#132238] cursor-pointer"
          />
          <label htmlFor="paidFromCashDrawer" className="text-xs text-[#333333] cursor-pointer select-none">
            خصم المصروف مباشرة من درج الكاشير للوردية الحالية
          </label>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#31445D] mb-1">
            البيان / ملاحظات المصروف (اختياري)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="تفاصيل ما تم شراؤه أو رقم الفاتورة الورقية..."
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
            {submitting ? 'جاري التسجيل...' : 'تأكيد تسجيل المصروف'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
