import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Plus, RefreshCw, Pencil, Ban, CheckCircle2 } from 'lucide-react';
import { DeliveryService } from '../services/DeliveryService';
import { DeliveryDriverRow } from '../../../domain/dbModels';
import { useAuth } from '../../auth/context/AuthContext';
import { hasPermission } from '../../auth/utils/permissions';

interface DriverView extends DeliveryDriverRow { activeOrders: number }
export const DeliveryPage: React.FC = () => {
  const { user } = useAuth();
  const service = useMemo(() => new DeliveryService(), []);
  const [drivers, setDrivers] = useState<DriverView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<DriverView | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const canManage = hasPermission(user, 'delivery.drivers.manage');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await service.listDrivers(false);
      setDrivers(await Promise.all(rows.map(async (driver) => ({ ...driver, activeOrders: await service.getActiveOrdersCount(driver.id) }))));
    } finally { setLoading(false); }
  }, [service]);
  useEffect(() => { void load(); }, [load]);
  const openForm = (driver?: DriverView) => {
    setEditing(driver || null); setName(driver?.name || ''); setPhone(driver?.phone || ''); setError(''); setIsOpen(true);
  };
  const saveDriver = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!name.trim()) { setError('اسم المندوب مطلوب.'); return; }
    if (!/^01[0125]\d{8}$/.test(phone.trim())) { setError('أدخل رقم هاتف مصري صحيحاً بصيغة 01[0125]xxxxxxxx.'); return; }
    try {
      setSaving(true); setError('');
      if (editing) await service.updateDriver(user, editing.id, { name: name.trim(), phone: phone.trim() });
      else await service.createDriver(user, { name: name.trim(), phone: phone.trim() });
      setIsOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر حفظ المندوب.'); }
    finally { setSaving(false); }
  };
  const toggleActive = async (driver: DriverView) => {
    if (!user) return;
    try { await service.updateDriver(user, driver.id, { is_active: driver.is_active ? 0 : 1 }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تغيير حالة المندوب.'); }
  };
  const columns: Column<DriverView>[] = [
    { key: 'name', header: 'اسم المندوب', width: '220px' },
    { key: 'phone', header: 'رقم الهاتف', render: (item) => <span className="font-mono text-xs">{item.phone}</span> },
    { key: 'activeOrders', header: 'الفواتير المسندة', align: 'center', render: (item) => <span className="font-mono text-xs">{item.activeOrders}</span> },
    { key: 'is_active', header: 'الحالة', render: (item) => <Badge variant={item.is_active ? 'success' : 'neutral'} size="sm">{item.is_active ? 'نشط' : 'موقوف'}</Badge> },
    { key: 'actions', header: 'الإجراءات', align: 'center', render: (item) => canManage ? <div className="flex justify-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => openForm(item)} aria-label="تعديل المندوب"><Pencil size={14} /></Button>
      <Button variant="ghost" size="sm" onClick={() => void toggleActive(item)} aria-label={item.is_active ? 'تعطيل المندوب' : 'تفعيل المندوب'}>{item.is_active ? <Ban size={14} /> : <CheckCircle2 size={14} />}</Button>
    </div> : '—' },
  ];
  return <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#F5F8FC]">
    <PageHeader title="مندوبي التوصيل" actions={<div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => void load()}><RefreshCw size={14} /> تحديث</Button>{canManage && <Button variant="primary" size="sm" onClick={() => openForm()}><Plus size={15} /> إضافة مندوب</Button>}</div>} />
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      {error && !isOpen && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <Table columns={columns} data={drivers} keyExtractor={(item) => item.id} emptyMessage={loading ? 'جاري تحميل المندوبين...' : 'لا يوجد مندوبو توصيل مسجلون'} />
    </div>
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'تعديل بيانات المندوب' : 'إضافة مندوب'} size="sm">
      <form onSubmit={saveDriver} className="flex flex-col gap-3 text-right" dir="rtl">
        {error && <p role="alert" className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        <label className="text-xs font-semibold">اسم المندوب<Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} /></label>
        <label className="text-xs font-semibold">رقم هاتف مصري<Input value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="numeric" placeholder="01012345678" pattern="01[0125][0-9]{8}" /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>إلغاء</Button><Button type="submit" variant="primary" isLoading={saving}>حفظ</Button></div>
      </form>
    </Modal>
  </div>;
};
