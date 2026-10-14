import { ValidationError } from '../../database/errors';
import { TableStatus } from '../../domain/enums';
import { CreateTableDTO, UpdateTableDTO, TransferTableDTO, MergeTablesDTO } from './types';

export function validateCreateTable(dto: CreateTableDTO): {
  name: string;
  capacity: number;
  status: TableStatus;
} {
  if (!dto) {
    throw new ValidationError('بيانات الطاولة مطلوبة');
  }

  if (!dto.name || typeof dto.name !== 'string' || dto.name.trim() === '') {
    throw new ValidationError('اسم أو رقم الطاولة مطلوب');
  }

  const name = dto.name.trim();
  if (name.length > 50) {
    throw new ValidationError('اسم الطاولة يجب ألا يتجاوز 50 حرفاً');
  }

  let capacity = 4;
  if (dto.capacity !== undefined && dto.capacity !== null) {
    if (!Number.isInteger(dto.capacity) || dto.capacity < 1) {
      throw new ValidationError('سعة الطاولة يجب أن تكون عدداً صحيحاً أكبر من صفر');
    }
    if (dto.capacity > 100) {
      throw new ValidationError('سعة الطاولة يجب ألا تتجاوز 100 فرد');
    }
    capacity = dto.capacity;
  }

  let status: TableStatus = TableStatus.AVAILABLE;
  if (dto.status) {
    if (!Object.values(TableStatus).includes(dto.status)) {
      throw new ValidationError(`حالة الطاولة غير صالحة: ${dto.status}`);
    }
    status = dto.status;
  }

  return {
    name,
    capacity,
    status,
  };
}

export function validateUpdateTable(dto: UpdateTableDTO): {
  name?: string;
  capacity?: number;
  status?: TableStatus;
  is_active?: number;
} {
  if (!dto) {
    throw new ValidationError('بيانات تعديل الطاولة مطلوبة');
  }

  const result: {
    name?: string;
    capacity?: number;
    status?: TableStatus;
    is_active?: number;
  } = {};

  if (dto.name !== undefined) {
    if (typeof dto.name !== 'string' || dto.name.trim() === '') {
      throw new ValidationError('اسم الطاولة لا يمكن أن يكون فارغاً');
    }
    const name = dto.name.trim();
    if (name.length > 50) {
      throw new ValidationError('اسم الطاولة يجب ألا يتجاوز 50 حرفاً');
    }
    result.name = name;
  }

  if (dto.capacity !== undefined && dto.capacity !== null) {
    if (!Number.isInteger(dto.capacity) || dto.capacity < 1) {
      throw new ValidationError('سعة الطاولة يجب أن تكون عدداً صحيحاً أكبر من صفر');
    }
    if (dto.capacity > 100) {
      throw new ValidationError('سعة الطاولة يجب ألا تتجاوز 100 فرد');
    }
    result.capacity = dto.capacity;
  }

  if (dto.status !== undefined) {
    if (!Object.values(TableStatus).includes(dto.status)) {
      throw new ValidationError(`حالة الطاولة غير صالحة: ${dto.status}`);
    }
    result.status = dto.status;
  }

  if (dto.is_active !== undefined) {
    if (dto.is_active !== 0 && dto.is_active !== 1) {
      throw new ValidationError('قيمة التفعيل غير صالحة (يجب أن تكون 0 أو 1)');
    }
    result.is_active = dto.is_active;
  }

  return result;
}

export function validateTransferTable(dto: TransferTableDTO): {
  orderId: string;
  targetTableId?: string;
  targetTableNumber?: string;
} {
  if (!dto) {
    throw new ValidationError('بيانات نقل الطاولة مطلوبة');
  }

  if (!dto.orderId || typeof dto.orderId !== 'string' || dto.orderId.trim() === '') {
    throw new ValidationError('معرف الطلب المراد نقله مطلوب');
  }

  const targetTableId = dto.targetTableId?.trim();
  const targetTableNumber = dto.targetTableNumber?.trim();

  if (!targetTableId && !targetTableNumber) {
    throw new ValidationError('يجب تحديد الطاولة الهدف (معرف أو اسم الطاولة)');
  }

  return {
    orderId: dto.orderId.trim(),
    targetTableId,
    targetTableNumber,
  };
}

export function validateMergeTables(dto: MergeTablesDTO): {
  sourceOrderId: string;
  targetOrderId: string;
} {
  if (!dto) {
    throw new ValidationError('بيانات دمج الطاولات مطلوبة');
  }

  if (!dto.sourceOrderId || typeof dto.sourceOrderId !== 'string' || dto.sourceOrderId.trim() === '') {
    throw new ValidationError('معرف الطلب المصدري مطلوب');
  }

  if (!dto.targetOrderId || typeof dto.targetOrderId !== 'string' || dto.targetOrderId.trim() === '') {
    throw new ValidationError('معرف الطلب الهدف مطلوب');
  }

  if (dto.sourceOrderId.trim() === dto.targetOrderId.trim()) {
    throw new ValidationError('لا يمكن دمج الطلب مع نفسه');
  }

  return {
    sourceOrderId: dto.sourceOrderId.trim(),
    targetOrderId: dto.targetOrderId.trim(),
  };
}
