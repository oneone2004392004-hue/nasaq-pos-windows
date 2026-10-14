import { errorMessage } from '../../../utils/errors';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Banknote,
  CreditCard,
  Split,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { formatCurrency, toMinorUnits } from '../../../utils/formatters';
import { PaymentItemInput, CompleteSaleResult } from '../services/PaymentService';
import { cn } from '../../../utils/cn';
import { CashPaymentPanel, CardPaymentPanel, SplitPaymentPanel } from './PaymentFormPanels';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  totalMinor: number;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  deliveryFeeMinor: number;
  onCompleteSale: (payments: PaymentItemInput[]) => Promise<CompleteSaleResult>;
  onSuccessDone: () => void;
}

type TabMethod = 'CASH' | 'CARD' | 'SPLIT';

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  totalMinor,
  subtotalMinor,
  taxMinor,
  discountMinor,
  deliveryFeeMinor,
  onCompleteSale,
  onSuccessDone,
}) => {
  const [activeTab, setActiveTab] = useState<TabMethod>('CASH');

  // Cash Tab States (in major units for input, converted to minor integer)
  const [cashReceivedMajor, setCashReceivedMajor] = useState<string>('');

  // Card Tab States
  const [cardRef, setCardRef] = useState<string>('');

  // Split Tab States
  const [splitCashAmountMajor, setSplitCashAmountMajor] = useState<string>('');
  const [splitCashTenderMajor, setSplitCashTenderMajor] = useState<string>('');
  const [splitCardAmountMajor, setSplitCardAmountMajor] = useState<string>('');
  const [splitCardRef, setSplitCardRef] = useState<string>('');

  // Processing & Feedback States
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cashInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('CASH');
      const majorStr = (totalMinor / 100).toString();
      setCashReceivedMajor(majorStr);
      setCardRef('');
      setSplitCashAmountMajor(Math.floor((totalMinor / 2) / 100).toString());
      setSplitCashTenderMajor(Math.floor((totalMinor / 2) / 100).toString());
      setSplitCardAmountMajor(Math.ceil((totalMinor / 2) / 100).toString());
      setSplitCardRef('');
      setIsProcessing(false);
      setErrorMessage(null);

      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 50);
    }
  }, [isOpen, totalMinor]);

  // Close the payment form with Escape; payment submission is handled by the primary action.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || isProcessing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  // Cash Calculations
  const cashReceivedMinor = useMemo(() => {
    const num = parseFloat(cashReceivedMajor);
    return isNaN(num) || num < 0 ? 0 : toMinorUnits(num);
  }, [cashReceivedMajor]);

  const cashChangeMinor = useMemo(() => {
    return Math.max(0, cashReceivedMinor - totalMinor);
  }, [cashReceivedMinor, totalMinor]);

  const isCashSufficient = cashReceivedMinor >= totalMinor;

  // Split Calculations
  const splitCashMinor = useMemo(() => {
    const num = parseFloat(splitCashAmountMajor);
    return isNaN(num) || num < 0 ? 0 : toMinorUnits(num);
  }, [splitCashAmountMajor]);

  const splitCashTenderMinor = useMemo(() => {
    const num = parseFloat(splitCashTenderMajor);
    return isNaN(num) || num < 0 ? 0 : toMinorUnits(num);
  }, [splitCashTenderMajor]);

  const splitCardMinor = useMemo(() => {
    const num = parseFloat(splitCardAmountMajor);
    return isNaN(num) || num < 0 ? 0 : toMinorUnits(num);
  }, [splitCardAmountMajor]);

  const splitTotalPaid = splitCashMinor + splitCardMinor;
  const splitRemaining = totalMinor - splitTotalPaid;
  const splitChange = Math.max(0, splitCashTenderMinor - splitCashMinor);
  const isSplitValid =
    splitRemaining === 0 &&
    splitCashMinor >= 0 &&
    splitCardMinor >= 0 &&
    splitCashTenderMinor >= splitCashMinor;

  // Cash Denomination Shortcuts
  const handleQuickAdd = (addMajor: number) => {
    const current = parseFloat(cashReceivedMajor) || 0;
    const nextVal = (current + addMajor).toString();
    setCashReceivedMajor(nextVal);
  };

  const handleSetExactCash = () => {
    setCashReceivedMajor((totalMinor / 100).toString());
  };

  // Submit Payment
  const handleExecutePayment = async () => {
    if (isProcessing) return; // Prevent double submit
    setErrorMessage(null);

    let paymentItems: PaymentItemInput[] = [];

    if (activeTab === 'CASH') {
      if (!isCashSufficient) {
        setErrorMessage('المبلغ المدفوع نقداً غير كافٍ لتغطية إجمالي الفاتورة.');
        return;
      }
      paymentItems = [
        {
          method: 'CASH',
          amount: totalMinor,
          tenderAmount: cashReceivedMinor,
          referenceNumber: null,
        },
      ];
    } else if (activeTab === 'CARD') {
      paymentItems = [
        {
          method: 'CARD',
          amount: totalMinor,
          tenderAmount: totalMinor,
          referenceNumber: cardRef.trim() || null,
        },
      ];
    } else if (activeTab === 'SPLIT') {
      if (!isSplitValid) {
        if (splitRemaining > 0) {
          setErrorMessage(`المبلغ الموزع غير مكتمل. المتبقي: ${formatCurrency(splitRemaining)}`);
        } else if (splitRemaining < 0) {
          setErrorMessage(`المبلغ الموزع أكبر من إجمالي الفاتورة بمقدار: ${formatCurrency(Math.abs(splitRemaining))}`);
        } else if (splitCashTenderMinor < splitCashMinor) {
          setErrorMessage('المبلغ المستلم نقداً في الدفع المتعدد أقل من المطلوب نقداً.');
        }
        return;
      }

      paymentItems = [];
      if (splitCashMinor > 0) {
        paymentItems.push({
          method: 'CASH',
          amount: splitCashMinor,
          tenderAmount: splitCashTenderMinor,
          referenceNumber: null,
        });
      }
      if (splitCardMinor > 0) {
        paymentItems.push({
          method: 'CARD',
          amount: splitCardMinor,
          tenderAmount: splitCardMinor,
          referenceNumber: splitCardRef.trim() || null,
        });
      }
    }

    try {
      setIsProcessing(true);
      await onCompleteSale(paymentItems);
      // The parent immediately closes the modal, clears the cart, and starts a new order.
      onSuccessDone();
    } catch (err: unknown) {
      setErrorMessage(errorMessage(err, 'تعذر إتمام عملية الدفع. يرجى المحاولة مرة أخرى.'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="payment-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2D52]/55 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        id="payment-modal-container"
        className="bg-white rounded-[24px] shadow-[0_24px_70px_rgba(13,45,82,0.24)] border border-[#D7E4F2] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E2EBF5] bg-[#F8FBFF]">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <span>سداد الطلب</span>
              <span className="text-sm font-mono font-medium text-[#475569] bg-[#E2E8F0] px-2 py-0.5 rounded-sm">
                {orderNumber}
              </span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              حدد طريقة الدفع وأدخل المبالغ المستلمة لإتمام الفاتورة
            </p>
          </div>

          {!isProcessing && (
            <button
              type="button"
              id="btn-close-payment-modal"
              onClick={onClose}
              className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-xl hover:bg-[#EEF5FF] transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Payment Selection & Form View */}
        <div className="flex flex-col flex-1 overflow-y-auto">
            {/* Top Financial Prominent Indicator */}
            <div className="bg-[#F4F8FD] px-6 py-5 border-b border-[#E2EBF5] flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#64748B]">المبلغ المطلوب سداده</span>
                <div className="text-2xl font-black font-mono text-[#0F172A] tracking-tight">
                  {formatCurrency(totalMinor)}
                </div>
              </div>

              <div className="text-left text-xs text-[#64748B] flex flex-col gap-0.5">
                <span>المجموع: {formatCurrency(subtotalMinor)}</span>
                {discountMinor > 0 && (
                  <span className="text-[#DC2626]">الخصم: -{formatCurrency(discountMinor)}</span>
                )}
                {deliveryFeeMinor > 0 && (
                  <span>خدمة التوصيل: +{formatCurrency(deliveryFeeMinor)}</span>
                )}
              </div>
            </div>

            {/* Error Message Banner when present */}
            {errorMessage && (
              <div className="m-4 mb-0 p-3 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626] flex items-start gap-2 font-medium animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Method Tabs */}
            <div className="px-6 pt-4">
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#F1F5F9] rounded-2xl border border-[#E2EBF5]">
                <button
                  type="button"
                  id="tab-pay-cash"
                  onClick={() => {
                    setActiveTab('CASH');
                    setTimeout(() => cashInputRef.current?.focus(), 50);
                  }}
                  className={cn(
                    'h-12 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer',
                    activeTab === 'CASH'
                      ? 'bg-white text-[#0D2D52] shadow-sm border border-[#D7E4F2]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  )}
                >
                  <Banknote size={18} />
                  <span>نقدي (Cash)</span>
                </button>

                <button
                  type="button"
                  id="tab-pay-card"
                  onClick={() => setActiveTab('CARD')}
                  className={cn(
                    'h-12 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer',
                    activeTab === 'CARD'
                      ? 'bg-white text-[#0D2D52] shadow-sm border border-[#D7E4F2]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  )}
                >
                  <CreditCard size={18} />
                  <span>بطاقة / فيزا (Card)</span>
                </button>

                <button
                  type="button"
                  id="tab-pay-split"
                  onClick={() => setActiveTab('SPLIT')}
                  className={cn(
                    'h-12 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer',
                    activeTab === 'SPLIT'
                      ? 'bg-white text-[#0D2D52] shadow-sm border border-[#D7E4F2]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  )}
                >
                  <Split size={18} />
                  <span>دفع متعدد (Split)</span>
                </button>
              </div>
            </div>

            {activeTab === 'CASH' && (
              <CashPaymentPanel
                cashReceivedMajor={cashReceivedMajor}
                setCashReceivedMajor={setCashReceivedMajor}
                cashInputRef={cashInputRef}
                isCashSufficient={isCashSufficient}
                isProcessing={isProcessing}
                handleExecutePayment={handleExecutePayment}
                handleSetExactCash={handleSetExactCash}
                handleQuickAdd={handleQuickAdd}
                cashChangeMinor={cashChangeMinor}
                cashReceivedMinor={cashReceivedMinor}
                totalMinor={totalMinor}
              />
            )}
            {activeTab === 'CARD' && (
              <CardPaymentPanel
                totalMinor={totalMinor}
                cardRef={cardRef}
                setCardRef={setCardRef}
                isProcessing={isProcessing}
                handleExecutePayment={handleExecutePayment}
              />
            )}
            {activeTab === 'SPLIT' && (
              <SplitPaymentPanel
                splitCashAmountMajor={splitCashAmountMajor}
                setSplitCashAmountMajor={setSplitCashAmountMajor}
                splitCashTenderMajor={splitCashTenderMajor}
                setSplitCashTenderMajor={setSplitCashTenderMajor}
                splitCardAmountMajor={splitCardAmountMajor}
                setSplitCardAmountMajor={setSplitCardAmountMajor}
                splitCardRef={splitCardRef}
                setSplitCardRef={setSplitCardRef}
                splitChange={splitChange}
                splitTotalPaid={splitTotalPaid}
                splitRemaining={splitRemaining}
              />
            )}

            {/* Bottom Actions */}
            <div className="mt-auto p-5 border-t border-[#E2EBF5] bg-[#F8FBFF] flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isProcessing}
                className="h-11 px-5 text-xs font-bold"
              >
                إلغاء (Esc)
              </Button>

              <Button
                type="button"
                id="btn-confirm-payment"
                variant="primary"
                onClick={handleExecutePayment}
                disabled={
                  isProcessing ||
                  (activeTab === 'CASH' && !isCashSufficient) ||
                  (activeTab === 'SPLIT' && !isSplitValid)
                }
                className="h-12 px-8 text-sm font-bold flex items-center gap-2 rounded-xl shadow-[0_7px_16px_rgba(20,100,217,0.18)]"
              >
                {isProcessing ? (
                  <span>جاري إتمام الدفع والطباعة...</span>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>دفع وطباعة الإيصال</span>
                  </>
                )}
              </Button>
            </div>
          </div>
      </div>
    </div>
  );
};
