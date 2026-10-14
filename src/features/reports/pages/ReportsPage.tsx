import { logger } from '../../../utils/logger';
import { errorMessage } from '../../../utils/errors';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download,
  RefreshCw,
  TrendingUp,
  CreditCard,
  Banknote,
  DollarSign,
  ShoppingBag,
  Clock,
  Wallet,
  Users,
  UtensilsCrossed,
  Layers,
  ArrowUpDown,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../auth/context/AuthContext';
import { ReportService } from '../services/ReportService';
import { UserRepository } from '../../../repositories/UserRepository';
import {
  ReportDatePreset,
  BusinessReportData,
  TopProductDTO,
  CashierPerformanceDTO,
  ShiftReportItemDTO,
  OrderTypeBreakdownDTO,
  PaymentBreakdownDTO,
} from '../types';
import { OrderType, PaymentMethod } from '../../../domain/enums';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { generateCsvString, downloadCsv } from '../utils/exportCsv';
import { InvoiceDetailsModal } from '../../invoices/components/InvoiceDetailsModal';
import { ReportsDashboard } from '../components/ReportsDashboard';
import { createReportsTableColumns } from '../components/ReportsTableColumns';
import { cn } from '../../../utils/cn';
import { toLocalYmd } from '../../../utils/dateRanges';

type ActiveTabType = 'sales' | 'orderTypes' | 'payments' | 'topProducts' | 'cashiers' | 'expenses' | 'shifts';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const reportService = useMemo(() => new ReportService(), []);
  const userRepo = useMemo(() => new UserRepository(), []);

  // Filter States
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('TODAY');
  const [customStartDate, setCustomStartDate] = useState<string>(() => toLocalYmd(new Date()));
  const [customEndDate, setCustomEndDate] = useState<string>(() => toLocalYmd(new Date()));
  const [selectedOrderType, setSelectedOrderType] = useState<OrderType | 'ALL'>('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | 'SPLIT' | 'ALL'>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string | 'ALL'>('ALL');

  // Top Products Sort Option
  const [topProductsSort, setTopProductsSort] = useState<'quantity' | 'sales'>('quantity');

  // Active View Tab
  const [activeTab, setActiveTab] = useState<ActiveTabType>('sales');

  // Users for Cashier Filter
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);

  // Report Data State
  const [reportData, setReportData] = useState<BusinessReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Invoice for Detail Modal
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);

  // Load Active Cashiers / Users for Filter
  useEffect(() => {
    let isMounted = true;
    userRepo.listActive().then((users) => {
      if (isMounted) {
        setUsersList(users.map((u) => ({ id: u.id, name: u.name })));
      }
    }).catch((error: unknown) => { logger.error('Non-blocking asynchronous operation failed', error); });
    return () => {
      isMounted = false;
    };
  }, [userRepo]);

  // Fetch Report Data
  const loadReports = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      const data = await reportService.getBusinessReport(user, {
        datePreset,
        startDate: datePreset === 'CUSTOM' ? customStartDate : undefined,
        endDate: datePreset === 'CUSTOM' ? customEndDate : undefined,
        orderType: selectedOrderType,
        paymentMethod: selectedPaymentMethod,
        userId: selectedUserId,
      });

      setReportData(data);
    } catch (err: unknown) {
      setError(errorMessage(err, 'تعذر تحميل بيانات التقرير.'));
    } finally {
      setLoading(false);
    }
  }, [
    user,
    reportService,
    datePreset,
    customStartDate,
    customEndDate,
    selectedOrderType,
    selectedPaymentMethod,
    selectedUserId,
  ]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Export Active Tab to CSV
  const handleExportCsv = () => {
    if (!reportData) return;
    const dateTag = datePreset === 'CUSTOM' ? `${customStartDate}_${customEndDate}` : datePreset.toLowerCase();

    if (activeTab === 'sales') {
      const headers = ['رقم الفاتورة', 'رقم الطلب', 'نوع الطلب', 'الكاشير', 'طرق الدفع', 'الإجمالي (ج.م)', 'العميل', 'التاريخ والوقت'];
      const rows = reportData.detailedSales.map((inv) => [
        inv.invoice_number,
        inv.order_number,
        inv.order_type === 'DINE_IN' ? 'صالة' : inv.order_type === 'TAKEAWAY' ? 'سفري' : 'توصيل',
        inv.cashier_name,
        inv.payment_methods.join(' + ') || 'غير محدد',
        (inv.net_amount / 100).toFixed(2),
        inv.customer_name || 'عميل نقدي',
        formatDateTime(inv.created_at),
      ]);
      const csv = generateCsvString(headers, rows);
      downloadCsv(`sales_report_${dateTag}.csv`, csv);
    } else if (activeTab === 'topProducts') {
      const headers = ['الترتيب', 'اسم الصنف', 'الكمية المباعة', 'إجمالي المبيعات (ج.م)', 'متوسط سعر البيع (ج.م)'];
      const rows = reportData.topProducts.map((p) => [
        p.rank,
        p.productName,
        p.quantitySold,
        (p.totalSales / 100).toFixed(2),
        (p.averageUnitPrice / 100).toFixed(2),
      ]);
      const csv = generateCsvString(headers, rows);
      downloadCsv(`top_products_${dateTag}.csv`, csv);
    } else if (activeTab === 'cashiers') {
      const headers = ['الكاشير', 'عدد الطلبات', 'إجمالي المبيعات (ج.م)', 'متوسط الطلب (ج.م)', 'مبيعات كاش', 'مبيعات فيزا', 'صالة', 'سفري', 'توصيل'];
      const rows = reportData.cashiers.map((c) => [
        c.cashierName,
        c.completedOrdersCount,
        (c.totalSales / 100).toFixed(2),
        (c.averageOrderValue / 100).toFixed(2),
        (c.cashSales / 100).toFixed(2),
        (c.cardSales / 100).toFixed(2),
        (c.dineInSales / 100).toFixed(2),
        (c.takeawaySales / 100).toFixed(2),
        (c.deliverySales / 100).toFixed(2),
      ]);
      const csv = generateCsvString(headers, rows);
      downloadCsv(`cashiers_performance_${dateTag}.csv`, csv);
    } else if (activeTab === 'expenses') {
      const headers = ['التصنيف', 'البيان', 'القيمة (ج.م)', 'مصروف من الدرج', 'المستخدم', 'التاريخ'];
      const rows = reportData.expenses.items.map((e) => [
        e.category,
        e.description,
        (e.amount / 100).toFixed(2),
        e.paidFromCashDrawer ? 'نعم' : 'لا',
        e.cashierName,
        formatDateTime(e.createdAt),
      ]);
      const csv = generateCsvString(headers, rows);
      downloadCsv(`expenses_report_${dateTag}.csv`, csv);
    } else if (activeTab === 'shifts') {
      const headers = ['رقم الوردية', 'الكاشير', 'الحالة', 'وقت الفتح', 'وقت الإغلاق', 'رصيد الافتتاح', 'الرصيد المتوقع', 'الرصيد الفعلي', 'الفارق', 'إجمالي المبيعات'];
      const rows = reportData.shifts.map((s) => [
        s.shiftNumber,
        s.cashierName,
        s.status === 'OPEN' ? 'مفتوحة' : 'مغلقة',
        formatDateTime(s.openedAt),
        s.closedAt ? formatDateTime(s.closedAt) : 'جارية',
        (s.openingCash / 100).toFixed(2),
        (s.expectedCash / 100).toFixed(2),
        s.actualCash !== null ? (s.actualCash / 100).toFixed(2) : '-',
        s.variance !== null ? (s.variance / 100).toFixed(2) : '-',
        (s.totalSales / 100).toFixed(2),
      ]);
      const csv = generateCsvString(headers, rows);
      downloadCsv(`shifts_report_${dateTag}.csv`, csv);
    } else {
      // General summary export
      const headers = ['المؤشر المالي', 'القيمة'];
      const rows = [
        ['إجمالي المبيعات', formatCurrency(reportData.summary.totalSales)],
        ['عدد الفواتير المنفذة', String(reportData.summary.completedOrdersCount)],
        ['متوسط قيمة الفاتورة', formatCurrency(reportData.summary.averageOrderValue)],
        ['المبيعات النقدية (كاش)', formatCurrency(reportData.summary.cashSales)],
        ['مبيعات البطاقات (فيزا)', formatCurrency(reportData.summary.cardSales)],
        ['إجمالي المصروفات', formatCurrency(reportData.summary.totalExpenses)],
        ['صافي المبيعات', formatCurrency(reportData.summary.netSales)],
      ];
      const csv = generateCsvString(headers, rows);
      downloadCsv(`business_summary_${dateTag}.csv`, csv);
    }
  };

  // Detailed Sales Columns
  const sortedTopProducts = useMemo(() => {
    if (!reportData?.topProducts) return [];
    const copy = [...reportData.topProducts];
    if (topProductsSort === 'sales') {
      copy.sort((a, b) => b.totalSales - a.totalSales);
    } else {
      copy.sort((a, b) => b.quantitySold - a.quantitySold);
    }
    return copy.map((product, index) => ({ ...product, rank: index + 1 }));
  }, [reportData?.topProducts, topProductsSort]);

  const { salesColumns, topProductColumns, cashierColumns, shiftColumns } = useMemo(
    () => createReportsTableColumns((invoiceId) => {
      setSelectedInvoiceId(invoiceId);
      setIsInvoiceModalOpen(true);
    }),
    []
  );

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC]" dir="rtl">
      {/* Top Page Header */}
      <PageHeader
        title="التقارير والمؤشرات المالية"
        subtitle="تحليل مالي وتشغيلي موحد معتمد على قيود قاعدة البيانات المحلية وأرصدة الدرج الحقيقية"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadReports} disabled={loading} className="gap-1.5">
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
              <span>تحديث</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={!reportData} className="gap-1.5">
              <Download size={14} />
              <span>تصدير CSV</span>
            </Button>
          </div>
        }
      />

      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. FILTER CONTROLS BAR */}
        <div className="bg-white p-4 rounded-lg border border-[#E8EEF6] flex flex-col gap-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Date Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 ml-1">الفترة:</span>
              {(
                [
                  { id: 'TODAY', label: 'اليوم' },
                  { id: 'YESTERDAY', label: 'أمس' },
                  { id: 'THIS_WEEK', label: 'هذا الأسبوع' },
                  { id: 'THIS_MONTH', label: 'هذا الشهر' },
                  { id: 'CUSTOM', label: 'فترة مخصصة' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setDatePreset(preset.id)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer',
                    datePreset === preset.id
                      ? 'bg-[#1A237E] text-white shadow-2xs'
                      : 'bg-[#F0F0EE] text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers (if CUSTOM selected) */}
            {datePreset === 'CUSTOM' && (
              <div className="flex items-center gap-2 bg-[#F9F9F8] p-1.5 rounded-md border border-gray-200">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span>من:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span>إلى:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Secondary Filters: Order Type, Payment Method, Cashier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">نوع الطلب</label>
              <select
                value={selectedOrderType}
                onChange={(e) => setSelectedOrderType(e.target.value as OrderType | 'ALL')}
                className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">كافة الطلبات (صالة، سفري، توصيل)</option>
                <option value={OrderType.DINE_IN}>صالة (محلي)</option>
                <option value={OrderType.TAKEAWAY}>سفري (تيك أواي)</option>
                <option value={OrderType.DELIVERY}>توصيل (دليفري)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">طريقة الدفع</label>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value as PaymentMethod | 'SPLIT' | 'ALL')}
                className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">كافة طرق السداد</option>
                <option value={PaymentMethod.CASH}>نقدي (كاش)</option>
                <option value={PaymentMethod.CARD}>بطاقة بنكية / فيزا</option>
                <option value="SPLIT">مدفوعات مجزأة</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">الكاشير / المستخدم</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">كافة الكاشيرات والمستخدمين</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <ReportsDashboard
          reportData={reportData}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          topProductsSort={topProductsSort}
          setTopProductsSort={setTopProductsSort}
          sortedTopProducts={sortedTopProducts}
          salesColumns={salesColumns}
          topProductColumns={topProductColumns}
          cashierColumns={cashierColumns}
          shiftColumns={shiftColumns}
          setSelectedInvoiceId={setSelectedInvoiceId}
          setIsInvoiceModalOpen={setIsInvoiceModalOpen}
        />
      </div>

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setSelectedInvoiceId(null);
        }}
        invoiceId={selectedInvoiceId}
      />
    </div>
  );
};
