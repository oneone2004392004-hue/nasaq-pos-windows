import React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { FileText } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Column } from '../../../components/ui/Table';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { InvoiceListItemDTO } from '../../invoices/types';
import { CashierPerformanceDTO, ShiftReportItemDTO, TopProductDTO } from '../types';

export const createReportsTableColumns = (onInvoiceSelect: (invoiceId: string) => void) => {
  const salesColumns: Column<InvoiceListItemDTO>[] = [
    {
      key: 'invoice_number',
      header: 'رقم الفاتورة',
      width: '150px',
      render: (inv) => (
        <span className="font-mono text-xs font-semibold text-[#1A237E] flex items-center gap-1.5">
          <FileText size={13} className="text-gray-400 shrink-0" />
          {inv.invoice_number}
        </span>
      ),
    },
    {
      key: 'order_number',
      header: 'رقم الطلب',
      width: '130px',
      render: (inv) => <span className="font-mono text-xs text-gray-700">{inv.order_number}</span>,
    },
    {
      key: 'order_type',
      header: 'نوع الطلب',
      align: 'center',
      render: (inv) => {
        if (inv.order_type === 'DINE_IN') {
          return <Badge variant="info">صالة {inv.table_number ? `(${inv.table_number})` : ''}</Badge>;
        }
        if (inv.order_type === 'TAKEAWAY') {
          return <Badge variant="secondary">سفري</Badge>;
        }
        return <Badge variant="warning">توصيل</Badge>;
      },
    },
    {
      key: 'cashier_name',
      header: 'الكاشير',
      render: (inv) => <span className="text-xs text-gray-800">{inv.cashier_name}</span>,
    },
    {
      key: 'payment_methods',
      header: 'طريقة الدفع',
      align: 'center',
      render: (inv) => {
        const methods = inv.payment_methods || [];
        if (methods.length > 1) {
          return <Badge variant="warning">دفع مجزأ</Badge>;
        }
        if (methods.includes('CARD')) {
          return <Badge variant="info">بطاقة / فيزا</Badge>;
        }
        return <Badge variant="success">نقدي</Badge>;
      },
    },
    {
      key: 'net_amount',
      header: 'الإجمالي الصافي',
      align: 'left',
      render: (inv) => (
        <span className="font-mono tabular-nums text-xs font-bold text-[#1F2937]">
          {formatCurrency(inv.net_amount)}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'الوقت والتاريخ',
      render: (inv) => <span className="text-xs text-gray-500 font-mono">{formatDateTime(inv.created_at)}</span>,
    },
    {
      key: 'id',
      header: 'الإجراءات',
      align: 'center',
      render: (inv) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onInvoiceSelect(inv.id);
          }}
          className="h-7 text-[11px] px-2"
        >
          عرض الفاتورة
        </Button>
      ),
    },
  ];

  // Top Products Columns
  const topProductColumns: Column<TopProductDTO>[] = [
    {
      key: 'rank',
      header: 'الترتيب',
      width: '70px',
      align: 'center',
      render: (item) => (
        <span
          className={cn(
            'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
            item.rank === 1
              ? 'bg-amber-100 text-amber-800'
              : item.rank === 2
              ? 'bg-slate-200 text-slate-700'
              : item.rank === 3
              ? 'bg-amber-50 text-amber-900 border border-amber-200'
              : 'text-gray-600'
          )}
        >
          {item.rank}
        </span>
      ),
    },
    {
      key: 'productName',
      header: 'اسم الصنف (اللقطة التاريخية)',
      render: (item) => <span className="font-semibold text-xs text-gray-900">{item.productName}</span>,
    },
    {
      key: 'quantitySold',
      header: 'الكمية المباعة',
      align: 'center',
      render: (item) => (
        <span className="font-mono tabular-nums text-xs font-bold text-[#1A237E]">
          {item.quantitySold} قطعة
        </span>
      ),
    },
    {
      key: 'averageUnitPrice',
      header: 'متوسط سعر الوحدة',
      align: 'center',
      render: (item) => (
        <span className="font-mono tabular-nums text-xs text-gray-600">
          {formatCurrency(item.averageUnitPrice)}
        </span>
      ),
    },
    {
      key: 'totalSales',
      header: 'إجمالي المبيعات المحققة',
      align: 'left',
      render: (item) => (
        <span className="font-mono tabular-nums text-xs font-bold text-[#0D5C3A]">
          {formatCurrency(item.totalSales)}
        </span>
      ),
    },
  ];

  // Cashier Performance Columns
  const cashierColumns: Column<CashierPerformanceDTO>[] = [
    {
      key: 'cashierName',
      header: 'اسم الكاشير',
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-bold shrink-0">
            {item.cashierName.slice(0, 1)}
          </div>
          <span className="font-semibold text-xs text-gray-900">{item.cashierName}</span>
        </div>
      ),
    },
    {
      key: 'completedOrdersCount',
      header: 'عدد الفواتير',
      align: 'center',
      render: (item) => <span className="font-mono text-xs font-semibold">{item.completedOrdersCount}</span>,
    },
    {
      key: 'averageOrderValue',
      header: 'متوسط الفاتورة',
      align: 'center',
      render: (item) => (
        <span className="font-mono tabular-nums text-xs text-gray-600">
          {formatCurrency(item.averageOrderValue)}
        </span>
      ),
    },
    {
      key: 'cashSales',
      header: 'مبيعات كاش',
      align: 'center',
      render: (item) => (
        <span className="font-mono tabular-nums text-xs text-gray-700">
          {formatCurrency(item.cashSales)}
        </span>
      ),
    },
    {
      key: 'cardSales',
      header: 'مبيعات فيزا',
      align: 'center',
      render: (item) => (
        <span className="font-mono tabular-nums text-xs text-blue-700 font-semibold">
          {formatCurrency(item.cardSales)}
        </span>
      ),
    },
    {
      key: 'totalSales',
      header: 'إجمالي المبيعات',
      align: 'left',
      render: (item) => (
        <span className="font-mono tabular-nums text-xs font-bold text-[#1A237E]">
          {formatCurrency(item.totalSales)}
        </span>
      ),
    },
  ];

  // Shift Columns
  const shiftColumns: Column<ShiftReportItemDTO>[] = [
    {
      key: 'shiftNumber',
      header: 'رقم الوردية',
      render: (item) => <span className="font-mono text-xs font-semibold text-gray-900">{item.shiftNumber}</span>,
    },
    {
      key: 'cashierName',
      header: 'الكاشير',
      render: (item) => <span className="text-xs text-gray-800">{item.cashierName}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      align: 'center',
      render: (item) =>
        item.status === 'OPEN' ? (
          <Badge variant="success">مفتوحة</Badge>
        ) : (
          <Badge variant="secondary">مغلقة</Badge>
        ),
    },
    {
      key: 'openedAt',
      header: 'وقت الفتح',
      render: (item) => <span className="text-xs text-gray-500 font-mono">{formatDateTime(item.openedAt)}</span>,
    },
    {
      key: 'openingCash',
      header: 'رصيد الافتتاح',
      align: 'center',
      render: (item) => <span className="font-mono text-xs">{formatCurrency(item.openingCash)}</span>,
    },
    {
      key: 'expectedCash',
      header: 'الرصيد المتوقع بالدرج',
      align: 'center',
      render: (item) => <span className="font-mono text-xs font-semibold text-gray-800">{formatCurrency(item.expectedCash)}</span>,
    },
    {
      key: 'actualCash',
      header: 'الرصيد الفعلي المعدود',
      align: 'center',
      render: (item) =>
        item.actualCash !== null ? (
          <span className="font-mono text-xs font-bold text-gray-900">{formatCurrency(item.actualCash)}</span>
        ) : (
          <span className="text-xs text-gray-400">قيد التشغيل</span>
        ),
    },
    {
      key: 'variance',
      header: 'فارق الجرد',
      align: 'center',
      render: (item) => {
        if (item.variance === null) return <span className="text-xs text-gray-400">-</span>;
        if (item.variance === 0) {
          return <Badge variant="success">متطابق (0.00)</Badge>;
        }
        if (item.variance < 0) {
          return (
            <Badge variant="danger">
              عجز: {formatCurrency(Math.abs(item.variance))}
            </Badge>
          );
        }
        return (
          <Badge variant="warning">
            زيادة: +{formatCurrency(item.variance)}
          </Badge>
        );
      },
    },
    {
      key: 'totalSales',
      header: 'إجمالي المبيعات',
      align: 'left',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-[#0D5C3A]">{formatCurrency(item.totalSales)}</span>
      ),
    },
  ];

  return { salesColumns, topProductColumns, cashierColumns, shiftColumns };
};
