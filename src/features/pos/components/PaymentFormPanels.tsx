import React, { RefObject } from 'react';
import { Banknote, CreditCard } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { formatCurrency } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';

interface CashPaymentPanelProps {
  cashReceivedMajor: string;
  setCashReceivedMajor: (value: string) => void;
  cashInputRef: RefObject<HTMLInputElement | null>;
  isCashSufficient: boolean;
  isProcessing: boolean;
  handleExecutePayment: () => Promise<void>;
  handleSetExactCash: () => void;
  handleQuickAdd: (amountMajor: number) => void;
  cashChangeMinor: number;
  cashReceivedMinor: number;
  totalMinor: number;
}

export const CashPaymentPanel: React.FC<CashPaymentPanelProps> = ({
  cashReceivedMajor,
  setCashReceivedMajor,
  cashInputRef,
  isCashSufficient,
  isProcessing,
  handleExecutePayment,
  handleSetExactCash,
  handleQuickAdd,
  cashChangeMinor,
  cashReceivedMinor,
  totalMinor,
}) => (
  <div className="p-6 flex flex-col gap-4">
    <div>
      <label className="block text-xs font-bold text-[#334155] mb-1.5">
        المبلغ المستلم من العميل (ج.م)
      </label>
      <div className="relative">
        <Input
          ref={cashInputRef}
          id="input-cash-tender"
          type="number"
          step="any"
          min="0"
          value={cashReceivedMajor}
          onChange={(e) => setCashReceivedMajor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isCashSufficient && !isProcessing) {
              e.preventDefault();
              void handleExecutePayment();
            }
          }}
          className="h-14 text-2xl font-mono font-bold text-center pr-4 pl-4 border-2 border-[#94A3B8] focus:border-[#0F172A]"
        />
      </div>
    </div>

    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-[#64748B]">مبالغ سريعة:</span>
      <button type="button" onClick={handleSetExactCash} className="px-3 py-1.5 rounded-md bg-[#F1F5F9] border border-[#D8E3F0] text-xs font-bold text-[#334155] hover:bg-[#E2E8F0] cursor-pointer">
        المبلغ بالضبط
      </button>
      {[10, 20, 50, 100, 200].map((amount) => (
        <button key={amount} type="button" onClick={() => handleQuickAdd(amount)} className="px-3 py-1.5 rounded-md bg-[#F1F5F9] border border-[#D8E3F0] text-xs font-bold text-[#334155] hover:bg-[#E2E8F0] cursor-pointer font-mono">
          +{amount}
        </button>
      ))}
    </div>

    <div
      className={cn(
        'p-4 rounded-2xl border flex items-center justify-between transition-colors',
        isCashSufficient ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'
      )}
    >
      <span className="text-sm font-bold text-[#334155]">
        {isCashSufficient ? 'الباقي للعميل:' : 'المبلغ الناقص:'}
      </span>
      <span
        id="cash-change-display"
        className={cn('text-2xl font-black font-mono tracking-tight', isCashSufficient ? 'text-[#16A34A]' : 'text-[#DC2626]')}
      >
        {isCashSufficient ? formatCurrency(cashChangeMinor) : formatCurrency(totalMinor - cashReceivedMinor)}
      </span>
    </div>
  </div>
);

interface CardPaymentPanelProps {
  totalMinor: number;
  cardRef: string;
  setCardRef: (value: string) => void;
  isProcessing: boolean;
  handleExecutePayment: () => Promise<void>;
}

export const CardPaymentPanel: React.FC<CardPaymentPanelProps> = ({
  totalMinor,
  cardRef,
  setCardRef,
  isProcessing,
  handleExecutePayment,
}) => (
  <div className="p-6 flex flex-col gap-4">
    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-4 flex items-center justify-between">
      <div>
        <span className="text-xs text-[#1E40AF] block">المبلغ الذي سيتم خصمه بالبطاقة</span>
        <span className="text-2xl font-black font-mono text-[#1E3A8A]">{formatCurrency(totalMinor)}</span>
      </div>
      <CreditCard size={32} className="text-[#3B82F6]" />
    </div>
    <div>
      <label className="block text-xs font-bold text-[#334155] mb-1.5">
        رقم العملية أو المرجع البنكي (اختياري)
      </label>
      <Input
        id="input-card-reference"
        placeholder="مثال: 987654 أو رقم إيصال الماكينة"
        value={cardRef}
        onChange={(e) => setCardRef(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isProcessing) {
            e.preventDefault();
            void handleExecutePayment();
          }
        }}
        className="h-11 text-xs"
      />
    </div>
  </div>
);

interface SplitPaymentPanelProps {
  splitCashAmountMajor: string;
  setSplitCashAmountMajor: (value: string) => void;
  splitCashTenderMajor: string;
  setSplitCashTenderMajor: (value: string) => void;
  splitCardAmountMajor: string;
  setSplitCardAmountMajor: (value: string) => void;
  splitCardRef: string;
  setSplitCardRef: (value: string) => void;
  splitChange: number;
  splitTotalPaid: number;
  splitRemaining: number;
}

export const SplitPaymentPanel: React.FC<SplitPaymentPanelProps> = ({
  splitCashAmountMajor,
  setSplitCashAmountMajor,
  splitCashTenderMajor,
  setSplitCashTenderMajor,
  splitCardAmountMajor,
  setSplitCardAmountMajor,
  splitCardRef,
  setSplitCardRef,
  splitChange,
  splitTotalPaid,
  splitRemaining,
}) => (
  <div className="p-6 flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="p-3.5 bg-[#F8FBFF] rounded-2xl border border-[#E2EBF5] flex flex-col gap-3">
        <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5"><Banknote size={15} /><span>الجزء النقدي</span></span>
        <div>
          <label className="text-[11px] text-[#64748B] block mb-1">المبلغ المطلوب نقداً</label>
          <Input type="number" step="any" min="0" value={splitCashAmountMajor} onChange={(e) => setSplitCashAmountMajor(e.target.value)} className="h-10 text-sm font-mono font-bold" />
        </div>
        <div>
          <label className="text-[11px] text-[#64748B] block mb-1">المستلم نقداً من العميل</label>
          <Input type="number" step="any" min="0" value={splitCashTenderMajor} onChange={(e) => setSplitCashTenderMajor(e.target.value)} className="h-10 text-sm font-mono font-bold" />
        </div>
        {splitChange > 0 && <div className="text-[11px] text-[#16A34A] font-bold font-mono">باقي النقدي: {formatCurrency(splitChange)}</div>}
      </div>
      <div className="p-3.5 bg-[#F8FBFF] rounded-2xl border border-[#E2EBF5] flex flex-col gap-3">
        <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5"><CreditCard size={15} /><span>جزء البطاقة</span></span>
        <div>
          <label className="text-[11px] text-[#64748B] block mb-1">المبلغ المطلوب بالبطاقة</label>
          <Input type="number" step="any" min="0" value={splitCardAmountMajor} onChange={(e) => setSplitCardAmountMajor(e.target.value)} className="h-10 text-sm font-mono font-bold" />
        </div>
        <div>
          <label className="text-[11px] text-[#64748B] block mb-1">مرجع العملية (اختياري)</label>
          <Input value={splitCardRef} onChange={(e) => setSplitCardRef(e.target.value)} placeholder="رقم الإيصال" className="h-10 text-xs" />
        </div>
      </div>
    </div>
    <div className="p-3 bg-[#F1F5F9] rounded-lg border border-[#E2E8F0] flex items-center justify-between text-xs">
      <div><span className="text-[#64748B]">إجمالي الموزع: </span><span className="font-bold font-mono text-[#0F172A]">{formatCurrency(splitTotalPaid)}</span></div>
      <div>
        {splitRemaining === 0 ? <span className="text-[#16A34A] font-bold">المبلغ مكتمل تماماً ✓</span> : splitRemaining > 0 ? <span className="text-[#DC2626] font-bold">متبقي: {formatCurrency(splitRemaining)}</span> : <span className="text-[#DC2626] font-bold">زيادة: {formatCurrency(Math.abs(splitRemaining))}</span>}
      </div>
    </div>
  </div>
);
