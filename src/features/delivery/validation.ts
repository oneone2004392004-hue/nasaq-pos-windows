import { ValidationError } from '../../database/errors';
import { DeliveryStatus } from '../../domain/enums';
import { CreateDriverDTO, UpdateDriverDTO, UpdateDeliveryInfoDTO } from './types';

export function validateCreateDriver(dto: CreateDriverDTO): {
  name: string;
  phone: string;
} {
  if (!dto) {
    throw new ValidationError('بيانات مندوب التوصيل مطلوبة');
  }

  if (!dto.name || typeof dto.name !== 'string' || dto.name.trim() === '') {
    throw new ValidationError('اسم مندوب التوصيل مطلوب');
  }

  if (!dto.phone || typeof dto.phone !== 'string' || dto.phone.trim() === '') {
    throw new ValidationError('رقم هاتف مندوب التوصيل مطلوب');
  }

  const name = dto.name.trim();
  const phone = dto.phone.trim();

  if (name.length < 2 || name.length > 100) {
    throw new ValidationError('اسم المندوب يجب أن يكون بين 2 و 100 حرف');
  }

  if (!/^01[0125]\d{8}$/.test(phone)) {
    throw new ValidationError('رقم هاتف المندوب يجب أن يكون رقماً مصرياً صحيحاً بصيغة 01[0125]xxxxxxxx.');
  }

  return { name, phone };
}

export function validateUpdateDriver(dto: UpdateDriverDTO): {
  name?: string;
  phone?: string;
  is_active?: number;
} {
  if (!dto) {
    throw new ValidationError('بيانات تعديل المندوب مطلوبة');
  }

  const result: {
    name?: string;
    phone?: string;
    is_active?: number;
  } = {};

  if (dto.name !== undefined) {
    if (typeof dto.name !== 'string' || dto.name.trim() === '') {
      throw new ValidationError('اسم المندوب لا يمكن أن يكون فارغاً');
    }
    const name = dto.name.trim();
    if (name.length < 2 || name.length > 100) {
      throw new ValidationError('اسم المندوب يجب أن يكون بين 2 و 100 حرف');
    }
    result.name = name;
  }

  if (dto.phone !== undefined) {
    if (typeof dto.phone !== 'string' || dto.phone.trim() === '') {
      throw new ValidationError('رقم الهاتف لا يمكن أن يكون فارغاً');
    }
    const phone = dto.phone.trim();
    if (!/^01[0125]\d{8}$/.test(phone)) {
      throw new ValidationError('رقم هاتف المندوب يجب أن يكون رقماً مصرياً صحيحاً بصيغة 01[0125]xxxxxxxx.');
    }
    result.phone = phone;
  }

  if (dto.is_active !== undefined) {
    if (dto.is_active !== 0 && dto.is_active !== 1) {
      throw new ValidationError('قيمة التفعيل غير صالحة (يجب أن تكون 0 أو 1)');
    }
    result.is_active = dto.is_active;
  }

  return result;
}

export function validateUpdateDeliveryInfo(dto: UpdateDeliveryInfoDTO): {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  delivery_fee?: number;
  notes?: string | null;
} {
  if (!dto) {
    throw new ValidationError('بيانات التوصيل مطلوبة');
  }

  const result: {
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    delivery_fee?: number;
    notes?: string | null;
  } = {};

  if (dto.customer_name !== undefined) {
    result.customer_name = dto.customer_name ? dto.customer_name.trim() : null;
  }

  if (dto.customer_phone !== undefined) {
    result.customer_phone = dto.customer_phone ? dto.customer_phone.trim() : null;
  }

  if (dto.customer_address !== undefined) {
    result.customer_address = dto.customer_address ? dto.customer_address.trim() : null;
  }

  if (dto.delivery_fee !== undefined) {
    if (!Number.isInteger(dto.delivery_fee) || dto.delivery_fee < 0) {
      throw new ValidationError('رسوم التوصيل يجب أن تكون عدداً صحيحاً أكبر من أو يساوي صفر');
    }
    result.delivery_fee = dto.delivery_fee;
  }

  if (dto.notes !== undefined) {
    result.notes = dto.notes ? dto.notes.trim() : null;
  }

  return result;
}

export function validateDeliveryStatus(status: unknown): DeliveryStatus {
  if (!status || typeof status !== 'string') {
    throw new ValidationError('حالة التوصيل مطلوبة');
  }

  if (!Object.values(DeliveryStatus).includes(status as DeliveryStatus)) {
    throw new ValidationError(`حالة التوصيل غير صالحة: ${status}`);
  }

  return status as DeliveryStatus;
}
