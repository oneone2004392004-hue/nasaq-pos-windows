import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RefreshCw, UserPlus, Save, KeyRound } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { UserService, CreateUserDTO } from '../services/UserService';
import { UserRow, RoleRow } from '../../../domain/dbModels';
import { formatDateTime } from '../../../utils/formatters';

interface UserView extends UserRow { role: string; roleCode: string }

export const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const service = useMemo(() => new UserService(), []);
  const [users, setUsers] = useState<UserView[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateUserDTO>({ username: '', name: '', roleId: '', password: '' });
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, roleRows] = await Promise.all([service.list(user), service.listRoles(user)]);
      setRoles(roleRows);
      const roleMap = new Map<string, RoleRow>(roleRows.map((role) => [role.id, role]));
      setUsers(rows.map((row) => ({
        ...row,
        role: roleMap.get(row.role_id)?.name || 'غير محدد',
        roleCode: roleMap.get(row.role_id)?.code || '',
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل المستخدمين.');
    } finally {
      setLoading(false);
    }
  }, [service, user]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    try {
      setError(null);
      setMessage(null);
      if (editingId) await service.update(user, editingId, { name: form.name, roleId: form.roleId });
      else await service.create(user, form);
      setForm({ username: '', name: '', roleId: roles[0]?.id || '', password: '' });
      setEditingId(null);
      setMessage('تم حفظ بيانات المستخدم.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ المستخدم.');
    }
  };

  const toggle = async (row: UserView) => {
    if (!user) return;
    try {
      setError(null);
      await service.setActive(user, row.id, row.is_active !== 1);
      setMessage('تم تحديث حالة المستخدم.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث الحالة.');
    }
  };

  const reset = async () => {
    if (!user || !resetId) return;
    try {
      await service.resetPassword(user, resetId, resetPassword);
      setResetId(null);
      setResetPassword('');
      setMessage('تم إعادة تعيين كلمة المرور.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إعادة تعيين كلمة المرور.');
    }
  };

  const columns: Column<UserView>[] = [
    { key: 'name', header: 'الاسم', width: '180px' },
    { key: 'username', header: 'اسم المستخدم', render: (row) => <span className="font-mono text-xs">{row.username}</span> },
    { key: 'role', header: 'الدور', render: (row) => <span>{row.role}</span> },
    {
      key: 'is_active',
      header: 'الحالة',
      render: (row) => <Badge variant={row.is_active ? 'success' : 'neutral'} size="sm">{row.is_active ? 'مفعل' : 'معطل'}</Badge>,
    },
    {
      key: 'last_login_at',
      header: 'آخر دخول',
      render: (row) => <span className="text-xs text-[#61748D]">{row.last_login_at ? formatDateTime(row.last_login_at) : '—'}</span>,
    },
    {
      key: 'id',
      header: 'إجراءات',
      render: (row) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditingId(row.id);
              setForm({ username: row.username, name: row.name, roleId: row.role_id, password: '' });
            }}
          >تعديل</Button>
          <Button size="sm" variant="secondary" onClick={() => setResetId(row.id)}><KeyRound size={13} /></Button>
          <Button size="sm" variant="secondary" onClick={() => void toggle(row)}>{row.is_active ? 'تعطيل' : 'تفعيل'}</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC]">
      <PageHeader
        title="المستخدمون والصلاحيات"
        actions={(
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
          </Button>
        )}
      />
      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {(error || message) && (
          <div className={error ? 'p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm' : 'p-3 rounded border border-green-200 bg-green-50 text-green-700 text-sm'}>
            {error || message}
          </div>
        )}
        <form onSubmit={submit} className="bg-white border rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <Input placeholder="اسم المستخدم" value={form.username} disabled={!!editingId} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <Input placeholder="الاسم" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <select className="h-10 border rounded px-2 text-sm" value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          {!editingId && <Input type="password" placeholder="كلمة المرور" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />}
          <Button type="submit"><Save size={14} /> {editingId ? 'حفظ التعديل' : <><UserPlus size={14} /> إضافة مستخدم</>}</Button>
        </form>
        {resetId && (
          <div className="bg-white border rounded-xl p-4 flex gap-2 items-center">
            <Input type="password" placeholder="كلمة المرور الجديدة" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
            <Button onClick={() => void reset()}>تأكيد إعادة التعيين</Button>
            <Button variant="secondary" onClick={() => setResetId(null)}>إلغاء</Button>
          </div>
        )}
        <Table columns={columns} data={users} keyExtractor={(item) => item.id} emptyMessage={loading ? 'جاري التحميل...' : 'لا يوجد مستخدمون'} />
      </div>
    </div>
  );
};
