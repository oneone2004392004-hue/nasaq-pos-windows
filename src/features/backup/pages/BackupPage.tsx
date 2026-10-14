import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../auth/context/AuthContext';
import { BackupService, BackupValidationResult } from '../services/BackupService';
import { ExternalBackupRestoreModal } from '../components/ExternalBackupRestoreModal';
import { BackupRow } from '../../../domain/dbModels';
import { formatDateTime } from '../../../utils/formatters';
import {
  HardDrive,
  Download,
  UploadCloud,
  ShieldCheck,
  RotateCcw,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Database,
} from 'lucide-react';

export const BackupPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Shift & safety state
  const [canRestore, setCanRestore] = useState<boolean>(true);
  const [restoreBlockReason, setRestoreBlockReason] = useState<string | null>(null);

  // Modals state
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupRow | null>(null);
  const [selectedBackupForDelete, setSelectedBackupForDelete] = useState<BackupRow | null>(null);

  // External file upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [externalFileBytes, setExternalFileBytes] = useState<Uint8Array | null>(null);
  const [externalFileName, setExternalFileName] = useState<string>('');
  const [externalFileValidation, setExternalFileValidation] = useState<BackupValidationResult | null>(null);
  const [isExternalModalOpen, setIsExternalModalOpen] = useState<boolean>(false);

  const [backupService] = useState(() => new BackupService());

  const canCreateBackup = hasPermission('system.backup');
  const canRestoreBackup = hasPermission('system.restore');

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);

      // 1. Check open shifts
      const shiftCheck = await backupService.checkCanRestore();
      setCanRestore(shiftCheck.canRestore);
      setRestoreBlockReason(shiftCheck.reason || null);

      // 2. Load backups list
      if (canCreateBackup) {
        const list = await backupService.listBackups(user);
        setBackups(list);
      }
    } catch (err) {
      showToast(`تعذر تحميل قائمة النسخ الاحتياطية: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user, backupService, canCreateBackup, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBackup = async () => {
    if (!user) return;
    try {
      setIsCreating(true);
      const created = await backupService.createBackup(user, 'MANUAL', 'نسخة يدوية من شاشة النسخ الاحتياطي');
      showToast(`تم إنشاء النسخة الاحتياطية بنجاح (${created.filename})`, 'success');
      await loadData();
    } catch (err) {
      showToast(`فشل إنشاء النسخة الاحتياطية: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownloadBackup = async (backup: BackupRow) => {
    if (!user) return;
    try {
      const bytes = await backupService.getBackupBytes(user, backup.id);
      const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`بدأ تحميل الملف ${backup.filename}`, 'info');
    } catch (err) {
      showToast(`تعذر تنزيل الملف: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleConfirmRestore = async () => {
    if (!user || !selectedBackupForRestore) return;
    try {
      setIsRestoring(true);
      const res = await backupService.restoreBackup(user, selectedBackupForRestore.id);
      setSelectedBackupForRestore(null);
      showToast(res.message, 'success');

      // Reload window after 1.2s to cleanly restart app state with restored database
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      showToast(`خطأ في الاستعادة: ${err instanceof Error ? err.message : String(err)}`, 'error');
      setIsRestoring(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !selectedBackupForDelete) return;
    try {
      setIsDeleting(true);
      await backupService.deleteBackup(user, selectedBackupForDelete.id);
      showToast('تم حذف النسخة الاحتياطية بنجاح.', 'success');
      setSelectedBackupForDelete(null);
      await loadData();
    } catch (err) {
      showToast(`فشل حذف النسخة: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTriggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const validation = await backupService.validateBackupBytes(bytes);
      if (!validation.isValid) {
        showToast(`الملف غير صالح كقاعدة بيانات نسق: ${validation.error}`, 'error');
        return;
      }

      setExternalFileBytes(bytes);
      setExternalFileName(file.name);
      setExternalFileValidation(validation);
      setIsExternalModalOpen(true);
    } catch (err) {
      showToast(`تعذر قراءة الملف: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleConfirmExternalRestore = async () => {
    if (!user || !externalFileBytes) return;
    try {
      setIsRestoring(true);
      const res = await backupService.restoreBackup(user, externalFileName, externalFileBytes);
      setIsExternalModalOpen(false);
      showToast(res.message, 'success');

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      showToast(`خطأ في الاستعادة: ${err instanceof Error ? err.message : String(err)}`, 'error');
      setIsRestoring(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getBackupTypeLabel = (type: BackupRow['backup_type'], filename: string): { label: string; variant: 'default' | 'neutral' | 'success' | 'warning' } => {
    if (filename.includes('pre-restore-safety')) {
      return { label: 'أمان قبل الاستعادة', variant: 'warning' };
    }
    if (type === 'AUTO_SHIFT_CLOSE') {
      return { label: 'تلقائي عند إغلاق الوردية', variant: 'neutral' };
    }
    if (type === 'AUTO_DAILY') {
      return { label: 'تلقائي يومي', variant: 'neutral' };
    }
    return { label: 'يدوي', variant: 'default' };
  };

  const columns: Column<BackupRow>[] = [
    {
      key: 'filename',
      header: 'اسم ملف النسخة الاحتياطية',
      width: '340px',
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[#132238]">
            <Database size={13} className="text-[#61748D] shrink-0" />
            <span dir="ltr" className="text-right truncate max-w-[280px]" title={item.filename}>
              {item.filename}
            </span>
          </div>
          {item.filepath && (
            <span className="text-[10px] text-[#92A0B2] font-mono truncate max-w-[280px]">
              {item.filepath}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'backup_type',
      header: 'نوع النسخة',
      render: (item) => {
        const typeInfo = getBackupTypeLabel(item.backup_type, item.filename);
        return <Badge variant={typeInfo.variant} size="sm">{typeInfo.label}</Badge>;
      },
    },
    {
      key: 'size_bytes',
      header: 'الحجم',
      render: (item) => <span className="font-mono text-xs text-[#31445D]">{formatFileSize(item.size_bytes)}</span>,
    },
    {
      key: 'created_at',
      header: 'تاريخ الإنشاء',
      render: (item) => (
        <span className="text-xs text-[#61748D] tabular-nums">
          {formatDateTime(item.created_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (item) => {
        if (item.status === 'RESTORED') {
          return <Badge variant="neutral" size="sm">مستعادة</Badge>;
        }
        if (item.status === 'FAILED') {
          return <Badge variant="danger" size="sm">فاشلة</Badge>;
        }
        return <Badge variant="success" size="sm">سليمة وجاهزة</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs px-2 py-1 h-7 text-[#52657D] hover:text-[#132238]"
            onClick={() => handleDownloadBackup(item)}
            title="تنزيل نسخة الملف للكمبيوتر"
          >
            <Download size={13} />
            <span>تنزيل</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="text-xs px-2 py-1 h-7 text-[#1E4620] hover:bg-[#F0FDF4]"
            onClick={() => setSelectedBackupForRestore(item)}
            disabled={!canRestoreBackup || !canRestore}
            title={!canRestore ? restoreBlockReason || 'الاستعادة معطلة' : 'استعادة قاعدة البيانات من هذه النسخة'}
          >
            <RotateCcw size={13} />
            <span>استعادة</span>
          </Button>

          {canRestoreBackup && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs px-1.5 py-1 h-7 text-[#7A1D1A] hover:bg-[#FDF2F2]"
              onClick={() => setSelectedBackupForDelete(item)}
              title="حذف هذه النسخة"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC]" dir="rtl">
      {/* Hidden file upload input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".db,.sqlite,.sqlite3"
        className="hidden"
        onChange={handleFileSelected}
      />

      <PageHeader
        title="النسخ الاحتياطي والأمان"
        subtitle="حماية البيانات محلياً بدون إنترنت، إنشاء نسخ SQLite متوافقة واسترجاعها بأمان تام"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              title="تحديث القائمة"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>تحديث</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleTriggerUpload}
              disabled={!canRestoreBackup || !canRestore}
              title={!canRestore ? restoreBlockReason || 'الاستعادة معطلة' : 'استعادة من ملف SQLite خارجي'}
            >
              <UploadCloud size={14} />
              <span>استعادة من ملف خارجي</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateBackup}
              isLoading={isCreating}
              disabled={!canCreateBackup}
            >
              <HardDrive size={14} />
              <span>إنشاء نسخة احتياطية الآن</span>
            </Button>
          </div>
        }
      />

      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {/* Open Shift Warning Banner */}
        {!canRestore && (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] p-4 rounded-md flex items-start gap-3 text-right">
            <AlertTriangle size={22} className="text-[#D97706] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[#92400E]">الاستعادة معطلة مؤقتاً لوجود وردية مفتوحة</h4>
              <p className="text-[12px] text-[#B45309] mt-0.5">
                {restoreBlockReason}
              </p>
              <p className="text-[11px] text-[#B45309] mt-1">
                تتطلب معايير الأمان المالي إغلاق الوردية الحالية وطباعة تقرير الإغلاق قبل استبدال بيانات النظام.
              </p>
            </div>
          </div>
        )}

        {/* Security Info Card */}
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] p-4 rounded-md flex items-center gap-3 text-right">
          <ShieldCheck size={24} className="text-[#3C8D67] shrink-0" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-[#1E4620]">نظام النسخ الاحتياطي المحلي الذاتي</h4>
            <p className="text-[11px] text-[#2C6B38] mt-0.5">
              يتم حفظ النسخ الاحتياطية كملفات SQLite حقيقية متكاملة تشمل كافة الجداول والقيود والمبيعات. يقوم النظام تلقائياً بإنشاء نسخة أمان احتياطية قبل كل عملية استعادة لحماية بياناتك من أي طارئ.
            </p>
          </div>
          <div className="text-left font-mono text-xs text-[#2C6B38] shrink-0">
            {backups.length} نسخ محفوظة
          </div>
        </div>

        {/* Backups Table */}
        <div className="flex-1">
          <Table
            columns={columns}
            data={backups}
            keyExtractor={(item) => item.id}
            emptyMessage={isLoading ? 'جاري تحميل النسخ الاحتياطية...' : 'لا توجد نسخ احتياطية مسجلة بعد. اضغط على "إنشاء نسخة احتياطية الآن" لبدء النسخ.'}
          />
        </div>
      </div>

      {/* High-Risk Restore Confirmation Dialog */}
      <ConfirmDialog
        isOpen={selectedBackupForRestore !== null}
        onClose={() => !isRestoring && setSelectedBackupForRestore(null)}
        onConfirm={handleConfirmRestore}
        title="تحذير حرج: استعادة قاعدة البيانات"
        message={
          selectedBackupForRestore
            ? `تنبيه: استعادة النسخة (${selectedBackupForRestore.filename}) ستؤدي إلى استبدال قاعدة البيانات الحالية بالكامل بالبيانات المحفوظة في تلك النسخة.\n\nسيقوم النظام تلقائياً بإنشاء نسخة أمان كاملة من قاعدة البيانات الحالية قبل البدء.\n\nهل أنت متأكد من رغبتك في الاستمرار؟`
            : ''
        }
        confirmText="تأكيد واستعادة البيانات"
        cancelText="إلغاء التراجع"
        isDangerous={true}
        isLoading={isRestoring}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={selectedBackupForDelete !== null}
        onClose={() => !isDeleting && setSelectedBackupForDelete(null)}
        onConfirm={handleConfirmDelete}
        title="حذف النسخة الاحتياطية"
        message={
          selectedBackupForDelete
            ? `هل أنت متأكد من حذف ملف النسخة الاحتياطية (${selectedBackupForDelete.filename})؟ لا يمكن التراجع عن هذا الإجراء.`
            : ''
        }
        confirmText="حذف النسخة"
        cancelText="إلغاء"
        isDangerous={true}
        isLoading={isDeleting}
      />

      <ExternalBackupRestoreModal
        isOpen={isExternalModalOpen}
        isRestoring={isRestoring}
        fileName={externalFileName}
        validation={externalFileValidation}
        formatFileSize={formatFileSize}
        onClose={() => !isRestoring && setIsExternalModalOpen(false)}
        onConfirm={handleConfirmExternalRestore}
      />
    </div>
  );
};
