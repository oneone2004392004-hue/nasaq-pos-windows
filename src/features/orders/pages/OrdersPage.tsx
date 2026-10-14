import { errorMessage } from '../../../utils/errors';
/**
 * NASAQ POS — Orders Management Screen (Phase 6)
 * Real domain integration, lifecycle filtering (PENDING, COMPLETED, CANCELLED),
 * date presets, snapshot inspection, cancel order flow, and continue in POS.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
  RefreshCw,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Eye,
  Play,
  Ban,
  AlertCircle,
  Clock,
  User,
  Calendar,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { OrderService } from '../services/OrderService';
import { OrderListItemDTO, DateFilterPreset } from '../types';
import { OrderType } from '../../../domain/enums';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { CancelOrderModal } from '../components/CancelOrderModal';
import { OrdersFilterBar } from '../components/OrdersFilterBar';
import { cn } from '../../../utils/cn';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasAnyPermission } = useAuth();
  const [urlSearchParams] = useSearchParams();

  // Permissions check
  const canView = hasAnyPermission('orders.view', 'pos.view_menu', 'pos.create_order');
  const canCancel = hasAnyPermission('pos.cancel_order', 'orders.manage');
  const canManage = hasAnyPermission('orders.manage', 'pos.create_order');

  // Filter States
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'HOLD'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('ALL');
  const [searchQuery, setSearchQuery] = useState(() => urlSearchParams.get('search') || '');

  // Data States
  const [orders, setOrders] = useState<OrderListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<OrderListItemDTO | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const orderService = useMemo(() => new OrderService(), []);

  // Fetch orders from domain service
  const loadOrders = useCallback(async () => {
    if (!user || !canView) return;

    try {
      setLoading(true);
      setError(null);

      const data = await orderService.listOrders(user, {
        status: statusFilter,
        orderType: typeFilter,
        datePreset: dateFilter,
        search: searchQuery.trim(),
      });

      setOrders(data);
    } catch (err: unknown) {
      setError(errorMessage(err, 'تعذر تحميل قائمة الطلبات'));
    } finally {
      setLoading(false);
    }
  }, [user, canView, statusFilter, typeFilter, dateFilter, searchQuery, orderService]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // Quick Action: Continue Pending Order in POS
  const handleContinueOrder = (orderId: string) => {
    void navigate(`/pos?orderId=${encodeURIComponent(orderId)}`);
  };

  // Quick Action: Open Cancel Modal
  const handleOpenCancelModal = (order: OrderListItemDTO) => {
    setOrderToCancel(order);
    setIsCancelModalOpen(true);
  };

  // Execute cancellation
  const handleConfirmCancel = async (orderId: string, reason: string) => {
    if (!user) return;
    try {
      await orderService.cancelDraftOrder(user, orderId, reason);
      setFeedback({
        type: 'success',
        text: 'تم إلغاء الطلب المعلق بنجاح وتحرير الطاولة المرتبطة به.',
      });
      await loadOrders();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: errorMessage(err, 'تعذر إلغاء الطلب'),
      });
      throw err;
    }
  };

  // Summary Metrics (Minimal header indicators)
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'HOLD').length;
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    const completedRevenue = completedOrders.reduce((acc, curr) => acc + curr.total, 0);

    return { totalOrders, pendingOrders, completedOrdersCount: completedOrders.length, completedRevenue };
  }, [orders]);

  // Order Table Columns
  const columns: Column<OrderListItemDTO>[] = [
    {
      key: 'order_number',
      header: 'رقم الطلب',
      width: '120px',
      render: (item) => (
        <span className="font-bold text-[#0F172A] tracking-wider">{item.order_number}</span>
      ),
    },
    {
      key: 'order_type',
      header: 'نوع الطلب',
      render: (item) => {
        if (item.order_type === 'DINE_IN') {
          return (
            <div className="flex items-center gap-1.5 text-xs text-[#1E3A8A]">
              <UtensilsCrossed size={14} className="text-[#3B82F6]" />
              <span className="font-semibold">صالة {item.table_number ? `(${item.table_number})` : ''}</span>
            </div>
          );
        }
        if (item.order_type === 'DELIVERY') {
          return (
            <div className="flex items-center gap-1.5 text-xs text-[#065F46]">
              <Bike size={14} className="text-[#10B981]" />
              <span className="font-semibold">دليفري {item.customer_name ? `(${item.customer_name})` : ''}</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5 text-xs text-[#475569]">
            <ShoppingBag size={14} className="text-[#64748B]" />
            <span className="font-semibold">تيك أواي</span>
          </div>
        );
      },
    },
    {
      key: 'cashier_name',
      header: 'الكاشير',
      render: (item) => (
        <span className="text-xs text-[#475569]">{item.cashier_name}</span>
      ),
    },
    {
      key: 'items_count',
      header: 'الأصناف',
      align: 'center',
      width: '80px',
      render: (item) => (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#F1F5F9] text-[#334155]">
          {item.items_count}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'الإجمالي',
      render: (item) => (
        <span className="font-bold text-[#0F172A] tabular-nums">
          {formatCurrency(item.total)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (item) => {
        switch (item.status) {
          case 'PENDING':
            return <Badge variant="warning" size="sm">معلق</Badge>;
          case 'HOLD':
            return <Badge variant="warning" size="sm">معلق مؤقت</Badge>;
          case 'COMPLETED':
            return <Badge variant="success" size="sm">مكتمل</Badge>;
          case 'CANCELLED':
            return <Badge variant="danger" size="sm">ملغي</Badge>;
          case 'RETURNED':
            return <Badge variant="neutral" size="sm">مرتجع</Badge>;
          default:
            return <Badge variant="neutral" size="sm">{item.status}</Badge>;
        }
      },
    },
    {
      key: 'created_at',
      header: 'التاريخ والوقت',
      render: (item) => (
        <span className="text-xs text-[#64748B] tabular-nums">
          {formatDateTime(item.created_at)}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'الإجراءات',
      align: 'left',
      render: (item) => {
        const isPending = item.status === 'PENDING' || item.status === 'HOLD';
        return (
          <div className="flex items-center justify-end gap-1">
            {/* View Details */}
            <Button
              id={`btn-view-order-${item.id}`}
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedOrderId(item.id);
                setIsDetailsOpen(true);
              }}
              title="عرض تفاصيل الطلب والأصناف"
              className="h-8 w-8 p-0"
            >
              <Eye size={14} />
            </Button>

            {/* Continue in POS if PENDING */}
            {isPending && canManage && (
              <Button
                id={`btn-continue-order-${item.id}`}
                variant="primary"
                size="sm"
                onClick={() => handleContinueOrder(item.id)}
                title="استكمال وتعديل الطلب في الكاشير"
                className="h-8 px-2 text-xs font-semibold flex items-center gap-1"
              >
                <Play size={12} />
                <span>استكمال</span>
              </Button>
            )}

            {/* Cancel Order if PENDING */}
            {isPending && canCancel && (
              <Button
                id={`btn-cancel-order-${item.id}`}
                variant="danger"
                size="sm"
                onClick={() => handleOpenCancelModal(item)}
                title="إلغاء الطلب المعلق"
                className="h-8 w-8 p-0"
              >
                <Ban size={13} />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  if (!canView) {
    return (
      <div className="flex flex-col flex-1 h-full items-center justify-center p-6 bg-[#F8FAFC]">
        <div className="p-6 bg-white rounded-lg border border-[#E2E8F0] shadow-xs text-center max-w-sm">
          <AlertCircle size={36} className="text-[#DC2626] mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#0F172A] mb-1">غير مصرح لك بالوصول</h3>
          <p className="text-xs text-[#64748B]">
            يتطلب عرض سجل الطلبات صلاحية [orders.view]. يرجى مراجعة مسؤول النظام.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F8FAFC]">
      {/* Top Header */}
      <PageHeader
        title="إدارة الطلبات"
        subtitle="عرض ومتابعة دورة حياة الطلبات والطلبات المعلقة واستكمالها"
        actions={
          <div className="flex items-center gap-2">
            <Button
              id="btn-refresh-orders"
              variant="secondary"
              size="sm"
              onClick={loadOrders}
              disabled={loading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>تحديث</span>
            </Button>
            <Button
              id="btn-goto-pos"
              variant="primary"
              size="sm"
              onClick={() => navigate('/pos')}
              className="font-bold flex items-center gap-1.5"
            >
              <ShoppingBag size={14} />
              <span>نقطة البيع (POS)</span>
            </Button>
          </div>
        }
      />

      {/* Metrics Strip */}
      <div className="px-6 py-2.5 bg-white border-b border-[#E2E8F0] flex items-center gap-6 text-xs text-[#475569] shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers size={14} className="text-[#64748B]" />
          <span>إجمالي الطلبات المعروضة:</span>
          <span className="font-bold text-[#0F172A]">{metrics.totalOrders}</span>
        </div>
        <div className="h-4 w-px bg-[#E2E8F0]" />
        <div className="flex items-center gap-1.5">
          <Clock size={14} className="text-[#D97706]" />
          <span>الطلبات المعلقة:</span>
          <span className="font-bold text-[#B45309]">{metrics.pendingOrders}</span>
        </div>
        <div className="h-4 w-px bg-[#E2E8F0]" />
        <div className="flex items-center gap-1.5">
          <span>الطلبات المكتملة:</span>
          <span className="font-bold text-[#0F172A]">{metrics.completedOrdersCount}</span>
        </div>
        <div className="h-4 w-px bg-[#E2E8F0]" />
        <div className="flex items-center gap-1.5">
          <span>إجمالي المبيعات المكتملة:</span>
          <span className="font-bold text-[#0F172A]">{formatCurrency(metrics.completedRevenue)}</span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={cn(
            'px-6 py-2 text-xs flex items-center justify-between border-b shrink-0',
            feedback.type === 'success'
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
              : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
          )}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      <OrdersFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
      />

      {/* Main Table Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs text-[#64748B]">
            جاري تحميل قائمة الطلبات...
          </div>
        ) : error ? (
          <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded flex items-center justify-between">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={loadOrders}>
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={orders}
            keyExtractor={(item) => item.id}
            emptyMessage={
              searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL' || dateFilter !== 'ALL'
                ? 'لا توجد طلبات مطابقة لمعايير البحث والتصفية المحددة'
                : 'لا توجد طلبات مسجلة بالنظام حتى الآن'
            }
          />
        )}
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedOrderId(null);
        }}
        orderId={selectedOrderId}
        onContinueOrder={handleContinueOrder}
        onCancelOrder={handleOpenCancelModal}
        canCancel={canCancel}
      />

      {/* Cancel Order Modal */}
      <CancelOrderModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setOrderToCancel(null);
        }}
        order={orderToCancel}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
};
