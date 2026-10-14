/**
 * NASAQ POS — Cart Hook & State Management (Phase 5)
 * Pure, testable, serializable client state for POS order cart.
 * ZERO floating-point logic. Integer minor units only.
 */

import { useState, useMemo, useCallback } from 'react';
import { CartItem, CartTotals, calculateCartTotals, DeliveryCustomerInfo } from '../../../domain/cart';
import { OrderType } from '../../../domain/enums';
import { CreateOrderDraftDTO } from '../../orders/validation';
import { OrderDetailDTO } from '../../orders/types';

export interface UsePOSCartReturn {
  items: CartItem[];
  orderType: OrderType;
  selectedTable: string | null;
  deliveryCustomer: DeliveryCustomerInfo | null;
  deliveryFee: number;
  discountAmount: number;
  orderNotes: string;
  totals: CartTotals;
  editingOrderId: string | null;
  editingOrderNumber: string | null;
  addItem: (product: { id: string; name: string; price?: number; selling_price?: number; barcode?: string | null; unit?: string }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  setOrderType: (type: OrderType) => void;
  setSelectedTable: (table: string | null) => void;
  setDeliveryCustomer: (customer: DeliveryCustomerInfo | null) => void;
  setDeliveryFee: (feeMinor: number) => void;
  setDiscountAmount: (discountMinor: number) => void;
  setOrderNotes: (notes: string) => void;
  clearCart: () => void;
  loadExistingOrder: (details: OrderDetailDTO) => void;
  clearEditingOrder: () => void;
  isOrderValid: boolean;
  orderValidationError: string | null;
  getDraftPayload: () => CreateOrderDraftDTO;
}

export function usePOSCart(): UsePOSCartReturn {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderType, setOrderTypeState] = useState<OrderType>(OrderType.TAKEAWAY);
  const [selectedTable, setSelectedTableState] = useState<string | null>(null);
  const [deliveryCustomer, setDeliveryCustomerState] = useState<DeliveryCustomerInfo | null>(null);
  const [deliveryFee, setDeliveryFeeState] = useState<number>(0);
  const [discountAmount, setDiscountAmountState] = useState<number>(0);
  const [orderNotes, setOrderNotesState] = useState<string>('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderNumber, setEditingOrderNumber] = useState<string | null>(null);

  // Calculate totals deterministically with pure domain function
  const totals = useMemo(() => {
    return calculateCartTotals(items, orderType, {
      deliveryFeeMinor: deliveryFee,
      discountMinor: discountAmount,
    });
  }, [items, orderType, deliveryFee, discountAmount]);

  // Add Item to cart (or increment existing)
  const addItem = useCallback(
    (product: { id: string; name: string; price?: number; selling_price?: number; barcode?: string | null; unit?: string }) => {
      const finalPrice = product.price ?? product.selling_price ?? 0;
      setItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.productId === product.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const existing = updated[existingIdx];
          updated[existingIdx] = {
            ...existing,
            quantity: existing.quantity + 1,
          };
          return updated;
        }

        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          unitPriceMinor: finalPrice,
          quantity: 1,
          barcode: product.barcode,
          unit: product.unit,
        };
        return [...prev, newItem];
      });
    },
    []
  );

  // Remove item by product ID
  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  // Update item quantity directly
  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    const cleanQty = Math.floor(quantity);
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: cleanQty } : i))
    );
  }, []);

  // Increment item quantity
  const incrementQuantity = useCallback((productId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i))
    );
  }, []);

  // Decrement item quantity (removes if reaches 0)
  const decrementQuantity = useCallback((productId: string) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.productId === productId) {
            const nextQty = i.quantity - 1;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter((i): i is CartItem => i !== null)
    );
  }, []);

  // Set order type and reset specific contextual fields
  const setOrderType = useCallback((type: OrderType) => {
    setOrderTypeState(type);
    if (type !== OrderType.DINE_IN) {
      setSelectedTableState(null);
    }
    if (type !== OrderType.DELIVERY) {
      setDeliveryFeeState(0);
    }
  }, []);

  // Reset entire cart state
  const clearCart = useCallback(() => {
    setItems([]);
    setSelectedTableState(null);
    setDeliveryCustomerState(null);
    setDeliveryFeeState(0);
    setDiscountAmountState(0);
    setOrderNotesState('');
    setEditingOrderId(null);
    setEditingOrderNumber(null);
  }, []);

  // Clear editing order mode only
  const clearEditingOrder = useCallback(() => {
    setEditingOrderId(null);
    setEditingOrderNumber(null);
  }, []);

  // Load existing order into cart for editing
  const loadExistingOrder = useCallback(({ order, items: orderItems }: OrderDetailDTO) => {
    setEditingOrderId(order.id);
    setEditingOrderNumber(order.order_number);
    setOrderTypeState(order.order_type as OrderType);
    setSelectedTableState(order.table_number || null);
    
    if (order.customer_id || order.customer_name || order.customer_phone) {
      setDeliveryCustomerState({
        id: order.customer_id || undefined,
        name: order.customer_name || '',
        phone: order.customer_phone || '',
        address: order.customer_address || '',
      });
    } else {
      setDeliveryCustomerState(null);
    }

    setDeliveryFeeState(order.delivery_fee || 0);
    setDiscountAmountState(order.discount_amount || 0);
    setOrderNotesState(order.notes || '');

    const mappedItems: CartItem[] = orderItems.map((it) => ({
      productId: it.product_id as string,
      productName: it.product_name_snapshot,
      unitPriceMinor: it.unit_price,
      quantity: it.quantity,
      notes: it.notes || null,
    }));
    setItems(mappedItems);
  }, []);

  // Validation state
  const orderValidationError = useMemo(() => {
    if (items.length === 0) {
      return 'السلة فارغة، أضف صنفاً للبدء';
    }
    if (orderType === OrderType.DINE_IN && !selectedTable) {
      return 'يرجى اختيار رقم أو اسم الطاولة';
    }
    if (orderType === OrderType.DELIVERY) {
      if (!deliveryCustomer?.name && !deliveryCustomer?.phone) {
        return 'يرجى إدخال اسم العميل أو رقم هاتفه للدليفري';
      }
    }
    return null;
  }, [items.length, orderType, selectedTable, deliveryCustomer]);

  const isOrderValid = orderValidationError === null;

  // DTO Payload ready for OrderService
  const getDraftPayload = useCallback((): CreateOrderDraftDTO => {
    return {
      order_type: orderType,
      table_number: orderType === OrderType.DINE_IN ? selectedTable : null,
      customer_id: deliveryCustomer?.id || null,
      customer_name: deliveryCustomer?.name || null,
      customer_phone: deliveryCustomer?.phone || null,
      customer_address: deliveryCustomer?.address || null,
      delivery_fee: orderType === OrderType.DELIVERY ? deliveryFee : 0,
      discount_amount: discountAmount,
      notes: orderNotes.trim() || null,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        notes: i.notes || null,
      })),
    };
  }, [orderType, selectedTable, deliveryCustomer, deliveryFee, discountAmount, orderNotes, items]);

  return {
    items,
    orderType,
    selectedTable,
    deliveryCustomer,
    deliveryFee,
    discountAmount,
    orderNotes,
    totals,
    editingOrderId,
    editingOrderNumber,
    addItem,
    removeItem,
    updateQuantity,
    incrementQuantity,
    decrementQuantity,
    setOrderType,
    setSelectedTable: setSelectedTableState,
    setDeliveryCustomer: setDeliveryCustomerState,
    setDeliveryFee: setDeliveryFeeState,
    setDiscountAmount: setDiscountAmountState,
    setOrderNotes: setOrderNotesState,
    clearCart,
    loadExistingOrder,
    clearEditingOrder,
    isOrderValid,
    orderValidationError,
    getDraftPayload,
  };
}
