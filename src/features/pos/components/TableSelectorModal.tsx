/**
 * NASAQ POS — Table Selector Modal (Phase 5)
 * Allows selecting a Dine-in table with visual indication of occupied status.
 */

import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';
import { formatCurrency } from '../../../utils/formatters';

interface TableSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTable: string | null;
  onSelectTable: (tableNumber: string) => void;
  occupiedTables: { table_number: string; order_id: string; total: number }[];
  tableNames?: string[];
  onOpenOccupiedOrder?: (orderId: string) => void;
}

// 12 standard tables for restaurant hall
const DEFAULT_TABLES = [
  'طاولة 01', 'طاولة 02', 'طاولة 03', 'طاولة 04',
  'طاولة 05', 'طاولة 06', 'طاولة 07', 'طاولة 08',
  'طاولة 09', 'طاولة 10', 'طاولة 11', 'طاولة 12',
];

export const TableSelectorModal: React.FC<TableSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedTable,
  onSelectTable,
  occupiedTables,
  tableNames,
  onOpenOccupiedOrder,
}) => {
  const [occupiedTarget, setOccupiedTarget] = useState<{
    table_number: string;
    order_id: string;
    total: number;
  } | null>(null);

  const occupiedMap = new Map<string, { table_number: string; order_id: string; total: number }>(
    occupiedTables.map((t) => [t.table_number, t])
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setOccupiedTarget(null);
        onClose();
      }}
      title="اختيار طاولة الصالة"
      size="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button
            variant="secondary"
            onClick={() => {
              setOccupiedTarget(null);
              onClose();
            }}
            size="sm"
          >
            إغلاق
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Status legend */}
        <div className="flex items-center gap-4 text-xs text-[#64748B] pb-2 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#F0FDF4] border border-[#BBF7D0]" />
            <span>متاحة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#FEF2F2] border border-[#FECACA]" />
            <span>مشغولة بطلب معلق</span>
          </div>
        </div>

        {/* Occupied Table Action Banner */}
        {occupiedTarget && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md flex flex-col gap-2">
            <div className="text-xs text-[#991B1B] font-medium">
              الطاولة <span className="font-bold font-mono">[{occupiedTarget.table_number}]</span> مشغولة حالياً بطلب معلق قيمته{' '}
              <span className="font-bold font-mono">{formatCurrency(occupiedTarget.total)}</span>.
            </div>
            <div className="flex items-center gap-2">
              {onOpenOccupiedOrder && (
                <Button
                  id="btn-open-occupied-order"
                  variant="primary"
                  size="sm"
                  className="bg-[#991B1B] hover:bg-[#7F1D1D] text-xs h-7"
                  onClick={() => {
                    onOpenOccupiedOrder(occupiedTarget.order_id);
                    setOccupiedTarget(null);
                    onClose();
                  }}
                >
                  فتح طلب الطاولة في الكاشير (لتعديله أو سداده)
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-7"
                onClick={() => setOccupiedTarget(null)}
              >
                اختيار طاولة أخرى
              </Button>
            </div>
          </div>
        )}

        {/* Tables Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {(tableNames?.length ? tableNames : DEFAULT_TABLES).map((tbl) => {
            const isOccupied = occupiedMap.has(tbl);
            const occupiedInfo = occupiedMap.get(tbl);
            const isSelected = selectedTable === tbl;

            return (
              <button
                key={tbl}
                id={`btn-table-${tbl.replace(/\s+/g, '-')}`}
                type="button"
                onClick={() => {
                  if (isOccupied && occupiedInfo) {
                    if (onOpenOccupiedOrder) {
                      setOccupiedTarget(occupiedInfo);
                    } else {
                      onSelectTable(tbl);
                      onClose();
                    }
                  } else {
                    onSelectTable(tbl);
                    onClose();
                  }
                }}
                className={cn(
                  'flex flex-col items-center justify-center p-3 h-20 rounded-md border text-center transition-all cursor-pointer',
                  isSelected
                    ? 'border-[#0F4595] bg-[#0F4595] text-white font-bold ring-2 ring-[#0F4595]/30'
                    : isOccupied
                    ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2]'
                    : 'border-[#E2E8F0] bg-white text-[#1E293B] hover:border-[#94A3B8] hover:bg-[#F8FAFC]'
                )}
              >
                <span className="text-sm font-bold">{tbl}</span>
                {isOccupied && !isSelected && (
                  <span className="text-[10px] mt-1 font-mono text-[#DC2626]">
                    مشغولة ({formatCurrency(occupiedInfo?.total ?? 0)})
                  </span>
                )}
                {isSelected && (
                  <span className="text-[10px] mt-1 text-white/80 font-medium">
                    محددة حالياً
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
