import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Plus, Search, History, RefreshCw, Pencil, Ban, CheckCircle2 } from 'lucide-react';
import { CustomerRepository } from '../../../repositories/CustomerRepository';
import { CustomerRow } from '../../../domain/dbModels';
import { formatCurrency } from '../../../utils/formatters';
import { useAuth } from '../../auth/context/AuthContext';
import { hasPermission } from '../../auth/utils/permissions';
import { CustomerService } from '../services/CustomerService';

interface CustomerView extends CustomerRow { ordersCount: number; totalSpentMinor: number }
export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const repo = useMemo(() => new CustomerRepository(), []);
  const service = useMemo(() => new CustomerService(), []);
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerView | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = query.trim() ? await repo.search(query) : await repo.getAll();
      setCustomers(await Promise.all(rows.map(async (row) => ({ ...row, ...(await repo.getCustomerStats(row.id)) }))));
    } finally { setLoading(false); }
  }, [repo, query]);
  useEffect(() => { void load(); }, [load]);

  const openForm = (customer?: CustomerView) => {
    setEditing(customer || null);
    setName(customer?.name || '');
    setPhone(customer?.phone || '');
    setAddress(customer?.address || '');
    setError('');
    setIsOpen(true);
  };
  const saveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setError('');
    try {
      setSaving(true);
      if (editing) await service.update(user, editing.id, { name, phone, address });
      else await service.create(user, { name, phone, address });
      setIsOpen(false);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر حفظ العميل.'); }
    finally { setSaving(false); }
  };
  const toggleActive = async (customer: CustomerView) => {
    if (!user) return;
    try { await service.setActive(user, customer.id, customer.is_active === 0); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تغيير حالة العميل.'); }
  };

  const columns: Column<CustomerView>[] = [
    { key: 'name', header: 'اسم العميل', width: '180px' },
    { key: 'phone', header: 'الهاتف', render: (item) => <span className="font-mono text-xs">{item.phone || '—'}</span> },
    { key: 'address', header: 'العنوان', render: (item) => <span className="text-xs">{item.address || '—'}</span> },
    { key: 'ordersCount', header: 'الطلبات', align: 'center', render: (item) => <span className="font-mono text-xs">{item.ordersCount}</span> },
    { key: 'totalSpentMinor', header: 'إجمالي المشتريات', render: (item) => <span className="font-bold tabular-nums text-xs">{formatCurrency(item.totalSpentMinor)}</span> },
    { key: 'is_active', header: 'الحالة', render: (item) => item.is_active === 0 ? 'موقوف' : 'نشط' },
    { key: 'actions', header: 'الإجراءات', align: 'center', render: (item) => <div className="flex justify-center gap-1">
      <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate(`/orders?search=${encodeURIComponent(item.phone || item.name)}`)}><History size={13} /> السجل</Button>
      {hasPermission(user, 'customers.edit') && <><Button variant="ghost" size="sm" onClick={() => openForm(item)} aria-label="تعديل العميل"><Pencil size={14} /></Button>
      <Button variant="ghost" size="sm" onClick={() => void toggleActive(item)} aria-label={item.is_active === 0 ? 'تفعيل العميل' : 'تعطيل العميل'}>{item.is_active === 0 ? <CheckCircle2 size={14} /> : <Ban size={14} />}</Button></>}
    </div> },
  ];

  return <div className="flex flex-1 flex-col overflow-hidden bg-[#F5F8FC]">
    <PageHeader title="دليل العملاء" actions={<div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => void load()}><RefreshCw size={14} /> تحديث</Button>
      {hasPermission(user, 'customers.create') && <Button variant="primary" size="sm" onClick={() => openForm()}><Plus size={15} /> إضافة عميل</Button>}
    </div>} />
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      {error && !isOpen && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <div className="flex items-center gap-3 rounded-md border border-[#E8EEF6] bg-white p-3">
        <div className="relative w-full max-w-sm"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#92A0B2]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث بالاسم أو الهاتف..." className="h-9 pr-9 text-xs" /></div>
        <span className="text-xs text-[#64748B]">{loading ? 'جاري التحميل...' : `${customers.length} عميل`}</span>
      </div>
      <Table columns={columns} data={customers} keyExtractor={(item) => item.id} emptyMessage={loading ? 'جاري تحميل العملاء...' : 'لا يوجد عملاء مسجلون'} />
    </div>
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editing ? 'تعديل بيانات العميل' : 'إضافة عميل'} size="md">
      <form onSubmit={saveCustomer} className="flex flex-col gap-3 text-right" dir="rtl">
        {error && <p role="alert" className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        <label className="text-xs font-semibold">اسم العميل<Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
        <label className="text-xs font-semibold">رقم الهاتف (اختياري)<Input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label className="text-xs font-semibold">العنوان (اختياري)<Input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>إلغاء</Button><Button type="submit" variant="primary" isLoading={saving}>حفظ</Button></div>
      </form>
    </Modal>
  </div>;
};
