import { CashTransactionRow } from '../../domain/dbModels';

export interface DepositCashDTO {
  amount: number; // minor units > 0
  reason: string;
  referenceId?: string;
  shiftId?: string;
}

export interface WithdrawCashDTO {
  amount: number; // minor units > 0
  reason: string;
  referenceId?: string;
  shiftId?: string;
}

export interface AdjustCashDTO {
  amount: number; // minor units (positive or negative adjustment)
  reason: string;
  referenceId?: string;
  shiftId?: string;
}

export interface CashRegisterBalanceInfo {
  shiftId: string;
  shiftNumber: string;
  cashierName: string;
  openingCash: number;
  cashSales: number;
  deposits: number;
  expenses: number;
  withdrawals: number;
  refunds: number;
  adjustments: number;
  currentExpectedCash: number;
  lastUpdated: string;
}

export interface CashTransactionFilter {
  shiftId?: string;
  type?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}
