import { AuthenticatedUser } from '../../auth/types';
import { requireAnyPermission } from '../../auth/utils/permissions';
import { IReportRepository, ReportRepository, ReportDbFilters } from '../../../repositories/ReportRepository';
import {
  ReportFilterParams,
  ReportDatePreset,
  SalesSummaryDTO,
  OrderTypeBreakdownDTO,
  PaymentBreakdownDTO,
  TopProductDTO,
  CashierPerformanceDTO,
  ExpenseReportDTO,
  ShiftReportItemDTO,
  CashRegisterSummaryDTO,
  BusinessReportData,
} from '../types';
import { InvoiceListItemDTO } from '../../invoices/types';
import { ValidationError } from '../../../database/errors';
import { shiftLocalYmd, toLocalDayRange, toLocalYmd } from '../../../utils/dateRanges';

export interface IReportService {
  getBusinessReport(user: AuthenticatedUser, filters?: ReportFilterParams): Promise<BusinessReportData>;
  getSalesSummary(user: AuthenticatedUser, filters?: ReportFilterParams): Promise<SalesSummaryDTO>;
  getOrderTypeBreakdown(user: AuthenticatedUser, filters?: ReportFilterParams): Promise<OrderTypeBreakdownDTO[]>;
  getPaymentBreakdown(user: AuthenticatedUser, filters?: ReportFilterParams): Promise<PaymentBreakdownDTO[]>;
  getTopProducts(
    user: AuthenticatedUser,
    filters?: ReportFilterParams,
    sortBy?: 'quantity' | 'sales',
    limit?: number
  ): Promise<TopProductDTO[]>;
  getCashierPerformance(user: AuthenticatedUser, filters?: ReportFilterParams): Promise<CashierPerformanceDTO[]>;
  getExpenseReport(user: AuthenticatedUser, filters?: ReportFilterParams): Promise<ExpenseReportDTO>;
  getShiftReport(user: AuthenticatedUser, filters?: ReportFilterParams): Promise<ShiftReportItemDTO[]>;
  getCashRegisterSummary(user: AuthenticatedUser, filters?: ReportFilterParams): Promise<CashRegisterSummaryDTO>;
  getDetailedSales(user: AuthenticatedUser, filters?: ReportFilterParams, limit?: number): Promise<InvoiceListItemDTO[]>;
}

export class ReportService implements IReportService {
  private reportRepo: IReportRepository;

  constructor(reportRepo?: IReportRepository) {
    this.reportRepo = reportRepo || new ReportRepository();
  }

  /**
   * Resolves filter parameters into exact, boundary-safe ISO timestamp strings.
   * Handles timezones and date ranges deterministically.
   */
  public resolveDateBounds(filters: ReportFilterParams = {}): { startIso: string; endIso: string; preset: ReportDatePreset } {
    const preset = filters.datePreset || 'TODAY';
    const refDate = filters.referenceDate ? new Date(filters.referenceDate) : new Date();
    const refYmd = toLocalYmd(refDate);
    const getDayBounds = (ymd: string) => toLocalDayRange(ymd);

    if (preset === 'TODAY') {
      const bounds = getDayBounds(refYmd);
      return { ...bounds, preset };
    }

    if (preset === 'YESTERDAY') {
      const bounds = getDayBounds(shiftLocalYmd(refYmd, -1));
      return { ...bounds, preset };
    }

    if (preset === 'THIS_WEEK') {
      const startBounds = getDayBounds(shiftLocalYmd(refYmd, -6));
      const endBounds = getDayBounds(refYmd);
      return {
        startIso: startBounds.startIso,
        endIso: endBounds.endIso,
        preset,
      };
    }

    if (preset === 'THIS_MONTH') {
      const [year, month] = refYmd.split('-');
      const endBounds = getDayBounds(refYmd);
      return {
        startIso: toLocalDayRange(`${year}-${month}-01`).startIso,
        endIso: endBounds.endIso,
        preset,
      };
    }

    if (preset === 'CUSTOM') {
      if (!filters.startDate && !filters.endDate) {
        // Fallback to today if custom range is missing
        const bounds = getDayBounds(refYmd);
        return { ...bounds, preset };
      }

      const sYmd = filters.startDate ? filters.startDate.slice(0, 10) : '2000-01-01';
      const eYmd = filters.endDate ? filters.endDate.slice(0, 10) : refYmd;

      if (sYmd > eYmd) {
        throw new ValidationError('تاريخ بداية الفترة يجب أن يكون قبل أو يساوي تاريخ النهاية.');
      }

      return {
        startIso: toLocalDayRange(sYmd).startIso,
        endIso: toLocalDayRange(eYmd).endIso,
        preset,
      };
    }

    const defaultBounds = getDayBounds(refYmd);
    return { ...defaultBounds, preset: 'TODAY' };
  }

  private buildDbFilters(filters: ReportFilterParams = {}): ReportDbFilters {
    const { startIso, endIso } = this.resolveDateBounds(filters);
    return {
      startIso,
      endIso,
      orderType: filters.orderType,
      paymentMethod: filters.paymentMethod,
      userId: filters.userId,
    };
  }

  /**
   * Enforces that the user has at least one report permission.
   */
  private checkReportAccess(user: AuthenticatedUser): void {
    requireAnyPermission(user, ['reports.sales', 'reports.shifts', 'reports.financial']);
  }

  /**
   * Retrieves the comprehensive business report containing all dimensions.
   */
  public async getBusinessReport(
    user: AuthenticatedUser,
    filters: ReportFilterParams = {}
  ): Promise<BusinessReportData> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    const { preset } = this.resolveDateBounds(filters);

    const [
      summary,
      orderTypes,
      payments,
      topProducts,
      cashiers,
      expenses,
      shifts,
      cashRegister,
      detailedSales,
    ] = await Promise.all([
      this.reportRepo.getSalesSummary(dbFilters),
      this.reportRepo.getOrderTypeBreakdown(dbFilters),
      this.reportRepo.getPaymentBreakdown(dbFilters),
      this.reportRepo.getTopProducts(dbFilters, 'quantity', 20),
      this.reportRepo.getCashierPerformance(dbFilters),
      this.reportRepo.getExpenseReport(dbFilters),
      this.reportRepo.getShiftReport(dbFilters),
      this.reportRepo.getCashRegisterSummary(dbFilters),
      this.reportRepo.getDetailedSales(dbFilters, 200),
    ]);

    return {
      filters: {
        datePreset: preset,
        startDate: dbFilters.startIso,
        endDate: dbFilters.endIso,
        orderType: filters.orderType || 'ALL',
        paymentMethod: filters.paymentMethod || 'ALL',
        userId: filters.userId || 'ALL',
      },
      summary,
      orderTypes,
      payments,
      topProducts,
      cashiers,
      expenses,
      shifts,
      cashRegister,
      detailedSales,
    };
  }

  public async getSalesSummary(user: AuthenticatedUser, filters: ReportFilterParams = {}): Promise<SalesSummaryDTO> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    return await this.reportRepo.getSalesSummary(dbFilters);
  }

  public async getOrderTypeBreakdown(
    user: AuthenticatedUser,
    filters: ReportFilterParams = {}
  ): Promise<OrderTypeBreakdownDTO[]> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    return await this.reportRepo.getOrderTypeBreakdown(dbFilters);
  }

  public async getPaymentBreakdown(
    user: AuthenticatedUser,
    filters: ReportFilterParams = {}
  ): Promise<PaymentBreakdownDTO[]> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    return await this.reportRepo.getPaymentBreakdown(dbFilters);
  }

  public async getTopProducts(
    user: AuthenticatedUser,
    filters: ReportFilterParams = {},
    sortBy: 'quantity' | 'sales' = 'quantity',
    limit: number = 20
  ): Promise<TopProductDTO[]> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    return await this.reportRepo.getTopProducts(dbFilters, sortBy, limit);
  }

  public async getCashierPerformance(
    user: AuthenticatedUser,
    filters: ReportFilterParams = {}
  ): Promise<CashierPerformanceDTO[]> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    return await this.reportRepo.getCashierPerformance(dbFilters);
  }

  public async getExpenseReport(
    user: AuthenticatedUser,
    filters: ReportFilterParams = {}
  ): Promise<ExpenseReportDTO> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    return await this.reportRepo.getExpenseReport(dbFilters);
  }

  public async getShiftReport(
    user: AuthenticatedUser,
    filters: ReportFilterParams = {}
  ): Promise<ShiftReportItemDTO[]> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    return await this.reportRepo.getShiftReport(dbFilters);
  }

  public async getCashRegisterSummary(
    user: AuthenticatedUser,
    filters: ReportFilterParams = {}
  ): Promise<CashRegisterSummaryDTO> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    return await this.reportRepo.getCashRegisterSummary(dbFilters);
  }

  public async getDetailedSales(
    user: AuthenticatedUser,
    filters: ReportFilterParams = {},
    limit: number = 200
  ): Promise<InvoiceListItemDTO[]> {
    this.checkReportAccess(user);
    const dbFilters = this.buildDbFilters(filters);
    return await this.reportRepo.getDetailedSales(dbFilters, limit);
  }
}
