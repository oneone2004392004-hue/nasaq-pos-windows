import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { ProductRow } from '../../../domain/dbModels';
import { InventoryService } from '../services/InventoryService';
import { useAuth } from '../../auth/context/AuthContext';

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const service = useMemo(() => new InventoryService(), []);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await service.list(user, query));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل المخزون.');
    } finally {
      setLoading(false);
    }
  }, [service, user, query]);

  useEffect(() => { void load(); }, [load]);

  const adjust = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selected) return;
    try {
      await service.adjust(user, selected.id, Number(delta), reason);
      setSelected(null);
      setDelta('');
      setReason('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ التسوية.');
    }
  };

  const columns: Column<ProductRow>[] = [
    { key: 'name', header: 'اسم الصنف', width: '250px' },
    {
      key: 'current_stock',
      header: 'الرصيد المتاح',
      render: (item) => (
        <span className="font-bold tabular-nums font-mono text-xs">
          {item.track_stock ? `${item.current_stock} ${item.unit}` : 'غير متتبع'}
        </span>
      ),
    },
    {
      key: 'min_stock_alert',
      header: 'حد إعادة الطلب',
      render: (item) => (
        <span className="text-[#61748D] tabular-nums font-mono text-xs">
          {item.track_stock ? `${item.min_stock_alert} ${item.unit}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (item) => !item.track_stock
        ? <Badge variant="neutral" size="sm">غير متتبع</Badge>
        : item.current_stock <= 0
          ? <Badge variant="danger" size="sm">نفد المخزون</Badge>
          : item.current_stock <= item.min_stock_alert
            ? <Badge variant="warning" size="sm">مخزون منخفض</Badge>
            : <Badge variant="success" size="sm">متوفر</Badge>,
    },
    {
      key: 'id',
      header: 'إجراء',
      render: (item) => (
        <Button size="sm" variant="secondary" disabled={!item.track_stock} onClick={() => setSelected(item)}>
          <SlidersHorizontal size={13} /> تسوية
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC]">
      <PageHeader
        title="إدارة المخزون والأرصدة"
        actions={(
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
          </Button>
        )}
      />
      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {error && <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>}
        <div className="bg-white p-3 rounded-md border flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#92A0B2]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث باسم الصنف أو الباركود..."
              className="pr-9 h-9 text-xs"
            />
          </div>
          <span className="text-xs text-[#64748B]">{loading ? 'جاري التحميل...' : `${items.length} صنف`}</span>
        </div>
        <Table columns={columns} data={items} keyExtractor={(item) => item.id} emptyMessage={loading ? 'جاري تحميل المخزون...' : 'لا توجد أصناف متاحة'} />
        {selected && (
          <form onSubmit={adjust} className="bg-white border rounded-xl p-4 flex flex-wrap gap-2 items-end">
            <strong className="w-full text-sm">تسوية: {selected.name} — الرصيد {selected.current_stock}</strong>
            <Input type="number" placeholder="الكمية (+ إضافة / - خصم)" value={delta} onChange={(event) => setDelta(event.target.value)} required />
            <Input placeholder="سبب التسوية (إلزامي)" value={reason} onChange={(event) => setReason(event.target.value)} required />
            <Button type="submit">حفظ التسوية</Button>
            <Button type="button" variant="secondary" onClick={() => setSelected(null)}>إلغاء</Button>
          </form>
        )}
      </div>
    </div>
  );
};
