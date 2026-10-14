import { errorMessage } from '../../../utils/errors';
/**
 * NASAQ POS — Order Details Modal (Phase 6)
 * Displays snapshot-accurate order items, customer, table, and financial audit data.
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Clock,
  User,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  FileText,
  Phone,
  MapPin,
  AlertCircle,
  Play,
  Ban,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { OrderDetailDTO, OrderListItemDTO } from '../types';
import { OrderService } from '../services/OrderService';
import { useAuth } from '../../auth/context/AuthContext';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  onContinueOrder?: (orderId: string) => void;
  onCancelOrder?: (order: OrderListItemDTO) => void;
  canCancel?: boolean;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  orderId,
  onContinueOrder,
  onCancelOrder,
  canCancel = false,
}) => {
  const { user } = useAuth();
  const [details, setDetails] = useState<OrderDetailDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !orderId || !user) {
      setDetails(null);
      return;
    }

    let isMounted = true;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const orderService = new OrderService();
        const data = await orderService.getOrderWithDetails(user, orderId);
        if (isMounted) {
          setDetails(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(errorMessage(err, 'تعذر استرجاع تفاصيل الطلب'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, orderId, user]);

  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">معلق</Badge>;
      case 'HOLD':
        return <Badge variant="warning">معلق مؤقت</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">مكتمل</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">ملغي</Badge>;
      case 'RETURNED':
        return <Badge variant="neutral">مرتجع</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getOrderTypeBadge = (type: string) => {
    switch (type) {
      case 'DINE_IN':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
            <UtensilsCrossed size={12} />
            <span>صالة</span>
          </span>
        );
      case 'DELIVERY':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#A7F3D0]">
            <Bike size={12} />
            <span>دليفري</span>
          </span>
        );
      case 'TAKEAWAY':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#374151] bg-[#F3F4F6] px-2 py-0.5 rounded border border-[#E5E7EB]">
            <ShoppingBag size={12} />
            <span>تيك أواي</span>
          </span>
        );
    }
  };

  const order = details?.order;
  const items = details?.items || [];
  const isPending = order?.status === 'PENDING' || order?.status === 'HOLD';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-[#0F172A]">
              تفاصيل الطلب {order ? order.order_number : ''}
            </h3>
            {order && getStatusBadge(order.status)}
            {order && getOrderTypeBadge(order.order_type)}
          </div>
          <button
            type="button"
            id="btn-close-order-details"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A] p-1 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-[#64748B]">
              جاري تحميل بيانات الطلب...
            </div>
          ) : error ? (
            <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : !order ? (
            <div className="py-12 text-center text-xs text-[#64748B]">لا توجد بيانات لهذا الطلب</div>
          ) : (
            <>
              {/* Order Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] text-xs">
                <div>
                  <span className="text-[#64748B] block mb-0.5">تاريخ ووقت الإنشاء</span>
                  <div className="flex items-center gap-1 font-semibold text-[#0F172A]">
                    <Clock size={12} className="text-[#94A3B8]" />
                    <span>{formatDateTime(order.created_at)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[#64748B] block mb-0.5">الكاشير</span>
                  <div className="flex items-center gap-1 font-semibold text-[#0F172A]">
                    <User size={12} className="text-[#94A3B8]" />
                    <span>{order.cashier_name}</span>
                  </div>
                </div>

                {order.table_number && (
                  <div>
                    <span className="text-[#64748B] block mb-0.5">الطاولة</span>
                    <div className="flex items-center gap-1 font-bold text-[#1E3A8A]">
                      <UtensilsCrossed size={12} className="text-[#3B82F6]" />
                      <span>{order.table_number}</span>
                    </div>
                  </div>
                )}

                {order.customer_name && (
                  <div>
                    <span className="text-[#64748B] block mb-0.5">العميل</span>
                    <div className="flex items-center gap-1 font-semibold text-[#065F46]">
                      <User size={12} className="text-[#10B981]" />
                      <span>{order.customer_name}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Extra Details if present */}
              {(order.customer_phone || order.customer_address) && (
                <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md text-xs space-y-1">
                  {order.customer_phone && (
                    <div className="flex items-center gap-1.5 text-[#166534]">
                      <Phone size={13} className="text-[#22C55E]" />
                      <span className="font-semibold">هاتف العميل:</span>
                      <span dir="ltr">{order.customer_phone}</span>
                    </div>
                  )}
                  {order.customer_address && (
                    <div className="flex items-center gap-1.5 text-[#166534]">
                      <MapPin size={13} className="text-[#22C55E]" />
                      <span className="font-semibold">عنوان التوصيل:</span>
                      <span>{order.customer_address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Items Table with product snapshot verification */}
              <div>
                <h4 className="text-xs font-bold text-[#0F172A] mb-2">أصناف الطلب (اللقطة التاريخية)</h4>
                <div className="border border-[#E2E8F0] rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[#F1F5F9] text-[#475569] border-b border-[#E2E8F0]">
                      <tr>
                        <th className="py-2 px-3 text-right font-semibold">الصنف</th>
                        <th className="py-2 px-3 text-center font-semibold">سعر الوحدة</th>
                        <th className="py-2 px-3 text-center font-semibold">الكمية</th>
                        <th className="py-2 px-3 text-left font-semibold">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F8FAFC]">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#0F172A]">
                              {item.product_name_snapshot}
                            </div>
                            {item.notes && (
                              <div className="text-[11px] text-[#64748B] mt-0.5">
                                ملاحظة: {item.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-[#475569]">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-[#0F172A]">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-left font-bold text-[#0F172A]">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md space-y-1.5 text-xs">
                <div className="flex justify-between text-[#64748B]">
                  <span>المجموع الفرعي:</span>
                  <span className="font-semibold text-[#0F172A]">{formatCurrency(order.subtotal)}</span>
                </div>

                {order.delivery_fee > 0 && (
                  <div className="flex justify-between text-[#64748B]">
                    <span>رسوم التوصيل:</span>
                    <span className="font-semibold text-[#0F172A]">{formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}

                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-[#DC2626]">
                    <span>الخصم:</span>
                    <span className="font-semibold">-{formatCurrency(order.discount_amount)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-[#E2E8F0] pt-2 text-sm font-bold text-[#0F172A]">
                  <span>الإجمالي الصافي:</span>
                  <span className="text-[#0F172A]">{formatCurrency(order.total)}</span>
                </div>
              </div>

              {/* Order Notes if present */}
              {order.notes && (
                <div className="p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded text-xs text-[#92400E]">
                  <span className="font-bold block mb-0.5">ملاحظات الطلب:</span>
                  <p>{order.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {order && isPending && onContinueOrder && (
              <Button
                id="btn-modal-continue-order"
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  onContinueOrder(order.id);
                }}
                className="font-bold flex items-center gap-1.5"
              >
                <Play size={14} />
                <span>استكمال الطلب في الكاشير</span>
              </Button>
            )}

            {order && isPending && canCancel && onCancelOrder && (
              <Button
                id="btn-modal-cancel-order"
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  onClose();
                  onCancelOrder(order);
                }}
                className="font-semibold flex items-center gap-1.5"
              >
                <Ban size={14} />
                <span>إلغاء الطلب</span>
              </Button>
            )}
          </div>

          <Button
            id="btn-modal-close"
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
};
