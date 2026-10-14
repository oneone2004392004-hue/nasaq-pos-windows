/**
 * NASAQ POS — Order Draft Validations (Phase 5)
 */

import { ValidationError } from '../../database/errors';
import { OrderType } from '../../domain/enums';

export interface CreateOrderItemDTO {
  productId: string;
  quantity: number;
  notes?: string | null;
}

export interface CreateOrderDraftDTO {
  order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  table_id?: string | null;
  table_number?: string | null;
  delivery_driver_id?: string | null;
  delivery_status?: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  delivery_fee?: number; // minor units
  discount_amount?: number; // minor units
  discount_type?: 'PERCENTAGE' | 'FIXED';
  discount_value?: number;
  notes?: string | null;
  items: CreateOrderItemDTO[];
}

export function validateOrderDraft(dto: CreateOrderDraftDTO): {
  order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  table_id: string | null;
  table_number: string | null;
  delivery_driver_id: string | null;
  delivery_status: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  delivery_fee: number;
  discount_amount: number;
  discount_type: 'PERCENTAGE' | 'FIXED' | null;
  discount_value: number;
  notes: string | null;
  items: CreateOrderItemDTO[];
} {
  if (!dto) {
    throw new ValidationError('بيانات الطلب مطلوبة');
  }

  // 1. Order Type
  const validTypes = [OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY];
  if (!validTypes.includes(dto.order_type as OrderType)) {
    throw new ValidationError(`نوع الطلب غير صالح: ${dto.order_type}`);
  }

  // 2. Items validation
  if (!Array.isArray(dto.items) || dto.items.length === 0) {
    throw new ValidationError('سلة الطلب فارغة، يرجى إضافة صنف واحد على الأقل');
  }

  for (const item of dto.items) {
    if (!item.productId || typeof item.productId !== 'string' || item.productId.trim() === '') {
      throw new ValidationError('معرف الصنف في سلة الطلب غير صالح');
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ValidationError('كمية الصنف يجب أن تكون رقماً صحيحاً أكبر من صفر');
    }
  }

  // 3. Dine-In Table Requirement
  let tableNumber: string | null = null;
  const tableId: string | null = dto.table_id?.trim() || null;
  if (dto.order_type === OrderType.DINE_IN) {
    if ((!dto.table_number || dto.table_number.trim() === '') && !tableId) {
      throw new ValidationError('تحديد رقم أو اسم الطاولة إلزامي لطلبات الصالة');
    }
    tableNumber = dto.table_number ? dto.table_number.trim() : null;
  }

  // 4. Delivery Information Requirement
  let customerName: string | null = null;
  let customerPhone: string | null = null;
  let customerAddress: string | null = null;
  const customerId: string | null = dto.customer_id?.trim() || null;
  const deliveryDriverId: string | null = dto.delivery_driver_id?.trim() || null;
  let deliveryStatus: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null = null;

  if (dto.order_type === OrderType.DELIVERY) {
    customerPhone = dto.customer_phone?.trim() || null;
    customerName = dto.customer_name?.trim() || null;
    customerAddress = dto.customer_address?.trim() || null;
    deliveryStatus = dto.delivery_status || 'PENDING';

    if (!customerId && !customerPhone && !customerName) {
      throw new ValidationError('بيانات العميل (الاسم أو رقم الهاتف) إلزامية لطلبات الدليفري');
    }
  }

  // 5. Financial items
  if (dto.delivery_fee !== undefined && dto.delivery_fee !== null) {
    if (typeof dto.delivery_fee !== 'number' || isNaN(dto.delivery_fee) || dto.delivery_fee < 0) {
      throw new ValidationError('رسوم التوصيل لا يمكن أن تكون سالبة');
    }
  }
  const deliveryFee = dto.delivery_fee ? Math.round(dto.delivery_fee) : 0;

  if (dto.discount_amount !== undefined && dto.discount_amount !== null) {
    if (typeof dto.discount_amount !== 'number' || isNaN(dto.discount_amount) || dto.discount_amount < 0) {
      throw new ValidationError('مبلغ الخصم لا يمكن أن يكون سالباً');
    }
  }
  const discountType = dto.discount_type || (dto.discount_amount ? 'FIXED' : null);
  const discountValue = dto.discount_value !== undefined ? dto.discount_value : (dto.discount_amount || 0);
  if (discountType === 'PERCENTAGE' && (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > 100)) {
    throw new ValidationError('نسبة الخصم يجب أن تكون بين 0 و100%.');
  }
  if (discountType === 'FIXED' && (!Number.isFinite(discountValue) || discountValue < 0)) {
    throw new ValidationError('مبلغ الخصم لا يمكن أن يكون سالباً.');
  }
  const discountAmount = discountType === 'PERCENTAGE' ? 0 : Math.round(discountValue);

  return {
    order_type: dto.order_type,
    table_id: tableId,
    table_number: tableNumber,
    delivery_driver_id: deliveryDriverId,
    delivery_status: deliveryStatus,
    customer_id: customerId,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    delivery_fee: deliveryFee,
    discount_amount: discountAmount,
    discount_type: discountType,
    discount_value: discountValue,
    notes: dto.notes?.trim() || null,
    items: dto.items,
  };
}

export function validateUpdateOrderDraft(dto: import('./types').UpdateOrderDraftDTO): {
  order_type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  table_id: string | null;
  table_number: string | null;
  delivery_driver_id: string | null;
  delivery_status: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  delivery_fee: number;
  discount_amount: number;
  discount_type: 'PERCENTAGE' | 'FIXED' | null;
  discount_value: number;
  notes: string | null;
  items: CreateOrderItemDTO[];
} {
  if (!dto) {
    throw new ValidationError('بيانات تعديل الطلب مطلوبة');
  }

  // 1. Order Type (default to TAKEAWAY if not specified)
  const orderType = (dto.order_type as OrderType) || OrderType.TAKEAWAY;
  const validTypes = [OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY];
  if (!validTypes.includes(orderType)) {
    throw new ValidationError(`نوع الطلب غير صالح: ${dto.order_type}`);
  }

  // 2. Items validation
  if (!Array.isArray(dto.items) || dto.items.length === 0) {
    throw new ValidationError('سلة الطلب فارغة، يرجى إضافة صنف واحد على الأقل');
  }

  for (const item of dto.items) {
    if (!item.productId || typeof item.productId !== 'string' || item.productId.trim() === '') {
      throw new ValidationError('معرف الصنف في سلة الطلب غير صالح');
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ValidationError('كمية الصنف يجب أن تكون رقماً صحيحاً أكبر من صفر');
    }
  }

  // 3. Dine-In Table Requirement
  let tableNumber: string | null = null;
  const tableId: string | null = dto.table_id?.trim() || null;
  if (orderType === OrderType.DINE_IN) {
    if ((!dto.table_number || dto.table_number.trim() === '') && !tableId) {
      throw new ValidationError('تحديد رقم أو اسم الطاولة إلزامي لطلبات الصالة');
    }
    tableNumber = dto.table_number ? dto.table_number.trim() : null;
  }

  // 4. Delivery Information Requirement
  let customerName: string | null = null;
  let customerPhone: string | null = null;
  let customerAddress: string | null = null;
  const customerId: string | null = dto.customer_id?.trim() || null;
  const deliveryDriverId: string | null = dto.delivery_driver_id?.trim() || null;
  let deliveryStatus: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null = null;

  if (orderType === OrderType.DELIVERY) {
    customerPhone = dto.customer_phone?.trim() || null;
    customerName = dto.customer_name?.trim() || null;
    customerAddress = dto.customer_address?.trim() || null;
    deliveryStatus = dto.delivery_status || 'PENDING';

    if (!customerId && !customerPhone && !customerName) {
      throw new ValidationError('بيانات العميل (الاسم أو رقم الهاتف) إلزامية لطلبات الدليفري');
    }
  }

  // 5. Financial items
  if (dto.delivery_fee !== undefined && dto.delivery_fee !== null) {
    if (typeof dto.delivery_fee !== 'number' || isNaN(dto.delivery_fee) || dto.delivery_fee < 0) {
      throw new ValidationError('رسوم التوصيل لا يمكن أن تكون سالبة');
    }
  }
  const deliveryFee = dto.delivery_fee ? Math.round(dto.delivery_fee) : 0;

  if (dto.discount_amount !== undefined && dto.discount_amount !== null) {
    if (typeof dto.discount_amount !== 'number' || isNaN(dto.discount_amount) || dto.discount_amount < 0) {
      throw new ValidationError('مبلغ الخصم لا يمكن أن يكون سالباً');
    }
  }
  const discountAmount = dto.discount_amount ? Math.round(dto.discount_amount) : 0;

  return {
    order_type: orderType,
    table_id: tableId,
    table_number: tableNumber,
    delivery_driver_id: deliveryDriverId,
    delivery_status: deliveryStatus,
    customer_id: customerId,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    delivery_fee: deliveryFee,
    discount_amount: discountAmount,
    discount_type: dto.discount_type || (discountAmount ? 'FIXED' : null),
    discount_value: dto.discount_value !== undefined ? dto.discount_value : discountAmount,
    notes: dto.notes?.trim() || null,
    items: dto.items,
  };
}
