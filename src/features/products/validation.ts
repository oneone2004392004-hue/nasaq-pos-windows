import { ValidationError } from '../../database/errors';

export interface CreateProductDTO {
  category_id: string;
  name: string;
  price: number; // minor units (e.g. 10000 = 100.00 EGP)
  cost_price?: number; // minor units
  barcode?: string | null;
  track_stock?: boolean;
  current_stock?: number;
  min_stock_alert?: number;
  unit?: string;
  is_active?: boolean;
}

export interface UpdateProductDTO {
  category_id?: string;
  name?: string;
  price?: number;
  cost_price?: number;
  barcode?: string | null;
  track_stock?: boolean;
  current_stock?: number;
  min_stock_alert?: number;
  unit?: string;
  is_active?: boolean;
}

export function validateProductCreate(data: CreateProductDTO): {
  category_id: string;
  name: string;
  price: number;
  cost_price: number;
  barcode: string | null;
  track_stock: number;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
  is_active: number;
} {
  const fieldErrors: Record<string, string> = {};

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    fieldErrors.name = 'اسم المنتج مطلوب ولا يمكن أن يكون فارغاً';
  } else if (data.name.trim().length > 150) {
    fieldErrors.name = 'اسم المنتج يجب ألا يتجاوز 150 حرف';
  }

  if (!data.category_id || typeof data.category_id !== 'string' || data.category_id.trim().length === 0) {
    fieldErrors.category_id = 'يجب اختيار القسم التابع له المنتج';
  }

  // Price validation: must be integer minor units >= 0
  if (data.price === undefined || data.price === null || typeof data.price !== 'number' || isNaN(data.price)) {
    fieldErrors.price = 'سعر البيع مطلوب';
  } else if (data.price < 0) {
    fieldErrors.price = 'سعر البيع لا يمكن أن يكون سالباً';
  } else if (!Number.isInteger(data.price)) {
    fieldErrors.price = 'سعر البيع يجب أن يكون بالقروش/الوحدات الصغرى بدون كسور عشرية';
  }

  // Cost price validation
  let costPrice = 0;
  if (data.cost_price !== undefined && data.cost_price !== null) {
    if (typeof data.cost_price !== 'number' || isNaN(data.cost_price) || data.cost_price < 0) {
      fieldErrors.cost_price = 'سعر التكلفة لا يمكن أن يكون سالباً';
    } else if (!Number.isInteger(data.cost_price)) {
      fieldErrors.cost_price = 'سعر التكلفة يجب أن يكون بالوحدات الصغرى كعدد صحيح';
    } else {
      costPrice = data.cost_price;
    }
  }

  // Barcode sanitation
  let barcode: string | null = null;
  if (data.barcode !== undefined && data.barcode !== null && typeof data.barcode === 'string') {
    const trimmed = data.barcode.trim();
    if (trimmed.length > 0) {
      barcode = trimmed;
    }
  }

  // Stock
  const trackStock = data.track_stock ? 1 : 0;
  let currentStock = 0;
  if (data.current_stock !== undefined && data.current_stock !== null) {
    if (typeof data.current_stock !== 'number' || isNaN(data.current_stock)) {
      fieldErrors.current_stock = 'كمية المخزون يجب أن تكون رقماً';
    } else {
      currentStock = Math.floor(data.current_stock);
    }
  }

  let minAlert = 0;
  if (data.min_stock_alert !== undefined && data.min_stock_alert !== null) {
    if (typeof data.min_stock_alert !== 'number' || isNaN(data.min_stock_alert) || data.min_stock_alert < 0) {
      fieldErrors.min_stock_alert = 'تنبيه الحد الأدنى يجب ألا يكون سالباً';
    } else {
      minAlert = Math.floor(data.min_stock_alert);
    }
  }

  const unit = (data.unit && typeof data.unit === 'string' && data.unit.trim().length > 0)
    ? data.unit.trim()
    : 'piece';

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('بيانات المنتج غير صالحة', fieldErrors);
  }

  return {
    category_id: data.category_id.trim(),
    name: data.name.trim(),
    price: data.price,
    cost_price: costPrice,
    barcode,
    track_stock: trackStock,
    current_stock: currentStock,
    min_stock_alert: minAlert,
    unit,
    is_active: data.is_active === false ? 0 : 1,
  };
}

export function validateProductUpdate(data: UpdateProductDTO): Partial<{
  category_id: string;
  name: string;
  price: number;
  cost_price: number;
  barcode: string | null;
  track_stock: number;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
  is_active: number;
}> {
  const fieldErrors: Record<string, string> = {};
  const sanitized: Partial<{
    category_id: string;
    name: string;
    price: number;
    cost_price: number;
    barcode: string | null;
    track_stock: number;
    current_stock: number;
    min_stock_alert: number;
    unit: string;
    is_active: number;
  }> = {};

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      fieldErrors.name = 'اسم المنتج لا يمكن أن يكون فارغاً';
    } else if (data.name.trim().length > 150) {
      fieldErrors.name = 'اسم المنتج يجب ألا يتجاوز 150 حرف';
    } else {
      sanitized.name = data.name.trim();
    }
  }

  if (data.category_id !== undefined) {
    if (typeof data.category_id !== 'string' || data.category_id.trim().length === 0) {
      fieldErrors.category_id = 'يجب تحديد قسم صالح';
    } else {
      sanitized.category_id = data.category_id.trim();
    }
  }

  if (data.price !== undefined) {
    if (typeof data.price !== 'number' || isNaN(data.price) || data.price < 0) {
      fieldErrors.price = 'سعر البيع لا يمكن أن يكون سالباً';
    } else if (!Number.isInteger(data.price)) {
      fieldErrors.price = 'سعر البيع يجب أن يكون بالوحدات الصغرى كعدد صحيح';
    } else {
      sanitized.price = data.price;
    }
  }

  if (data.cost_price !== undefined) {
    if (typeof data.cost_price !== 'number' || isNaN(data.cost_price) || data.cost_price < 0) {
      fieldErrors.cost_price = 'سعر التكلفة لا يمكن أن يكون سالباً';
    } else if (!Number.isInteger(data.cost_price)) {
      fieldErrors.cost_price = 'سعر التكلفة يجب أن يكون بالوحدات الصغرى كعدد صحيح';
    } else {
      sanitized.cost_price = data.cost_price;
    }
  }

  if (data.barcode !== undefined) {
    if (data.barcode === null || data.barcode.trim().length === 0) {
      sanitized.barcode = null;
    } else {
      sanitized.barcode = data.barcode.trim();
    }
  }

  if (data.track_stock !== undefined) {
    sanitized.track_stock = data.track_stock ? 1 : 0;
  }

  if (data.current_stock !== undefined) {
    if (typeof data.current_stock !== 'number' || isNaN(data.current_stock)) {
      fieldErrors.current_stock = 'كمية المخزون يجب أن تكون رقماً';
    } else {
      sanitized.current_stock = Math.floor(data.current_stock);
    }
  }

  if (data.min_stock_alert !== undefined) {
    if (typeof data.min_stock_alert !== 'number' || isNaN(data.min_stock_alert) || data.min_stock_alert < 0) {
      fieldErrors.min_stock_alert = 'تنبيه الحد الأدنى يجب ألا يكون سالباً';
    } else {
      sanitized.min_stock_alert = Math.floor(data.min_stock_alert);
    }
  }

  if (data.unit !== undefined) {
    if (typeof data.unit === 'string' && data.unit.trim().length > 0) {
      sanitized.unit = data.unit.trim();
    }
  }

  if (data.is_active !== undefined) {
    sanitized.is_active = data.is_active ? 1 : 0;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('بيانات تعديل المنتج غير صالحة', fieldErrors);
  }

  return sanitized;
}
