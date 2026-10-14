import { ValidationError } from '../../database/errors';
import { OpenShiftDTO, CloseShiftDTO } from './types';

export function validateOpenShiftInput(input: OpenShiftDTO): void {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('بيانات فتح الوردية غير صحيحة.');
  }

  if (typeof input.openingCash !== 'number' || !Number.isInteger(input.openingCash)) {
    throw new ValidationError('الرصيد الافتتاحي للدرج يجب أن يكون عدداً صحيحاً بالوحدات الصغرى (Minor units).');
  }

  if (input.openingCash < 0) {
    throw new ValidationError('لا يمكن فتح الوردية برصيد افتتاحي سالب.');
  }

  if (input.notes && typeof input.notes === 'string' && input.notes.length > 500) {
    throw new ValidationError('ملاحظات فتح الوردية يجب ألا تتجاوز 500 حرف.');
  }
}

export function validateCloseShiftInput(input: CloseShiftDTO): void {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('بيانات إغلاق الوردية غير صحيحة.');
  }

  if (!input.shiftId || typeof input.shiftId !== 'string' || input.shiftId.trim() === '') {
    throw new ValidationError('معرف الوردية المراد إغلاقها مطلوب.');
  }

  if (typeof input.actualCash !== 'number' || !Number.isInteger(input.actualCash)) {
    throw new ValidationError('المبلغ الفعلي لجرد النقدية يجب أن يكون عدداً صحيحاً بالوحدات الصغرى (Minor units).');
  }

  if (input.actualCash < 0) {
    throw new ValidationError('المبلغ الفعلي لجرد النقدية لا يمكن أن يكون سالباً.');
  }

  if (input.notes && typeof input.notes === 'string' && input.notes.length > 500) {
    throw new ValidationError('ملاحظات إغلاق الوردية يجب ألا تتجاوز 500 حرف.');
  }
}
