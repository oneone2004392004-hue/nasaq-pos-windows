import { errorMessage } from '../../../utils/errors';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Plus, AlertCircle, Banknote, Calendar, Tag } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { useAuth } from '../../auth/context/AuthContext';
import { ExpenseRepository } from '../../../repositories/ExpenseRepository';
import { ExpenseRow } from '../../../domain/dbModels';
import { AddExpenseModal } from '../components/AddExpenseModal';

export const ExpensesPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const expenseRepo = useMemo(() => new ExpenseRepository(), []);

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const list = await expenseRepo.listRecent(100);
      setExpenses(list);
    } catch (err: unknown) {
      setErrorMessage(errorMessage(err, 'تعذر استرجاع سجل المصروفات'));
    } finally {
      setLoading(false);
    }
  }, [expenseRepo]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const totalAmountMinor = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const cashDrawerCount = useMemo(() => {
    return expenses.filter((e) => e.paid_from_cash_drawer === 1).length;
  }, [expenses]);

  const canCreate = hasPermission('expenses.create');

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'category',
      header: 'بند المصروف',
      width: '180px',
      render: (item) => (
        <div className="flex items-center gap-1.5 font-semibold text-xs text-[#132238]">
          <Tag size={13} className="text-[#1464D9]" />
          <span>{item.category}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'القيمة',
      width: '140px',
      render: (item) => (
        <span className="font-bold tabular-nums text-xs font-mono text-[#D9534F]">
          -{formatCurrency(item.amount)}
        </span>
      ),
    },
    {
      key: 'paid_from_cash_drawer',
      header: 'مصدر الصرف',
      width: '160px',
      render: (item) => (
        <Badge variant={item.paid_from_cash_drawer === 1 ? 'neutral' : 'outline'} size="sm">
          {item.paid_from_cash_drawer === 1 ? 'خصم من درج الكاشير' : 'أخرى / بدون خصم درج'}
        </Badge>
      ),
    },
    {
      key: 'description',
      header: 'البيان والملاحظات',
      render: (item) => (
        <span className="text-xs text-[#52657D] line-clamp-1" title={item.description || ''}>
          {item.description || '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'تاريخ وتوقيت الصرف',
      width: '160px',
      render: (item) => (
        <span className="text-xs text-[#61748D] tabular-nums font-mono">
          {formatDateTime(item.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC]">
      <PageHeader
        title="سجل المصروفات"
        subtitle="تسجيل النثريات اليومية ومصاريف التشغيل وتأثيرها على رصيد الخزينة"
        actions={
          <Button
            variant="primary"
            size="sm"
            disabled={!canCreate}
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={15} />
            <span>تسجيل مصروف جديد</span>
          </Button>
        }
      />

      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {errorMessage && (
          <div className="p-3 bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] rounded-md text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Summary metric banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-md border border-[#E8EEF6] text-right">
            <span className="text-xs text-[#8291A5]">إجمالي المصروفات المسجلة</span>
            <span className="text-xl font-bold text-[#D9534F] font-mono tabular-nums block mt-1">
              -{formatCurrency(totalAmountMinor)}
            </span>
          </div>
          <div className="bg-white p-4 rounded-md border border-[#E8EEF6] text-right">
            <span className="text-xs text-[#8291A5]">عدد بنود المصروفات</span>
            <span className="text-xl font-bold text-[#132238] font-mono tabular-nums block mt-1">
              {expenses.length}
            </span>
          </div>
          <div className="bg-white p-4 rounded-md border border-[#E8EEF6] text-right">
            <span className="text-xs text-[#8291A5]">مصروفات مخصومة من الدرج</span>
            <span className="text-xl font-bold text-[#1464D9] font-mono tabular-nums block mt-1">
              {cashDrawerCount}
            </span>
          </div>
        </div>

        <Table
          columns={columns}
          data={expenses}
          keyExtractor={(item) => item.id}
          emptyMessage={loading ? 'جاري استرجاع المصروفات...' : 'لا توجد مصروفات مسجلة'}
        />
      </div>

      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onExpenseCreated={loadExpenses}
      />
    </div>
  );
};
