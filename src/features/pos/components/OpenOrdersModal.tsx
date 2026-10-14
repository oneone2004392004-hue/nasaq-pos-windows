/**
 * NASAQ POS — Open / Pending Orders Modal (Phase 15)
 * Allows cashiers in busy restaurants to quickly view and resume active pending orders
 * (Dine-in tables, delivery drafts, takeaway holds) directly from the POS screen without
 * navigating away to back-office management pages.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import {
  Clock,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  Search,
  RefreshCw,
  Play,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { OrderListItemDTO } from '../../orders/types';
import { OrderService } from '../../orders/services/OrderService';
import { useAuth } from '../../auth/context/AuthContext';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';

interface OpenOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (orderId: string, immediatePay?: boolean) => void;
}

export const OpenOrdersModal: React.FC<OpenOrdersModalProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
}) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderListItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('ALL');
  const orderService = useMemo(() => new OrderService(), []);

  const fetchOpenOrders = useCallback(async () => {
    if (!user || !isOpen) return;
    try {
      setLoading(true);
      const data = await orderService.listOrders(user, {
        status: 'PENDING',
        orderType: typeFilter,
        search: search.trim(),
      });
      setOrders(data);
    } catch (err) {
      console.error('Failed to load open orders in POS:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isOpen, typeFilter, search, orderService]);

  useEffect(() => {
    fetchOpenOrders();
  }, [fetchOpenOrders]);

  // Calculate elapsed time from created_at
  const getElapsedMinutes = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diffMs / (1000 * 60));
      if (minutes < 1) return 'الآن';
      if (minutes < 60) return `منذ ${minutes} دقيقة`;
      const hours = Math.floor(minutes / 60);
      return `منذ ${hours} س و ${minutes % 60} د`;
    } catch {
      return '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="الطلبات المعلقة والنشطة (صالة / دليفري / تيك أواي)"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-[#64748B]">
            إجمالي الطلبات المعلقة:{' '}
            <span className="font-bold text-[#0F172A] font-mono">{orders.length}</span>
          </div>
          <Button variant="secondary" onClick={onClose} size="sm">
            إغلاق (Esc)
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Controls: Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-md text-xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-sm font-medium transition-colors cursor-pointer',
                typeFilter === 'ALL'
                  ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('DINE_IN')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-sm font-medium transition-colors cursor-pointer',
                typeFilter === 'DINE_IN'
                  ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              <UtensilsCrossed size={12} />
              <span>الصالة</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('DELIVERY')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-sm font-medium transition-colors cursor-pointer',
                typeFilter === 'DELIVERY'
                  ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              <Bike size={12} />
              <span>الدليفري</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('TAKEAWAY')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-sm font-medium transition-colors cursor-pointer',
                typeFilter === 'TAKEAWAY'
                  ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              <ShoppingBag size={12} />
              <span>تيك أواي</span>
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute right-2.5 top-2.5 text-[#94A3B8]" />
            <Input
              placeholder="بحث برقم الطلب أو العميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pr-8 text-xs"
            />
          </div>
        </div>

        {/* Orders List / Cards */}
        <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-0.5">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-xs text-[#64748B] gap-2">
              <RefreshCw size={14} className="animate-spin text-[#0D4EAE]" />
              <span>جاري تحميل الطلبات المعلقة...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-[#64748B] bg-[#F8FAFC] rounded-md border border-dashed border-[#E2E8F0]">
              <Clock size={32} className="text-[#94A3B8] mb-2 stroke-1" />
              <p className="text-xs font-semibold text-[#334155]">لا توجد طلبات معلقة حالياً</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                جميع الطلبات مسددة ومكتملة أو ملغاة
              </p>
            </div>
          ) : (
            orders.map((ord) => {
              const elapsed = getElapsedMinutes(ord.created_at);

              return (
                <div
                  key={ord.id}
                  id={`open-order-${ord.id}`}
                  className="flex items-center justify-between p-3 bg-white border border-[#E2E8F0] hover:border-[#0D4EAE] rounded-md transition-all shadow-2xs"
                >
                  {/* Right info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-md flex items-center justify-center text-xs font-bold',
                        ord.order_type === 'DINE_IN'
                          ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                          : ord.order_type === 'DELIVERY'
                          ? 'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]'
                          : 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]'
                      )}
                    >
                      {ord.order_type === 'DINE_IN' ? (
                        <UtensilsCrossed size={16} />
                      ) : ord.order_type === 'DELIVERY' ? (
                        <Bike size={16} />
                      ) : (
                        <ShoppingBag size={16} />
                      )}
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#0F172A]">
                          {ord.order_number}
                        </span>
                        {ord.table_number && (
                          <span className="px-1.5 py-0.5 bg-[#FEF2F2] text-[#991B1B] font-bold text-[10px] rounded border border-[#FECACA]">
                            {ord.table_number}
                          </span>
                        )}
                        {ord.customer_name && (
                          <span className="text-xs font-medium text-[#334155]">
                            {ord.customer_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={11} />
                          {elapsed}
                        </span>
                        <span>•</span>
                        <span>{ord.items_count} أصناف</span>
                        {ord.cashier_name && (
                          <>
                            <span>•</span>
                            <span>الكاشير: {ord.cashier_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Left: Total & Quick Actions */}
                  <div className="flex items-center gap-2">
                    <div className="text-left pl-2">
                      <div className="text-xs font-bold font-mono text-[#0F172A]">
                        {formatCurrency(ord.total)}
                      </div>
                      <div className="text-[10px] text-[#DC2626] font-medium">غير مسدد</div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        id={`btn-open-order-${ord.id}`}
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          onSelectOrder(ord.id, false);
                          onClose();
                        }}
                        className="h-8 text-xs px-2.5"
                        title="فتح الطلب لتعديله أو إضافة أصناف"
                      >
                        <Play size={12} className="rotate-180" />
                        <span>فتح في الكاشير</span>
                      </Button>

                      <Button
                        id={`btn-pay-order-${ord.id}`}
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          onSelectOrder(ord.id, true);
                          onClose();
                        }}
                        className="h-8 text-xs px-2.5 bg-[#166534] hover:bg-[#14532D]"
                        title="الانتقال مباشرة لشاشة الدفع وسداد الطلب"
                      >
                        <CreditCard size={12} />
                        <span>سداد</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
