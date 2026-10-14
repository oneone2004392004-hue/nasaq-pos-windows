import { CashShiftRow } from '../../domain/dbModels';
import { ShiftStatus } from '../../domain/enums';

export interface OpenShiftDTO {
  openingCash: number; // minor units (e.g. 50000 = 500.00 EGP)
  notes?: string;
}

export interface CloseShiftDTO {
  shiftId: string;
  actualCash: number; // minor units
  notes?: string;
  confirmPendingOrders?: boolean;
}

export interface ShiftSummary {
  shift: CashShiftRow;
  cashierName: string;
  durationMinutes: number;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  totalSales: number;
  invoicesCount: number;
  ordersCount: number;
  cashExpenses: number;
  deposits: number;
  withdrawals: number;
  refunds: number;
  adjustments: number;
  expectedCash: number;
  actualCash: number | null;
  variance: number | null; // actual - expected
  varianceType: 'BALANCED' | 'SHORTAGE' | 'OVERAGE' | 'PENDING';
  status: ShiftStatus;
}
