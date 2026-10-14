import React from 'react';
import { Input } from '../../../components/ui/Input';
import type { POSPageController } from '../hooks/usePOSPageController';
import { UtensilsCrossed, ShoppingBag, Bike, Trash2, FileText, AlertCircle, CheckCircle2, TableProperties, UserCheck, RefreshCw, XCircle, CreditCard, Banknote, Clock, Printer } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { CartList } from './CartList';
import { OrderType } from '../../../domain/enums';
import { formatCurrency } from '../../../utils/formatters';
import { cn } from '../../../utils/cn';


interface Props { controller: POSPageController; }

export const POSCartPanel: React.FC<Props> = ({ controller }) => (
      <div className="w-full lg:w-96 xl:w-[410px] bg-white flex flex-col h-full shrink-0 border-t lg:border-t-0 lg:border-r border-[#E2EBF5] shadow-[-8px_0_24px_rgba(13,45,82,0.04)]">
        {/* Cart Header: Order Types & Context */}
        <div className="p-3 border-b border-[#E2E8F0] flex flex-col gap-3">
          {/* Quick status bar */}
          <div className="flex items-center justify-between pb-1 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#1E293B]">
                {controller.cart.editingOrderId ? 'تعديل طلب' : 'الطلب الحالي'}
              </span>
              <span className="text-[11px] text-[#64748B] font-mono">
                ({controller.cart.totals.unitsCount} قطعة)
              </span>
            </div>

            <Button
              id="pos-btn-open-orders-controller.cart"
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => controller.setIsOpenOrdersOpen(true)}
              className={cn(
                'h-7 px-2.5 text-[11px] font-bold flex items-center gap-1.5 rounded-sm border transition-colors cursor-pointer',
                controller.pendingOrdersCount > 0
                  ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A] hover:bg-[#FEF3C7]'
                  : 'bg-white text-[#475569] border-[#D8E3F0] hover:bg-[#F8FAFC]'
              )}
              title="عرض الطلبات المعلقة (F3)"
            >
              <Clock size={12} className={controller.pendingOrdersCount > 0 ? 'text-[#D97706]' : 'text-[#64748B]'} />
              <span>معلقة</span>
              {controller.pendingOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#D97706] text-white rounded-full text-[10px] font-mono leading-none font-bold">
                  {controller.pendingOrdersCount}
                </span>
              )}
              <span className="text-[9px] text-[#94A3B8] font-mono">F3</span>
            </Button>
          </div>

          {/* Edit Mode Banner if editing existing pending order */}
          {controller.cart.editingOrderId && (
            <div className="p-2.5 bg-[#FEF3C7] border border-[#F59E0B]/40 rounded-sm text-xs text-[#92400E] flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle size={15} className="text-[#D97706] shrink-0" />
                <span>تعديل الطلب المعلق: {controller.cart.editingOrderNumber || controller.cart.editingOrderId}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  controller.cart.clearCart();
                  controller.setSearchParams({});
                }}
                className="text-[11px] font-semibold text-[#B45309] hover:text-[#78350F] underline cursor-pointer"
              >
                إلغاء والبدء بجديد
              </button>
            </div>
          )}

          {/* No Open Shift Banner */}
          {!controller.activeShift && (
            <div className="p-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-sm text-xs text-[#92400E] flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertCircle size={14} className="text-[#D97706] shrink-0" />
                <span>لا توجد وردية مفتوحة</span>
              </div>
              <button
                type="button"
                onClick={() => controller.setIsOpenShiftModalOpen(true)}
                className="text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer bg-white px-2 py-0.5 rounded border border-[#BFDBFE]"
              >
                فتح وردية
              </button>
            </div>
          )}

          {/* Order Type Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#F1F5F9] rounded-md border border-[#E2E8F0]">
            <button
              id="btn-ordertype-takeaway"
              type="button"
              onClick={() => controller.cart.setOrderType(OrderType.TAKEAWAY)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer',
                controller.cart.orderType === OrderType.TAKEAWAY
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              <ShoppingBag size={13} />
              <span>تيك أواي</span>
            </button>

            <button
              id="btn-ordertype-dinein"
              type="button"
              onClick={() => {
                controller.cart.setOrderType(OrderType.DINE_IN);
                if (!controller.cart.selectedTable) {
                  controller.setIsTableModalOpen(true);
                }
              }}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer',
                controller.cart.orderType === OrderType.DINE_IN
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              <UtensilsCrossed size={13} />
              <span>صالة</span>
            </button>

            <button
              id="btn-ordertype-delivery"
              type="button"
              onClick={() => {
                controller.cart.setOrderType(OrderType.DELIVERY);
                if (!controller.cart.deliveryCustomer) {
                  controller.setIsDeliveryModalOpen(true);
                }
              }}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer',
                controller.cart.orderType === OrderType.DELIVERY
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              <Bike size={13} />
              <span>دليفري</span>
            </button>
          </div>

          {/* Context Details (Table badge or Customer badge) */}
          {controller.cart.orderType === OrderType.DINE_IN && (
            <div className="flex items-center justify-between p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm text-xs">
              <div className="flex items-center gap-2">
                <TableProperties size={15} className="text-[#475569]" />
                <span className="font-semibold text-[#1E293B]">
                  {controller.cart.selectedTable ? controller.cart.selectedTable : 'لم يتم تحديد طاولة'}
                </span>
              </div>
              <Button
                id="btn-open-table-modal"
                variant="secondary"
                size="sm"
                onClick={() => controller.setIsTableModalOpen(true)}
                className="h-7 text-[11px] px-2"
              >
                {controller.cart.selectedTable ? 'تغيير الطاولة' : 'اختيار طاولة'}
              </Button>
            </div>
          )}

          {controller.cart.orderType === OrderType.DELIVERY && (
            <div className="flex items-center justify-between p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm text-xs">
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <UserCheck size={15} className="text-[#475569] shrink-0" />
                <div className="truncate">
                  <span className="font-semibold text-[#1E293B]">
                    {controller.cart.deliveryCustomer?.name || 'بيانات العميل غير مسجلة'}
                  </span>
                  {controller.cart.deliveryCustomer?.phone && (
                    <span className="text-[10px] text-[#64748B] font-mono mr-1">
                      ({controller.cart.deliveryCustomer.phone})
                    </span>
                  )}
                </div>
              </div>
              <Button
                id="btn-open-delivery-modal"
                variant="secondary"
                size="sm"
                onClick={() => controller.setIsDeliveryModalOpen(true)}
                className="h-7 text-[11px] px-2 shrink-0"
              >
                {controller.cart.deliveryCustomer ? 'تعديل البيانات' : 'إضافة العميل'}
              </Button>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <CartList
          items={controller.cart.items}
          onIncrement={controller.cart.incrementQuantity}
          onDecrement={controller.cart.decrementQuantity}
          onRemove={controller.cart.removeItem}
          onUpdateQuantity={controller.cart.updateQuantity}
        />

        {/* Optional Order Notes */}
        <div className="px-3 py-2 border-t border-[#E2E8F0] bg-[#F4F8FD]">
          <Input
            id="input-pos-order-notes"
            placeholder="ملاحظات عامة على الطلب (اختياري)..."
            value={controller.cart.orderNotes}
            onChange={(e) => controller.cart.setOrderNotes(e.target.value)}
            className="h-8 text-xs bg-white"
          />
        </div>

        {/* Financial Totals Summary */}
        <div className="p-3.5 border-t border-[#E2E8F0] bg-white flex flex-col gap-2 shrink-0">
          <div className="flex justify-between text-xs text-[#64748B]">
            <span>المجموع الفرعي ({controller.cart.totals.unitsCount} قطعة)</span>
            <span className="font-mono font-semibold text-[#1E293B]">
              {formatCurrency(controller.cart.totals.subtotalMinor)}
            </span>
          </div>

          {controller.cart.orderType === OrderType.DELIVERY && controller.cart.totals.deliveryFeeMinor > 0 && (
            <div className="flex justify-between text-xs text-[#64748B]">
              <span>رسوم التوصيل</span>
              <span className="font-mono font-semibold text-[#1E293B]">
                {formatCurrency(controller.cart.totals.deliveryFeeMinor)}
              </span>
            </div>
          )}

          {controller.cart.totals.discountMinor > 0 && (
            <div className="flex justify-between text-xs text-[#DC2626]">
              <span>الخصم</span>
              <span className="font-mono font-semibold">
                -{formatCurrency(controller.cart.totals.discountMinor)}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-[#E2E8F0] flex justify-between items-baseline">
            <span className="text-sm font-bold text-[#0F172A]">الإجمالي الكلي</span>
            <span
              id="pos-controller.cart-total"
              className="text-xl font-bold font-mono text-[#0F172A] tracking-tight"
            >
              {formatCurrency(controller.cart.totals.totalMinor)}
            </span>
          </div>

          {/* Validation Error hint when present */}
          {controller.cart.orderValidationError && controller.cart.items.length > 0 && (
            <div className="text-[11px] text-[#DC2626] bg-[#FEF2F2] p-1.5 rounded-xs border border-[#FECACA] text-center font-medium">
              {controller.cart.orderValidationError}
            </div>
          )}

          {/* Bottom Actions: Clear, Save Draft, Send to Kitchen, and Pay */}
          <div className="flex flex-col gap-2 pt-1">
            {/* Main Primary Action: PAY NOW (F4) */}
            <Button
              id="btn-pos-pay"
              type="button"
              variant="primary"
              onClick={controller.handleInitiatePayment}
              disabled={!controller.cart.isOrderValid || controller.isSubmittingDraft}
              className="w-full h-12 text-sm font-bold bg-[#16A34A] hover:bg-[#15803D] text-white flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Banknote size={18} />
              <span>دفع وسداد (F4) — {formatCurrency(controller.cart.totals.totalMinor)}</span>
            </Button>

            <div className="grid grid-cols-5 gap-2">
              <Button
                id="btn-pos-clear-controller.cart"
                type="button"
                variant="secondary"
                onClick={() => {
                  controller.cart.clearCart();
                  if (controller.urlOrderId) controller.setSearchParams({});
                }}
                disabled={controller.cart.items.length === 0 || controller.isSubmittingDraft}
                className="col-span-1 text-xs text-[#DC2626] hover:bg-[#FEF2F2] flex items-center justify-center cursor-pointer"
                title="تفريغ السلة (Esc)"
              >
                <Trash2 size={16} />
              </Button>

              <Button
                id="btn-pos-send-kitchen"
                type="button"
                variant="secondary"
                onClick={() => controller.handleSaveOrder(true)}
                disabled={!controller.cart.isOrderValid || controller.isSubmittingDraft}
                className="col-span-2 h-10 text-[11px] font-bold flex items-center justify-center gap-1.5 text-[#0369A1] bg-[#F0F9FF] border-[#BAE6FD] hover:bg-[#E0F2FE] cursor-pointer"
                title="إرسال تذكرة التجهيز للمطبخ وحفظ كطلب معلق (F9)"
              >
                <Printer size={14} />
                <span>إرسال للمطبخ (F9)</span>
              </Button>

              <Button
                id="btn-pos-save-draft"
                type="button"
                variant="secondary"
                onClick={() => controller.handleSaveOrder(false)}
                disabled={!controller.cart.isOrderValid || controller.isSubmittingDraft}
                className="col-span-2 h-10 text-[11px] font-bold flex items-center justify-center gap-1.5 text-[#334155] cursor-pointer"
                title="حفظ الطلب كطلب معلق بدون طباعة"
              >
                <FileText size={14} />
                <span>{controller.cart.editingOrderId ? 'تحديث معلق' : 'حفظ معلق'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>


);
