import { errorMessage } from '../../../utils/errors';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../auth/context/AuthContext';
import { ShiftService } from '../services/ShiftService';
import { CashShiftRow } from '../../../domain/dbModels';
import { ShiftStatus } from '../../../domain/enums';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { OpenShiftModal } from '../components/OpenShiftModal';
import { CloseShiftModal } from '../components/CloseShiftModal';
import { ShiftSummaryModal } from '../components/ShiftSummaryModal';
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Banknote,
  FileText,
  RotateCcw,
  ArrowRightLeft,
  CircleDot,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ShiftItemWithMeta extends CashShiftRow {
  cashierName?: string;
}

export const ShiftsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const shiftService = useMemo(() => new ShiftService(), []);

  const [shifts, setShifts] = useState<ShiftItemWithMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  // Modals state
  const [isOpenModalOpen, setIsOpenModalOpen] = useState<boolean>(false);
  const [selectedShiftForClose, setSelectedShiftForClose] = useState<CashShiftRow | null>(null);
  const [selectedShiftIdForSummary, setSelectedShiftIdForSummary] = useState<string | null>(null);

  // Active shift for current user
  const currentActiveShift = useMemo(() => {
    return shifts.find((s) => s.user_id === user?.id && s.status === ShiftStatus.OPEN) || null;
  }, [shifts, user]);

  const loadShifts = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setErrorMessage(null);

      const loaded = await shiftService.listShifts(user, 50);
      setShifts(loaded);
    } catch (err: unknown) {
      setErrorMessage(errorMessage(err, 'تعذر استرجاع قائمة الورديات'));
    } finally {
      setLoading(false);
    }
  }, [user, shiftService]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const filteredShifts = useMemo(() => {
    if (statusFilter === 'ALL') return shifts;
    return shifts.filter((s) => s.status === statusFilter);
  }, [shifts, statusFilter]);

  const canOpenShift = hasPermission('shifts.open') && !currentActiveShift;
  const canCloseShift = (shift: CashShiftRow) => {
    if (shift.status === ShiftStatus.CLOSED) return false;
    if (user?.id === shift.user_id) return hasPermission('shifts.close');
    return hasPermission('shifts.view_all') || user?.roleCode === 'ADMIN' || user?.roleCode === 'MANAGER';
  };

  const columns: Column<ShiftItemWithMeta>[] = [
    {
      key: 'shift_number',
      header: 'رقم الوردية',
      width: '150px',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-[#132238]">
          {item.shift_number}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      width: '110px',
      render: (item) => (
        <Badge variant={item.status === ShiftStatus.OPEN ? 'success' : 'neutral'} size="sm">
          {item.status === ShiftStatus.OPEN ? 'مفتوحة حالياً' : 'مغلقة'}
        </Badge>
      ),
    },
    {
      key: 'opening_cash',
      header: 'العهدة الافتتاحية',
      render: (item) => (
        <span className="tabular-nums font-mono text-xs text-[#52657D]">
          {formatCurrency(item.opening_cash)}
        </span>
      ),
    },
    {
      key: 'expected_cash',
      header: 'الرصيد الدفتري المتوقع',
      render: (item) => (
        <span className="tabular-nums font-mono text-xs font-semibold text-[#132238]">
          {formatCurrency(item.expected_cash)}
        </span>
      ),
    },
    {
      key: 'actual_cash',
      header: 'الرصيد الفعلي المجرود',
      render: (item) => (
        <span className="tabular-nums font-mono text-xs font-semibold text-[#132238]">
          {item.actual_cash !== null ? formatCurrency(item.actual_cash) : '-'}
        </span>
      ),
    },
    {
      key: 'cash_difference',
      header: 'العجز / الزيادة',
      render: (item) => {
        if (item.cash_difference === null) {
          return <span className="text-[#92A0B2] text-xs">-</span>;
        }
        const diff = item.cash_difference;
        const isDeficit = diff < 0;
        const isBalanced = diff === 0;

        return (
          <span
            className={`tabular-nums font-mono text-xs font-bold ${
              isBalanced ? 'text-[#3C8D67]' : isDeficit ? 'text-[#D9534F]' : 'text-[#1464D9]'
            }`}
          >
            {formatCurrency(diff)}
          </span>
        );
      },
    },
    {
      key: 'opened_at',
      header: 'توقيت الافتتاح',
      render: (item) => (
        <span className="text-xs text-[#61748D] tabular-nums">
          {formatDateTime(item.opened_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-[#52657D]"
            onClick={() => setSelectedShiftIdForSummary(item.id)}
            title="عرض التقرير المالي"
          >
            <FileText size={14} className="ml-1" />
            <span>التقرير</span>
          </Button>

          {item.status === ShiftStatus.OPEN && canCloseShift(item) && (
            <Button
              variant="secondary"
              size="sm"
              className="text-xs text-[#D9534F] hover:bg-[#FDF2F2]"
              onClick={() => setSelectedShiftForClose(item)}
              title="إغلاق الوردية وجرد الدرج"
            >
              <RotateCcw size={13} className="ml-1" />
              <span>إغلاق الوردية</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC]">
      <PageHeader
        title="إدارة الورديات النقدية"
        subtitle="فتح الورديات، تسوية العهد النقدية، وجرد النقدية الفعلي ومطابقة الفروقات الدفترية"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/cash-register">
              <Button variant="secondary" size="sm">
                <ArrowRightLeft size={14} />
                <span>حركة الخزينة والدرج</span>
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              disabled={!canOpenShift}
              onClick={() => setIsOpenModalOpen(true)}
              title={
                currentActiveShift
                  ? 'لديك وردية مفتوحة بالفعل، يجب إغلاقها أولاً'
                  : 'فتح وردية نقدية جديدة'
              }
            >
              <Plus size={15} />
              <span>فتح وردية جديدة</span>
            </Button>
          </div>
        }
      />

      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {errorMessage && (
          <div className="p-3 bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] rounded-md text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Active Shift Hero Card if open */}
        {currentActiveShift && (
          <div className="bg-white p-4 rounded-md border border-[#C8E6C9] shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center">
                <CircleDot size={20} className="animate-pulse" />
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#132238]">
                    وردية مفتوحة لك الآن ({currentActiveShift.shift_number})
                  </span>
                  <Badge variant="success" size="sm">نشطة</Badge>
                </div>
                <div className="text-xs text-[#61748D] flex items-center gap-3 mt-1">
                  <span>العهدة: <strong>{formatCurrency(currentActiveShift.opening_cash)}</strong></span>
                  <span>الرصيد الدفتري الحالي: <strong>{formatCurrency(currentActiveShift.expected_cash)}</strong></span>
                  <span>توقيت الافتتاح: {formatDateTime(currentActiveShift.opened_at)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setSelectedShiftIdForSummary(currentActiveShift.id)}
              >
                <FileText size={14} className="ml-1" />
                <span>ملخص الأرقام</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="text-xs"
                onClick={() => setSelectedShiftForClose(currentActiveShift)}
              >
                <RotateCcw size={14} className="ml-1" />
                <span>إغلاق الوردية وجرد الدرج</span>
              </Button>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-md border border-[#E8EEF6] text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#61748D] font-medium ml-1">تصفية الحالة:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-[#132238] text-white font-semibold'
                  : 'bg-[#F4F4F2] text-[#52657D] hover:bg-[#EEF3F9]'
              }`}
            >
              الكل ({shifts.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('OPEN')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                statusFilter === 'OPEN'
                  ? 'bg-[#2E7D32] text-white font-semibold'
                  : 'bg-[#F4F4F2] text-[#52657D] hover:bg-[#EEF3F9]'
              }`}
            >
              المفتوحة ({shifts.filter((s) => s.status === ShiftStatus.OPEN).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('CLOSED')}
              className={`px-3 py-1 rounded cursor-pointer transition-colors ${
                statusFilter === 'CLOSED'
                  ? 'bg-[#52657D] text-white font-semibold'
                  : 'bg-[#F4F4F2] text-[#52657D] hover:bg-[#EEF3F9]'
              }`}
            >
              المغلقة ({shifts.filter((s) => s.status === ShiftStatus.CLOSED).length})
            </button>
          </div>

          <span className="text-xs text-[#8291A5]">
            عرض أحدث 50 وردية مسجلة
          </span>
        </div>

        {/* Shifts Table */}
        <Table
          columns={columns}
          data={filteredShifts}
          keyExtractor={(item) => item.id}
          emptyMessage={loading ? 'جاري تحميل سجل الورديات...' : 'لا توجد ورديات مسجلة تطابق التصفية'}
        />
      </div>

      {/* Modals */}
      <OpenShiftModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        onShiftOpened={loadShifts}
      />

      <CloseShiftModal
        isOpen={!!selectedShiftForClose}
        onClose={() => setSelectedShiftForClose(null)}
        shift={selectedShiftForClose}
        onShiftClosed={loadShifts}
      />

      <ShiftSummaryModal
        isOpen={!!selectedShiftIdForSummary}
        onClose={() => setSelectedShiftIdForSummary(null)}
        shiftId={selectedShiftIdForSummary}
      />
    </div>
  );
};
