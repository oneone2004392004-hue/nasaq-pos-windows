/**
 * NASAQ POS — Domain Cart Calculations & Types (Phase 5)
 * Strictly enforces integer minor units (piasters) for all financial operations.
 * ZERO floating-point arithmetic is permitted in money calculations.
 */

import { OrderType } from './enums';

export interface CartItem {
  productId: string;
  productName: string;
  unitPriceMinor: number; // Integer minor units (e.g. 8500 = 85.00 EGP)
  quantity: number;        // Integer >= 1
  barcode?: string | null;
  unit?: string;
  notes?: string | null;
}

export interface CartTotals {
  subtotalMinor: number;
  deliveryFeeMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  itemsCount: number; // distinct products
  unitsCount: number; // sum of quantities
}

export interface DeliveryCustomerInfo {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
}

/**
 * Calculates line total for a single product entry in minor units.
 * Math: quantity * unitPrice
 */
export function calculateLineTotal(quantity: number, unitPriceMinor: number): number {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر');
  }
  if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new Error('سعر الوحدة يجب أن يكون رقماً صحيحاً غير سالب بالوحدات الصغرى');
  }
  return Math.round(quantity * unitPriceMinor);
}

/**
 * Pure domain function to calculate all cart totals.
 * Guaranteed deterministic, reproducible, and free of floating-point drift.
 */
export function calculateCartTotals(
  items: CartItem[],
  orderType: OrderType,
  options?: {
    deliveryFeeMinor?: number;
    discountMinor?: number;
    taxMinor?: number;
  }
): CartTotals {
  let subtotalMinor = 0;
  let unitsCount = 0;

  for (const item of items) {
    const lineTotal = calculateLineTotal(item.quantity, item.unitPriceMinor);
    subtotalMinor += lineTotal;
    unitsCount += item.quantity;
  }

  const deliveryFee = orderType === OrderType.DELIVERY ? (options?.deliveryFeeMinor ?? 0) : 0;
  const discount = options?.discountMinor ?? 0;
  const tax = options?.taxMinor ?? 0;

  // Total = subtotal + delivery + tax - discount
  const calculatedTotal = subtotalMinor + deliveryFee + tax - discount;
  const totalMinor = Math.max(0, calculatedTotal);

  return {
    subtotalMinor,
    deliveryFeeMinor: deliveryFee,
    discountMinor: discount,
    taxMinor: tax,
    totalMinor,
    itemsCount: items.length,
    unitsCount,
  };
}
