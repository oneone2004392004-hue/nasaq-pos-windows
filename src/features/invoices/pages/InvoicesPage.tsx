import { errorMessage } from '../../../utils/errors';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  Search,
  Printer,
  Eye,
  RefreshCw,
  Filter,
  Calendar,
  CreditCard,
  Banknote,
  Split,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  AlertCircle,
  Palette,
} from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { InvoiceService } from '../services/InvoiceService';
import { InvoiceListItemDTO, InvoiceDatePreset } from '../types';
import { InvoiceDetailsModal } from '../components/InvoiceDetailsModal';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

export const InvoicesPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<InvoiceListItemDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'REFUNDED'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CASH' | 'CARD' | 'SPLIT'>('ALL');
  const [dateFilter, setDateFilter] = useState<InvoiceDatePreset>('ALL');

  // Selected Invoice Modal
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  const invoiceService = useMemo(() => new InvoiceService(), []);

  const loadInvoices = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const data = await invoiceService.listInvoices(user, {
        search: searchQuery.trim(),
        status: statusFilter,
        paymentMethod: paymentFilter,
        datePreset: dateFilter,
      });
      setInvoices(data);
    } catch (err: unknown) {
      setError(errorMessage(err, 'تعذر استرجاع قائمة الفواتير.'));
    } finally {
      setLoading(false);
    }
  }, [user, invoiceService, searchQuery, statusFilter, paymentFilter, dateFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleOpenDetails = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setIsDetailsOpen(true);
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const totalCount = invoices.length;
    const totalNetRevenue = invoices.reduce((acc, inv) => acc + inv.net_amount, 0);
    return {
      totalCount,
      totalNetRevenue,
    };
  }, [invoices]);

  const columns: Column<InvoiceListItemDTO>[] = [
    {
      key: 'invoice_number',
      header: 'رقم الفاتورة',
      width: '180px',
      render: (item) => (
        <span className="font-bold text-[#0F172A] font-mono tracking-wide">
          {item.invoice_number}
        </span>
      ),
    },
    {
      key: 'order_number',
      header: 'رقم الطلب',
      width: '110px',
      render: (item) => (
        <span className="font-mono text-xs font-semibold text-[#475569]">
          {item.order_number}
        </span>
      ),
    },
    {
      key: 'order_type',
      header: 'نوع الطلب',
      render: (item) => {
        if (item.order_type === 'DINE_IN') {
          return (
            <div className="flex items-center gap-1 text-xs text-[#1E3A8A]">
              <UtensilsCrossed size={13} className="text-[#3B82F6]" />
              <span>صالة {item.table_number ? `(${item.table_number})` : ''}</span>
            </div>
          );
        }
        if (item.order_type === 'DELIVERY') {
          return (
            <div className="flex items-center gap-1 text-xs text-[#065F46]">
              <Bike size={13} className="text-[#10B981]" />
              <span>توصيل</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1 text-xs text-[#78350F]">
            <ShoppingBag size={13} className="text-[#F59E0B]" />
            <span>سفري</span>
          </div>
        );
      },
    },
    {
      key: 'payment_methods',
      header: 'طريقة الدفع',
      render: (item) => {
        if (item.payment_methods.length > 1) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-bold bg-[#F3E8FF] text-[#7E22CE]">
              <Split size={12} />
              <span>متعدد ({item.payment_methods.join(' + ')})</span>
            </span>
          );
        }
        if (item.payment_methods.includes('CARD')) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-bold bg-[#EFF6FF] text-[#1D4ED8]">
              <CreditCard size={12} />
              <span>بطاقة (Card)</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-bold bg-[#F0FDF4] text-[#15803D]">
            <Banknote size={12} />
            <span>نقدي (Cash)</span>
          </span>
        );
      },
    },
    {
      key: 'cashier_name',
      header: 'الكاشير',
      render: (item) => <span className="text-xs text-[#334155]">{item.cashier_name}</span>,
    },
    {
      key: 'net_amount',
      header: 'الإجمالي الصافي',
      render: (item) => (
        <span className="font-bold font-mono text-[#0F172A] tabular-nums">
          {formatCurrency(item.net_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (item) => {
        const isPaid = item.status === 'PAID';
        return (
          <Badge variant={isPaid ? 'success' : 'danger'} size="sm">
            {isPaid ? 'مسددة' : item.status}
          </Badge>
        );
      },
    },
    {
      key: 'created_at',
      header: 'تاريخ الإصدار',
      render: (item) => (
        <span className="text-xs text-[#64748B] tabular-nums">
          {formatDateTime(item.created_at)}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'الإجراءات',
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            id={`btn-view-invoice-${item.id}`}
            variant="secondary"
            size="sm"
            onClick={() => handleOpenDetails(item.id)}
            title="عرض تفاصيل الفاتورة"
            className="h-8 px-2.5 text-xs flex items-center gap-1 text-[#0F172A]"
          >
            <Eye size={13} />
            <span>عرض</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F8FAFC]">
      <PageHeader
        title="قائمة الفواتير"
        subtitle="سجل المبيعات المؤكدة، طباعة الإيصالات، ومتابعة العمليات المالية"
        actions={
          hasPermission('settings.view') ? (
            <Button
              id="btn-customize-invoices"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/settings?tab=design')}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <Palette size={14} />
              <span>تخصيص تصميم الفواتير</span>
            </Button>
          ) : undefined
        }
      />

      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {/* Metric Cards Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-2xs">
            <span className="text-xs font-medium text-[#64748B]">إجمالي عدد الفواتير</span>
            <div className="text-xl font-bold font-mono text-[#0F172A] mt-0.5">
              {metrics.totalCount}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-2xs">
            <span className="text-xs font-medium text-[#64748B]">إجمالي المبيعات المؤكدة (صافي الإيراد)</span>
            <div className="text-xl font-bold font-mono text-[#16A34A] mt-0.5">
              {formatCurrency(metrics.totalNetRevenue)}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-[#64748B]">حالة التحديث</span>
              <div className="text-xs font-semibold text-[#0F172A] mt-1">قاعدة بيانات محلية متزامنة</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadInvoices}
              title="تحديث البيانات"
              className="h-8 px-2.5 text-xs"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="mr-1">تحديث</span>
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-2xs flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              id="invoice-search-input"
              type="text"
              placeholder="ابحث برقم الفاتورة، الطلب، العميل، أو الكاشير..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 pl-3 h-9 text-xs bg-[#F8FAFC]"
            />
          </div>

          {/* Date Preset Filter */}
          <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-md border border-[#E2E8F0] text-xs">
            <Calendar size={14} className="text-[#64748B] mr-1.5" />
            {(['ALL', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH'] as InvoiceDatePreset[]).map(
              (dp) => (
                <button
                  key={dp}
                  type="button"
                  onClick={() => setDateFilter(dp)}
                  className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                    dateFilter === dp
                      ? 'bg-white text-[#0F172A] font-bold shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {dp === 'ALL'
                    ? 'الكل'
                    : dp === 'TODAY'
                    ? 'اليوم'
                    : dp === 'YESTERDAY'
                    ? 'أمس'
                    : dp === 'THIS_WEEK'
                    ? 'هذا الأسبوع'
                    : 'هذا الشهر'}
                </button>
              )
            )}
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#64748B]">الدفع:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as 'ALL' | 'CASH' | 'CARD' | 'SPLIT')}
              className="h-9 px-2.5 text-xs bg-[#F8FAFC] border border-[#D8E3F0] rounded-md outline-none focus:border-[#0F172A]"
            >
              <option value="ALL">جميع الطرق</option>
              <option value="CASH">نقدي فقط</option>
              <option value="CARD">بطاقة فقط</option>
              <option value="SPLIT">متعدد فقط</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#64748B]">الحالة:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'PAID' | 'REFUNDED')}
              className="h-9 px-2.5 text-xs bg-[#F8FAFC] border border-[#D8E3F0] rounded-md outline-none focus:border-[#0F172A]"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="PAID">مسددة (PAID)</option>
              <option value="REFUNDED">مرتجعة (REFUNDED)</option>
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-[#DC2626] text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Invoices Table */}
        <div className="flex-1 bg-white rounded-lg border border-[#E2E8F0] shadow-2xs overflow-hidden">
          <Table
            columns={columns}
            data={invoices}
            keyExtractor={(item) => item.id}
            emptyMessage={
              loading
                ? 'جاري تحميل الفواتير...'
                : 'لا توجد فواتير مطابقة لمعايير البحث والتصفية.'
            }
          />
        </div>
      </div>

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        invoiceId={selectedInvoiceId}
      />
    </div>
  );
};

