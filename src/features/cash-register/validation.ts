import { ValidationError } from '../../database/errors';
import { DepositCashDTO, WithdrawCashDTO, AdjustCashDTO } from './types';

export function validateDepositInput(input: DepositCashDTO): void {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('بيانات إيداع النقدية غير صحيحة.');
  }

  if (typeof input.amount !== 'number' || !Number.isInteger(input.amount)) {
    throw new ValidationError('مبلغ الإيداع يجب أن يكون عدداً صحيحاً بالوحدات الصغرى (Minor units).');
  }

  if (input.amount <= 0) {
    throw new ValidationError('مبلغ الإيداع يجب أن يكون أكبر من الصفر.');
  }

  if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length < 3) {
    throw new ValidationError('سبب الإيداع مطلوب ويجب أن يتكون من 3 أحرف على الأقل.');
  }
}

export function validateWithdrawInput(input: WithdrawCashDTO): void {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('بيانات سحب النقدية غير صحيحة.');
  }

  if (typeof input.amount !== 'number' || !Number.isInteger(input.amount)) {
    throw new ValidationError('مبلغ السحب يجب أن يكون عدداً صحيحاً بالوحدات الصغرى (Minor units).');
  }

  if (input.amount <= 0) {
    throw new ValidationError('مبلغ السحب يجب أن يكون أكبر من الصفر.');
  }

  if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length < 3) {
    throw new ValidationError('سبب السحب مطلوب ويجب أن يتكون من 3 أحرف على الأقل.');
  }
}

export function validateAdjustInput(input: AdjustCashDTO): void {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('بيانات تسوية النقدية غير صحيحة.');
  }

  if (typeof input.amount !== 'number' || !Number.isInteger(input.amount)) {
    throw new ValidationError('مبلغ التسوية يجب أن يكون عدداً صحيحاً بالوحدات الصغرى (Minor units).');
  }

  if (input.amount === 0) {
    throw new ValidationError('مبلغ التسوية لا يمكن أن يكون صفراً.');
  }

  if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length < 3) {
    throw new ValidationError('سبب التسوية مطلوب ويجب أن يتكون من 3 أحرف على الأقل.');
  }
}
