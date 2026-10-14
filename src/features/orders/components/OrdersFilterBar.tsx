import React, { Dispatch, SetStateAction } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { cn } from '../../../utils/cn';
import { DateFilterPreset } from '../types';

type StatusFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'HOLD';
type TypeFilter = 'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

interface OrdersFilterBarProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: Dispatch<SetStateAction<StatusFilter>>;
  typeFilter: TypeFilter;
  setTypeFilter: Dispatch<SetStateAction<TypeFilter>>;
  dateFilter: DateFilterPreset;
  setDateFilter: Dispatch<SetStateAction<DateFilterPreset>>;
}

export const OrdersFilterBar: React.FC<OrdersFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  dateFilter,
  setDateFilter,
}) => (
  <div className="p-4 bg-white border-b border-[#E2E8F0] flex flex-col md:flex-row items-center gap-3 shrink-0">
    <div className="relative flex-1 w-full">
      <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
      <Input id="orders-search-input" placeholder="ابحث برقم الطلب، اسم العميل، رقم الهاتف، أو الطاولة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-9 h-9 text-xs bg-[#F8FAFC] border-[#D8E3F0]" />
      {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#0F172A] cursor-pointer">مسح</button>}
    </div>

    <div className="flex items-center gap-1 text-xs w-full md:w-auto">
      <span className="text-[#64748B] ml-1 shrink-0 font-medium">الحالة:</span>
      <div className="flex bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0] overflow-x-auto">
        {([{ id: 'ALL', label: 'الكل' }, { id: 'PENDING', label: 'معلق' }, { id: 'COMPLETED', label: 'مكتمل' }, { id: 'CANCELLED', label: 'ملغي' }] as const).map((st) => (
          <button key={st.id} type="button" id={`filter-status-${st.id}`} onClick={() => setStatusFilter(st.id)} className={cn('px-2.5 py-1 text-xs rounded-sm font-semibold transition-colors cursor-pointer whitespace-nowrap', statusFilter === st.id ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]')}>{st.label}</button>
        ))}
      </div>
    </div>

    <div className="flex items-center gap-1 text-xs w-full md:w-auto">
      <span className="text-[#64748B] ml-1 shrink-0 font-medium">النوع:</span>
      <div className="flex bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0] overflow-x-auto">
        {([{ id: 'ALL', label: 'الكل' }, { id: 'DINE_IN', label: 'صالة' }, { id: 'TAKEAWAY', label: 'تيك أواي' }, { id: 'DELIVERY', label: 'دليفري' }] as const).map((type) => (
          <button key={type.id} type="button" id={`filter-type-${type.id}`} onClick={() => setTypeFilter(type.id)} className={cn('px-2.5 py-1 text-xs rounded-sm font-semibold transition-colors cursor-pointer whitespace-nowrap', typeFilter === type.id ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]')}>{type.label}</button>
        ))}
      </div>
    </div>

    <div className="flex items-center gap-1 text-xs w-full md:w-auto">
      <span className="text-[#64748B] ml-1 shrink-0 font-medium">التاريخ:</span>
      <div className="flex bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0] overflow-x-auto">
        {([{ id: 'ALL', label: 'كافة التواريخ' }, { id: 'TODAY', label: 'اليوم' }, { id: 'YESTERDAY', label: 'أمس' }, { id: 'THIS_WEEK', label: 'هذا الأسبوع' }] as const).map((date) => (
          <button key={date.id} type="button" id={`filter-date-${date.id}`} onClick={() => setDateFilter(date.id)} className={cn('px-2.5 py-1 text-xs rounded-sm font-semibold transition-colors cursor-pointer whitespace-nowrap', dateFilter === date.id ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]')}>{date.label}</button>
        ))}
      </div>
    </div>
  </div>
);
