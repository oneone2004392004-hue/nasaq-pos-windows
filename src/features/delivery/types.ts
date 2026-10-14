import { OrderItemRow } from '../../domain/dbModels';
import { DeliveryStatus } from '../../domain/enums';

export interface CreateDriverDTO {
  name: string;
  phone: string;
}

export interface UpdateDriverDTO {
  name?: string;
  phone?: string;
  is_active?: number;
}

export interface UpdateDeliveryInfoDTO {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  delivery_fee?: number;
  notes?: string | null;
}

export interface DeliveryFilterParams {
  deliveryStatus?: 'ALL' | DeliveryStatus;
  driverId?: 'ALL' | string;
  search?: string;
  datePreset?: 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'CUSTOM';
  customDate?: string;
  referenceDate?: string;
  limit?: number;
  offset?: number;
}

export interface DeliveryOrderListItemDTO {
  id: string;
  order_number: string;
  order_type: 'DELIVERY';
  status: 'HOLD' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'RETURNED';
  delivery_status: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  delivery_driver_id: string | null;
  delivery_driver_name: string | null;
  delivery_driver_phone: string | null;
  delivery_fee: number; // minor units
  subtotal: number; // minor units
  discount_amount: number; // minor units
  tax_amount: number; // minor units
  total: number; // minor units
  notes: string | null;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryOrderDetailDTO {
  order: DeliveryOrderListItemDTO;
  items: OrderItemRow[];
}
