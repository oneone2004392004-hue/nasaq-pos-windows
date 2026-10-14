import { errorMessage } from '../../../utils/errors';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../auth/context/AuthContext';
import { CashRegisterService } from '../services/CashRegisterService';
import { CashRegisterBalanceInfo } from '../types';
import { CashTransactionRow } from '../../../domain/dbModels';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { DepositModal } from '../components/DepositModal';
import { WithdrawModal } from '../components/WithdrawModal';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Minus,
  AlertCircle,
  Banknote,
  Receipt,
  TrendingUp,
  Clock,
  CircleDot,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const CashRegisterPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const cashService = useMemo(() => new CashRegisterService(), []);

  const [balanceInfo, setBalanceInfo] = useState<CashRegisterBalanceInfo | null>(null);
  const [transactions, setTransactions] = useState<CashTransactionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modals
  const [isDepositOpen, setIsDepositOpen] = useState<boolean>(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setErrorMessage(null);

      // Attempt to load balance info for current shift
      let balance: CashRegisterBalanceInfo | null = null;
      try {
        balance = await cashService.getBalanceInfo(user);
      } catch (err: unknown) {
        // No active shift is handled gracefully
        balance = null;
      }
      setBalanceInfo(balance);

      // Load transactions
      const txs = await cashService.listTransactions(user, {
        shiftId: balance?.shiftId,
      });
      setTransactions(txs);
    } catch (err: unknown) {
      setErrorMessage(errorMessage(err, 'تعذر تحميل بيانات حركة الخزينة'));
    } finally {
      setLoading(false);
    }
  }, [user, cashService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTxs = useMemo(() => {
    if (typeFilter === 'ALL') return transactions;
    return transactions.filter((t) => t.transaction_type === typeFilter);
  }, [transactions, typeFilter]);

  const getTransactionTypeDetails = (type: string) => {
    switch (type) {
      case 'SALE_PAYMENT':
        return { label: 'تحصيل مبيعات نقدية', isIn: true, color: 'text-[#3C8D67]' };
      case 'DEPOSIT':
        return { label: 'إيداع فكة / عهدة بالدرج', isIn: true, color: 'text-[#3C8D67]' };
      case 'WITHDRAWAL':
        return { label: 'سحب نقدية من الدرج', isIn: false, color: 'text-[#D9534F]' };
      case 'EXPENSE':
        return { label: 'مصروف نثريات من الدرج', isIn: false, color: 'text-[#D9534F]' };
      case 'REFUND':
        return { label: 'مرتجع نقدي للعميل', isIn: false, color: 'text-[#D9534F]' };
      case 'ADJUSTMENT':
        return { label: 'تسوية نقدية', isIn: true, color: 'text-[#1464D9]' };
      default:
        return { label: type, isIn: true, color: 'text-[#52657D]' };
    }
  };

  const columns: Column<CashTransactionRow>[] = [
    {
      key: 'transaction_type',
      header: 'نوع الحركة',
      width: '210px',
      render: (item) => {
        const details = getTransactionTypeDetails(item.transaction_type);
        return (
          <div className="flex items-center gap-1.5">
            {details.isIn ? (
              <span className="p-1 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                <ArrowDownLeft size={13} />
              </span>
            ) : (
              <span className="p-1 rounded-full bg-[#FDF2F2] text-[#D9534F]">
                <ArrowUpRight size={13} />
              </span>
            )}
            <span className="font-semibold text-xs text-[#132238]">{details.label}</span>
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'المبلغ',
      width: '140px',
      render: (item) => {
        const details = getTransactionTypeDetails(item.transaction_type);
        return (
          <span className={`font-bold tabular-nums font-mono text-xs ${details.color}`}>
            {details.isIn ? '+' : '-'}
            {formatCurrency(item.amount)}
          </span>
        );
      },
    },
    {
      key: 'reason',
      header: 'البيان / سبب الحركة',
      render: (item) => (
        <span className="text-xs text-[#31445D] line-clamp-1" title={item.reason || ''}>
          {item.reason || '-'}
        </span>
      ),
    },
    {
      key: 'reference_id',
      header: 'المرجع المرتبط',
      width: '130px',
      render: (item) => (
        <span className="font-mono text-[11px] text-[#8291A5]">
          {item.reference_id ? item.reference_id.slice(-8) : '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'التوقيت',
      width: '150px',
      render: (item) => (
        <span className="text-xs text-[#61748D] tabular-nums font-mono">
          {formatDateTime(item.created_at)}
        </span>
      ),
    },
  ];

  const canDeposit = hasPermission('cash.deposit') && !!balanceInfo;
  const canWithdraw = hasPermission('cash.withdraw') && !!balanceInfo;

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC]">
      <PageHeader
        title="حركة الخزينة والدرج"
        subtitle="متابعة التدفقات النقدية اللحظية، الإيداعات، المسحوبات والمقبوضات الدفترية"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canWithdraw}
              onClick={() => setIsWithdrawOpen(true)}
            >
              <Minus size={14} />
              <span>سحب نقدية</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!canDeposit}
              onClick={() => setIsDepositOpen(true)}
            >
              <Plus size={14} />
              <span>إيداع نقدية</span>
            </Button>
          </div>
        }
      />

      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {errorMessage && (
          <div className="p-3 bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] rounded-md text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Shift Warning if no active shift */}
        {!balanceInfo && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] p-4 rounded-md text-xs text-[#92400E] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>لا توجد وردية نقدية مفتوحة لك حالياً. افتح وردية لتتمكن من إجراء السحب والإيداع.</span>
            </div>
            <Link to="/shifts">
              <Button variant="secondary" size="sm">
                الانتقال لفتح وردية
              </Button>
            </Link>
          </div>
        )}

        {/* Cash Balances Overview Cards */}
        {balanceInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-md border border-[#E8EEF6] flex flex-col text-right">
              <span className="text-xs text-[#8291A5]">الرصيد الدفتري بالدرج الآن</span>
              <span className="text-xl font-bold text-[#132238] font-mono tabular-nums mt-1">
                {formatCurrency(balanceInfo.currentExpectedCash)}
              </span>
              <span className="text-[11px] text-[#92A0B2] mt-1">
                الوردية: {balanceInfo.shiftNumber} ({balanceInfo.cashierName})
              </span>
            </div>

            <div className="bg-white p-4 rounded-md border border-[#E8EEF6] flex flex-col text-right">
              <span className="text-xs text-[#8291A5]">إجمالي المقبوضات النقدية</span>
              <span className="text-xl font-bold text-[#3C8D67] font-mono tabular-nums mt-1">
                +{formatCurrency(balanceInfo.cashSales + balanceInfo.deposits)}
              </span>
              <span className="text-[11px] text-[#92A0B2] mt-1">
                مبيعات: {formatCurrency(balanceInfo.cashSales)} | إيداع: {formatCurrency(balanceInfo.deposits)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-md border border-[#E8EEF6] flex flex-col text-right">
              <span className="text-xs text-[#8291A5]">إجمالي المسحوبات والمصروفات</span>
              <span className="text-xl font-bold text-[#D9534F] font-mono tabular-nums mt-1">
                -{formatCurrency(balanceInfo.withdrawals + balanceInfo.expenses)}
              </span>
              <span className="text-[11px] text-[#92A0B2] mt-1">
                مسحوبات: {formatCurrency(balanceInfo.withdrawals)} | مصروف: {formatCurrency(balanceInfo.expenses)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-md border border-[#E8EEF6] flex flex-col text-right">
              <span className="text-xs text-[#8291A5]">عهدة افتتاح الوردية</span>
              <span className="text-xl font-bold text-[#1464D9] font-mono tabular-nums mt-1">
                {formatCurrency(balanceInfo.openingCash)}
              </span>
              <span className="text-[11px] text-[#92A0B2] mt-1">
                المبلغ المبدئي المعتمد
              </span>
            </div>
          </div>
        )}

        {/* Transaction Type Filter Tabs */}
        <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-md border border-[#E8EEF6] text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[#61748D] font-medium ml-1">نوع الحركة:</span>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                typeFilter === 'ALL'
                  ? 'bg-[#132238] text-white font-semibold'
                  : 'bg-[#F4F4F2] text-[#52657D] hover:bg-[#EEF3F9]'
              }`}
            >
              الكل ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('SALE_PAYMENT')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                typeFilter === 'SALE_PAYMENT'
                  ? 'bg-[#2E7D32] text-white font-semibold'
                  : 'bg-[#F4F4F2] text-[#52657D] hover:bg-[#EEF3F9]'
              }`}
            >
              مبيعات نقدية ({transactions.filter((t) => t.transaction_type === 'SALE_PAYMENT').length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('DEPOSIT')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                typeFilter === 'DEPOSIT'
                  ? 'bg-[#3C8D67] text-white font-semibold'
                  : 'bg-[#F4F4F2] text-[#52657D] hover:bg-[#EEF3F9]'
              }`}
            >
              إيداعات فكة ({transactions.filter((t) => t.transaction_type === 'DEPOSIT').length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('WITHDRAWAL')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                typeFilter === 'WITHDRAWAL'
                  ? 'bg-[#D9534F] text-white font-semibold'
                  : 'bg-[#F4F4F2] text-[#52657D] hover:bg-[#EEF3F9]'
              }`}
            >
              مسحوبات ({transactions.filter((t) => t.transaction_type === 'WITHDRAWAL').length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('EXPENSE')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                typeFilter === 'EXPENSE'
                  ? 'bg-[#C0392B] text-white font-semibold'
                  : 'bg-[#F4F4F2] text-[#52657D] hover:bg-[#EEF3F9]'
              }`}
            >
              مصروفات ({transactions.filter((t) => t.transaction_type === 'EXPENSE').length})
            </button>
          </div>

          <span className="text-xs text-[#8291A5]">
            سجل دفتر النقدية الفعلي
          </span>
        </div>

        {/* Transactions Table */}
        <Table
          columns={columns}
          data={filteredTxs}
          keyExtractor={(item) => item.id}
          emptyMessage={loading ? 'جاري تحميل الحركات النقدية...' : 'لا توجد حركات نقدية مسجلة'}
        />
      </div>

      {/* Modals */}
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        shiftId={balanceInfo?.shiftId || null}
        onDepositSuccess={loadData}
      />

      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        shiftId={balanceInfo?.shiftId || null}
        availableCashMinor={balanceInfo?.currentExpectedCash || 0}
        onWithdrawSuccess={loadData}
      />
    </div>
  );
};
