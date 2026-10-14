import { OrderType, PaymentMethod, ShiftStatus } from '../../domain/enums';
import { InvoiceListItemDTO } from '../invoices/types';

export type ReportDatePreset = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

export interface ReportFilterParams {
  datePreset?: ReportDatePreset;
  startDate?: string; // ISO string or YYYY-MM-DD
  endDate?: string;   // ISO string or YYYY-MM-DD
  referenceDate?: string; // For deterministic testing & mock time
  orderType?: OrderType | 'ALL';
  paymentMethod?: PaymentMethod | 'SPLIT' | 'ALL';
  userId?: string | 'ALL';
}

export interface SalesSummaryDTO {
  totalSales: number; // minor units
  completedOrdersCount: number;
  averageOrderValue: number; // minor units
  cashSales: number; // minor units
  cardSales: number; // minor units
  splitOrdersCount: number;
  totalExpenses: number; // minor units
  netSales: number; // minor units (totalSales - totalExpenses)
}

export interface OrderTypeBreakdownDTO {
  orderType: OrderType;
  orderTypeLabel: string;
  ordersCount: number;
  totalSales: number; // minor units
  averageOrderValue: number; // minor units
  percentageOfTotal: number; // 0 - 100
}

export interface PaymentBreakdownDTO {
  paymentMethod: PaymentMethod | 'SPLIT';
  methodLabel: string;
  totalAmount: number; // minor units
  transactionsCount: number;
  percentageOfTotal: number; // 0 - 100
}

export interface TopProductDTO {
  rank: number;
  productName: string;
  quantitySold: number;
  totalSales: number; // minor units
  averageUnitPrice: number; // minor units
}

export interface CashierPerformanceDTO {
  userId: string;
  cashierName: string;
  completedOrdersCount: number;
  totalSales: number; // minor units
  averageOrderValue: number; // minor units
  cashSales: number; // minor units
  cardSales: number; // minor units
  dineInSales: number; // minor units
  takeawaySales: number; // minor units
  deliverySales: number; // minor units
}

export interface ExpenseCategorySummaryDTO {
  category: string;
  expensesCount: number;
  totalAmount: number; // minor units
  paidFromDrawerAmount: number; // minor units
}

export interface ExpenseReportDTO {
  totalExpenses: number; // minor units
  expensesCount: number;
  byCategory: ExpenseCategorySummaryDTO[];
  items: {
    id: string;
    category: string;
    description: string;
    amount: number; // minor units
    paidFromCashDrawer: boolean;
    cashierName: string;
    createdAt: string;
  }[];
}

export interface ShiftReportItemDTO {
  id: string;
  shiftNumber: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number; // minor units
  expectedCash: number; // minor units
  actualCash: number | null; // minor units
  variance: number | null; // minor units (actual - expected)
  varianceType: 'BALANCED' | 'SHORTAGE' | 'OVERAGE' | 'PENDING';
  status: ShiftStatus;
  totalSales: number; // minor units
  cashSales: number; // minor units
  cardSales: number; // minor units
}

export interface CashRegisterSummaryDTO {
  cashSales: number; // minor units
  deposits: number; // minor units
  totalCashIn: number; // minor units (cashSales + deposits)
  expenses: number; // minor units
  withdrawals: number; // minor units
  refunds: number; // minor units
  totalCashOut: number; // minor units (expenses + withdrawals + refunds)
  adjustments: number; // minor units
  netCashMovement: number; // minor units (totalCashIn - totalCashOut + adjustments)
}

export interface BusinessReportData {
  filters: {
    datePreset: ReportDatePreset;
    startDate: string;
    endDate: string;
    orderType: string;
    paymentMethod: string;
    userId: string;
  };
  summary: SalesSummaryDTO;
  orderTypes: OrderTypeBreakdownDTO[];
  payments: PaymentBreakdownDTO[];
  topProducts: TopProductDTO[];
  cashiers: CashierPerformanceDTO[];
  expenses: ExpenseReportDTO;
  shifts: ShiftReportItemDTO[];
  cashRegister: CashRegisterSummaryDTO;
  detailedSales: InvoiceListItemDTO[];
}
