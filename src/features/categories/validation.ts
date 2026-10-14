import { ValidationError } from '../../database/errors';

export interface CreateCategoryDTO {
  name: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface UpdateCategoryDTO {
  name?: string;
  sort_order?: number;
  is_active?: boolean;
}

export function validateCategoryCreate(data: CreateCategoryDTO): {
  name: string;
  sort_order: number;
  is_active: number;
} {
  const fieldErrors: Record<string, string> = {};

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    fieldErrors.name = 'اسم القسم مطلوب ولا يمكن أن يكون فارغاً';
  } else if (data.name.trim().length > 100) {
    fieldErrors.name = 'اسم القسم يجب ألا يتجاوز 100 حرف';
  }

  let sortOrder = 0;
  if (data.sort_order !== undefined) {
    if (typeof data.sort_order !== 'number' || isNaN(data.sort_order) || data.sort_order < 0) {
      fieldErrors.sort_order = 'ترتيب القسم يجب أن يكون رقماً صحيحاً موجباً أو صفراً';
    } else {
      sortOrder = Math.floor(data.sort_order);
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('بيانات القسم غير صالحة', fieldErrors);
  }

  return {
    name: data.name.trim(),
    sort_order: sortOrder,
    is_active: data.is_active === false ? 0 : 1,
  };
}

export function validateCategoryUpdate(data: UpdateCategoryDTO): {
  name?: string;
  sort_order?: number;
  is_active?: number;
} {
  const fieldErrors: Record<string, string> = {};
  const sanitized: { name?: string; sort_order?: number; is_active?: number } = {};

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      fieldErrors.name = 'اسم القسم لا يمكن أن يكون فارغاً';
    } else if (data.name.trim().length > 100) {
      fieldErrors.name = 'اسم القسم يجب ألا يتجاوز 100 حرف';
    } else {
      sanitized.name = data.name.trim();
    }
  }

  if (data.sort_order !== undefined) {
    if (typeof data.sort_order !== 'number' || isNaN(data.sort_order) || data.sort_order < 0) {
      fieldErrors.sort_order = 'ترتيب القسم يجب أن يكون رقماً صحيحاً موجباً أو صفراً';
    } else {
      sanitized.sort_order = Math.floor(data.sort_order);
    }
  }

  if (data.is_active !== undefined) {
    sanitized.is_active = data.is_active ? 1 : 0;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('بيانات تعديل القسم غير صالحة', fieldErrors);
  }

  return sanitized;
}
