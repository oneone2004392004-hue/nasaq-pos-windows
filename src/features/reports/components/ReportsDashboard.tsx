import React, { Dispatch, SetStateAction } from 'react';
import { TrendingUp, Banknote, CreditCard, DollarSign, Wallet, ShoppingBag } from 'lucide-react';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { BusinessReportData, CashierPerformanceDTO, ShiftReportItemDTO, TopProductDTO } from '../types';
import { InvoiceListItemDTO } from '../../invoices/types';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';

type ActiveTabType = 'sales' | 'orderTypes' | 'payments' | 'topProducts' | 'cashiers' | 'expenses' | 'shifts';
interface ReportsDashboardProps {
  reportData: BusinessReportData | null;
  activeTab: ActiveTabType;
  setActiveTab: Dispatch<SetStateAction<ActiveTabType>>;
  topProductsSort: 'quantity' | 'sales';
  setTopProductsSort: Dispatch<SetStateAction<'quantity' | 'sales'>>;
  sortedTopProducts: TopProductDTO[];
  salesColumns: Column<InvoiceListItemDTO>[];
  topProductColumns: Column<TopProductDTO>[];
  cashierColumns: Column<CashierPerformanceDTO>[];
  shiftColumns: Column<ShiftReportItemDTO>[];
  setSelectedInvoiceId: (id: string) => void;
  setIsInvoiceModalOpen: (open: boolean) => void;
}

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({
  reportData, activeTab, setActiveTab, topProductsSort, setTopProductsSort,
  sortedTopProducts, salesColumns, topProductColumns, cashierColumns, shiftColumns,
  setSelectedInvoiceId, setIsInvoiceModalOpen,
}) => (
  <>
        {/* 2. SALES & FINANCIAL SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Sales */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E8EEF6] shadow-2xs text-right">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center justify-between">
              إجمالي المبيعات
              <TrendingUp size={13} className="text-blue-600" />
            </span>
            <span className="text-base font-bold text-[#1A237E] block mt-1 font-mono tabular-nums">
              {formatCurrency(reportData?.summary.totalSales || 0)}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">
              {reportData?.summary.completedOrdersCount || 0} فاتورة منفذة
            </span>
          </div>

          {/* Cash Sales */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E8EEF6] shadow-2xs text-right">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center justify-between">
              مبيعات كاش
              <Banknote size={13} className="text-emerald-600" />
            </span>
            <span className="text-base font-bold text-emerald-700 block mt-1 font-mono tabular-nums">
              {formatCurrency(reportData?.summary.cashSales || 0)}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 block">سيولة الدرج النقدية</span>
          </div>

          {/* Card Sales */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E8EEF6] shadow-2xs text-right">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center justify-between">
              مبيعات فيزا
              <CreditCard size={13} className="text-indigo-600" />
            </span>
            <span className="text-base font-bold text-indigo-700 block mt-1 font-mono tabular-nums">
              {formatCurrency(reportData?.summary.cardSales || 0)}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 block">المدفوعات الإلكترونية</span>
          </div>

          {/* Total Expenses */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E8EEF6] shadow-2xs text-right">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center justify-between">
              إجمالي المصروفات
              <DollarSign size={13} className="text-rose-600" />
            </span>
            <span className="text-base font-bold text-rose-700 block mt-1 font-mono tabular-nums">
              {formatCurrency(reportData?.summary.totalExpenses || 0)}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">
              {reportData?.expenses.expensesCount || 0} سند صرف
            </span>
          </div>

          {/* Net Sales */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E8EEF6] shadow-2xs text-right">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center justify-between">
              صافي المبيعات
              <Wallet size={13} className="text-gray-700" />
            </span>
            <span className="text-base font-bold text-gray-900 block mt-1 font-mono tabular-nums">
              {formatCurrency(reportData?.summary.netSales || 0)}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 block">المبيعات - المصروفات</span>
          </div>

          {/* Average Order Value */}
          <div className="bg-white p-3.5 rounded-lg border border-[#E8EEF6] shadow-2xs text-right">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center justify-between">
              متوسط الفاتورة
              <ShoppingBag size={13} className="text-cyan-700" />
            </span>
            <span className="text-base font-bold text-cyan-800 block mt-1 font-mono tabular-nums">
              {formatCurrency(reportData?.summary.averageOrderValue || 0)}
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 block">لكل طلب مكتمل</span>
          </div>
        </div>

        {/* 3. ANALYTICAL SECTION TABS */}
        <div className="flex items-center gap-1.5 border-b border-[#D8E3F0] pb-2 overflow-x-auto">
          {[
            { id: 'sales', label: 'المبيعات والفواتير التفصيلية' },
            { id: 'orderTypes', label: 'حسب نوع الطلب' },
            { id: 'payments', label: 'طرق الدفع والتحصيل' },
            { id: 'topProducts', label: 'الأصناف الأكثر مبيعاً' },
            { id: 'cashiers', label: 'أداء الكاشيرات' },
            { id: 'expenses', label: 'المصروفات التشغيلية' },
            { id: 'shifts', label: 'الورديات وحركة الدرج' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ActiveTabType)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors shrink-0',
                activeTab === tab.id
                  ? 'bg-white text-[#1A237E] border border-[#D8E3F0] shadow-2xs'
                  : 'text-[#61748D] hover:text-[#132238]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 4. TAB CONTENTS */}

        {/* TAB 1: DETAILED SALES TABLE */}
        {activeTab === 'sales' && (
          <div className="bg-white rounded-lg border border-[#E8EEF6] p-4 flex flex-col gap-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800">
                سجل الفواتير والمبيعات المكتملة في الفترة ({reportData?.detailedSales.length || 0} فاتورة)
              </span>
              <span className="text-[11px] text-gray-500">انقر على أي فاتورة لعرض التفاصيل الكاملة</span>
            </div>
            <Table<InvoiceListItemDTO>
              columns={salesColumns}
              data={reportData?.detailedSales || []}
              keyExtractor={(item) => item.id}
              onRowClick={(item) => {
                setSelectedInvoiceId(item.id);
                setIsInvoiceModalOpen(true);
              }}
              emptyMessage="لا توجد فواتير مبيعات مكتملة مطابقة لمعايير البحث في الفترة المختارة."
            />
          </div>
        )}

        {/* TAB 2: ORDER TYPE BREAKDOWN */}
        {activeTab === 'orderTypes' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportData?.orderTypes.map((item) => (
              <div key={item.orderType} className="bg-white p-4 rounded-lg border border-[#E8EEF6] shadow-2xs text-right">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-900">{item.orderTypeLabel}</span>
                  <Badge variant={item.orderType === 'DINE_IN' ? 'info' : item.orderType === 'TAKEAWAY' ? 'secondary' : 'warning'}>
                    {item.percentageOfTotal}% من المبيعات
                  </Badge>
                </div>
                <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100 font-mono">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">إجمالي المبيعات:</span>
                    <span className="font-bold text-[#1A237E]">{formatCurrency(item.totalSales)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">عدد الطلبات:</span>
                    <span className="font-semibold text-gray-800">{item.ordersCount} طلب</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">متوسط قيمة الطلب:</span>
                    <span className="text-gray-700">{formatCurrency(item.averageOrderValue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: PAYMENT BREAKDOWN */}
        {activeTab === 'payments' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportData?.payments.map((p) => (
              <div key={p.paymentMethod} className="bg-white p-4 rounded-lg border border-[#E8EEF6] shadow-2xs text-right">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-900">{p.methodLabel}</span>
                  {p.paymentMethod !== 'SPLIT' && (
                    <Badge variant={p.paymentMethod === 'CASH' ? 'success' : 'info'}>
                      {p.percentageOfTotal}%
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100 font-mono">
                  {p.paymentMethod !== 'SPLIT' ? (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">إجمالي المحصل:</span>
                      <span className="font-bold text-[#0D5C3A]">{formatCurrency(p.totalAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">عدد العمليات / الفواتير:</span>
                    <span className="font-semibold text-gray-800">{p.transactionsCount} عملية</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: TOP PRODUCTS */}
        {activeTab === 'topProducts' && (
          <div className="bg-white rounded-lg border border-[#E8EEF6] p-4 flex flex-col gap-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800">
                قائمة الأصناف الأكثر مبيعاً (مرتبة حسب اللقطات التاريخية لبيانات الطلب)
              </span>
              {/* Sorting buttons */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">الترتيب حسب:</span>
                <button
                  type="button"
                  onClick={() => setTopProductsSort('quantity')}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer',
                    topProductsSort === 'quantity'
                      ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  )}
                >
                  الكمية المباعة
                </button>
                <button
                  type="button"
                  onClick={() => setTopProductsSort('sales')}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer',
                    topProductsSort === 'sales'
                      ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  )}
                >
                  قيمة المبيعات
                </button>
              </div>
            </div>
            <Table<TopProductDTO>
              columns={topProductColumns}
              data={sortedTopProducts}
              keyExtractor={(item) => item.productName}
              emptyMessage="لا توجد مبيعات للأصناف في الفترة المختارة."
            />
          </div>
        )}

        {/* TAB 5: CASHIER PERFORMANCE */}
        {activeTab === 'cashiers' && (
          <div className="bg-white rounded-lg border border-[#E8EEF6] p-4 flex flex-col gap-3 shadow-2xs">
            <span className="text-xs font-bold text-gray-800">تحليل مبيعات وأداء كل كاشير ومستخدم</span>
            <Table<CashierPerformanceDTO>
              columns={cashierColumns}
              data={reportData?.cashiers || []}
              keyExtractor={(item) => item.userId}
              emptyMessage="لا توجد عمليات كاشير في الفترة المختارة."
            />
          </div>
        )}

        {/* TAB 6: EXPENSES REPORT */}
        {activeTab === 'expenses' && (
          <div className="flex flex-col gap-4">
            {/* Category summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {reportData?.expenses.byCategory.map((cat) => (
                <div key={cat.category} className="bg-white p-3 rounded-lg border border-[#E8EEF6] shadow-2xs text-right">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-gray-800">{cat.category}</span>
                    <Badge variant="secondary">{cat.expensesCount} سند</Badge>
                  </div>
                  <div className="text-sm font-bold text-rose-700 font-mono">
                    {formatCurrency(cat.totalAmount)}
                  </div>
                  <span className="text-[10px] text-gray-400 block mt-0.5">
                    من الدرج: {formatCurrency(cat.paidFromDrawerAmount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Expenses Detailed Table */}
            <div className="bg-white rounded-lg border border-[#E8EEF6] p-4 shadow-2xs">
              <span className="text-xs font-bold text-gray-800 block mb-3">سجل سندات الصرف في الفترة</span>
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2 px-3">التصنيف</th>
                    <th className="py-2 px-3">البيان والتفاصيل</th>
                    <th className="py-2 px-3">المصدر</th>
                    <th className="py-2 px-3">المستخدم</th>
                    <th className="py-2 px-3">التاريخ</th>
                    <th className="py-2 px-3 text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.expenses.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-semibold text-gray-800">{item.category}</td>
                      <td className="py-2 px-3 text-gray-700">{item.description}</td>
                      <td className="py-2 px-3">
                        {item.paidFromCashDrawer ? (
                          <Badge variant="warning">درج النقدية</Badge>
                        ) : (
                          <Badge variant="secondary">عهدة خارجية</Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-600">{item.cashierName}</td>
                      <td className="py-2 px-3 text-gray-500 font-mono">{formatDateTime(item.createdAt)}</td>
                      <td className="py-2 px-3 font-mono font-bold text-rose-700 text-left">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                  {(!reportData?.expenses.items || reportData.expenses.items.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400">
                        لا توجد مصروفات مسجلة في الفترة المختارة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: SHIFTS & CASH REGISTER SUMMARY */}
        {activeTab === 'shifts' && (
          <div className="flex flex-col gap-4">
            {/* Cash Register Ledger Movement (Real Transaction Ledger) */}
            <div className="bg-white p-4 rounded-lg border border-[#E8EEF6] shadow-2xs">
              <span className="text-xs font-bold text-gray-800 block mb-3">
                ملخص حركة الخزينة والدرج (وفقاً لسجل العمليات النقدية)
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                <div className="p-3 bg-emerald-50 rounded border border-emerald-100 text-right">
                  <span className="text-[11px] text-emerald-800 block">إجمالي المقبوضات (Cash In)</span>
                  <span className="text-sm font-bold text-emerald-900 mt-1 block">
                    {formatCurrency(reportData?.cashRegister.totalCashIn || 0)}
                  </span>
                  <span className="text-[10px] text-emerald-700 mt-0.5 block">
                    مبيعات: {formatCurrency(reportData?.cashRegister.cashSales || 0)} | إيداع: {formatCurrency(reportData?.cashRegister.deposits || 0)}
                  </span>
                </div>

                <div className="p-3 bg-rose-50 rounded border border-rose-100 text-right">
                  <span className="text-[11px] text-rose-800 block">إجمالي المدفوعات (Cash Out)</span>
                  <span className="text-sm font-bold text-rose-900 mt-1 block">
                    {formatCurrency(reportData?.cashRegister.totalCashOut || 0)}
                  </span>
                  <span className="text-[10px] text-rose-700 mt-0.5 block">
                    سحب: {formatCurrency(reportData?.cashRegister.withdrawals || 0)} | مصاريف: {formatCurrency(reportData?.cashRegister.expenses || 0)}
                  </span>
                </div>

                <div className="p-3 bg-blue-50 rounded border border-blue-100 text-right">
                  <span className="text-[11px] text-blue-800 block">التسويات النقدية</span>
                  <span className="text-sm font-bold text-blue-900 mt-1 block">
                    {formatCurrency(reportData?.cashRegister.adjustments || 0)}
                  </span>
                  <span className="text-[10px] text-blue-700 mt-0.5 block">فروق جرد معتمدة</span>
                </div>

                <div className="p-3 bg-gray-50 rounded border border-gray-200 text-right">
                  <span className="text-[11px] text-gray-700 block">صافي الحركة النقدية</span>
                  <span className="text-sm font-bold text-gray-900 mt-1 block">
                    {formatCurrency(reportData?.cashRegister.netCashMovement || 0)}
                  </span>
                  <span className="text-[10px] text-gray-500 mt-0.5 block">صافي التدفق النقدي بالدرج</span>
                </div>
              </div>
            </div>

            {/* Shifts Table */}
            <div className="bg-white rounded-lg border border-[#E8EEF6] p-4 shadow-2xs">
              <span className="text-xs font-bold text-gray-800 block mb-3">سجل ورديات الكاشير والجرد المالي</span>
              <Table<ShiftReportItemDTO>
                columns={shiftColumns}
                data={reportData?.shifts || []}
                keyExtractor={(item) => item.id}
                emptyMessage="لا توجد ورديات كاشير مسجلة في الفترة المختارة."
              />
            </div>
          </div>
        )}
  </>
);
