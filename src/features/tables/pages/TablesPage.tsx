import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Plus, RefreshCw, Pencil, Ban, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { TableService } from '../services/TableService';
import { TableWithCurrentOrderDTO } from '../types';
import { useAuth } from '../../auth/context/AuthContext';
import { hasPermission } from '../../auth/utils/permissions';
import { TableStatus } from '../../../domain/enums';

export const TablesPage: React.FC = () => {
  const { user } = useAuth();
  const service = useMemo(() => new TableService(), []);
  const [tables, setTables] = useState<TableWithCurrentOrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<TableWithCurrentOrderDTO | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTables(await service.listTablesWithCurrentOrder(false)); }
    finally { setLoading(false); }
  }, [service]);
  useEffect(() => { void load(); }, [load]);
  const openForm = (table?: TableWithCurrentOrderDTO) => {
    setEditing(table || null); setName(table?.name || ''); setCapacity(String(table?.capacity ?? 4)); setError(''); setIsOpen(true);
  };
  const saveTable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const seats = Number(capacity);
    if (!name.trim()) { setError('اسم الطاولة مطلوب.'); return; }
    if (!Number.isInteger(seats) || seats < 1) { setError('سعة الطاولة يجب أن تكون عدداً صحيحاً موجباً.'); return; }
    try {
      setSaving(true); setError('');
      if (editing) await service.updateTable(user, editing.id, { name: name.trim(), capacity: seats });
      else await service.createTable(user, { name: name.trim(), capacity: seats, status: TableStatus.AVAILABLE });
      setIsOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر حفظ الطاولة.'); }
    finally { setSaving(false); }
  };
  const toggleActive = async (table: TableWithCurrentOrderDTO) => {
    if (!user) return;
    try { await service.updateTable(user, table.id, { is_active: table.is_active ? 0 : 1 }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تغيير حالة الطاولة.'); }
  };
  const counts = {
    available: tables.filter((table) => table.is_active === 1 && table.status === 'AVAILABLE').length,
    occupied: tables.filter((table) => table.status === 'OCCUPIED').length,
    reserved: tables.filter((table) => table.status === 'RESERVED').length,
  };
  return <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#F5F8FC]">
    <PageHeader title="إدارة طاولات الصالة" actions={<div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => void load()}><RefreshCw size={14} /> تحديث</Button>
      {hasPermission(user, 'tables.create') && <Button variant="primary" size="sm" onClick={() => openForm()}><Plus size={15} /> إضافة طاولة</Button>}
    </div>} />
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      {error && !isOpen && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <div className="flex items-center gap-4 rounded-md border border-[#E8EEF6] bg-white p-3 text-xs"><span className="text-[#3C8D67]">متاحة ({counts.available})</span><span className="text-[#0F4595]">مشغولة ({counts.occupied})</span><span className="text-[#9A5B15]">محجوزة ({counts.reserved})</span></div>
      {loading ? <div className="text-xs text-[#64748B]">جاري تحميل الطاولات...</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {tables.map((table) => {
          const occupied = table.status === 'OCCUPIED';
          const reserved = table.status === 'RESERVED';
          return <div key={table.id} className={cn('flex h-36 flex-col justify-between rounded-md border bg-white p-4 text-right', occupied ? 'border-[#B7CAD4] bg-[#F7FAFC]' : reserved ? 'border-[#FDE68A] bg-[#FFFDF7]' : 'border-[#D8E3F0]', table.is_active === 0 && 'opacity-50')}>
            <div className="flex items-start justify-between"><span className="text-sm font-bold text-[#132238]">{table.name}</span><span className="text-[11px] text-[#8291A5]">{table.capacity} أفراد</span></div>
            <div className="border-t border-[#EEF3F9] pt-2 text-xs font-semibold">{table.is_active === 0 ? 'موقوفة' : occupied ? `مشغولة (${table.current_order_number || 'طلب'})` : reserved ? 'محجوزة' : 'متاحة'}</div>
            <div className="flex justify-end gap-1">{hasPermission(user, 'tables.edit') && <Button variant="ghost" size="sm" onClick={() => openForm(table)} aria-label="تعديل الطاولة"><Pencil size={13} /></Button>}
              {hasPermission(user, 'tables.edit') && <Button variant="ghost" size="sm" onClick={() => void toggleActive(table)} aria-label={table.is_active ? 'تعطيل الطاولة' : 'تفعيل الطاولة'}>{table.is_active ? <Ban size={13} /> : <CheckCircle2 size={13} />}</Button>}</div>
          </div>;
        })}
      </div>}
    </div>
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'تعديل الطاولة' : 'إضافة طاولة'} size="sm">
      <form onSubmit={saveTable} className="flex flex-col gap-3 text-right" dir="rtl">
        {error && <p role="alert" className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        <label className="text-xs font-semibold">اسم الطاولة<Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={50} /></label>
        <label className="text-xs font-semibold">السعة<Input type="number" min="1" max="100" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} required /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>إلغاء</Button><Button type="submit" variant="primary" isLoading={saving}>حفظ</Button></div>
      </form>
    </Modal>
  </div>;
};
