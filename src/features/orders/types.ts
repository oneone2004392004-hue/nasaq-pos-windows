/**
 * NASAQ POS — Orders Feature Types (Phase 6)
 * Pure domain interfaces and DTOs for Order Lifecycle Management.
 */

import { OrderRow, OrderItemRow } from '../../domain/dbModels';
import { OrderType } from '../../domain/enums';

export type DateFilterPreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'CUSTOM';

export interface OrderFilterParams {
  status?: 'ALL' | OrderRow['status'];
  orderType?: 'ALL' | OrderType;
  datePreset?: DateFilterPreset;
  customDate?: string; // YYYY-MM-DD
  search?: string; // Search order_number, customer name, phone, table
  userId?: string;
  referenceDate?: string; // Deterministic testing support (ISO string or YYYY-MM-DD)
  limit?: number;
  offset?: number;
}

export interface OrderListItemDTO {
  id: string;
  order_number: string;
  order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  status: OrderRow['status'];
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  table_id?: string | null;
  table_number: string | null;
  delivery_driver_id?: string | null;
  delivery_driver_name?: string | null;
  delivery_driver_phone?: string | null;
  delivery_status?: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null;
  shift_id: string;
  user_id: string;
  cashier_name: string;
  items_count: number;
  subtotal: number; // minor units
  discount_amount: number; // minor units
  tax_amount: number; // minor units
  delivery_fee: number; // minor units
  total: number; // minor units
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderDetailDTO {
  order: OrderListItemDTO;
  items: OrderItemRow[];
}

export interface UpdateOrderDraftDTO {
  order_type?: OrderType;
  table_id?: string | null;
  table_number?: string | null;
  delivery_driver_id?: string | null;
  delivery_status?: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  delivery_fee?: number;
  discount_amount?: number;
  discount_type?: 'PERCENTAGE' | 'FIXED';
  discount_value?: number;
  notes?: string | null;
  items: {
    productId: string;
    quantity: number;
    notes?: string | null;
  }[];
}
