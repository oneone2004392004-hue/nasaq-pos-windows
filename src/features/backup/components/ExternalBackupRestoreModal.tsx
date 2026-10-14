import React from 'react';
import { AlertTriangle, FileCheck2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import type { BackupValidationResult } from '../services/BackupService';

interface ExternalBackupRestoreModalProps {
  isOpen: boolean;
  isRestoring: boolean;
  fileName: string;
  validation: BackupValidationResult | null;
  formatFileSize: (bytes: number) => string;
  onClose: () => void;
  onConfirm: () => void;
}

export const ExternalBackupRestoreModal: React.FC<ExternalBackupRestoreModalProps> = ({
  isOpen,
  isRestoring,
  fileName,
  validation,
  formatFileSize,
  onClose,
  onConfirm,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="استعادة من ملف SQLite خارجي"
    size="md"
    footer={
      <>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={isRestoring}>إلغاء</Button>
        <Button variant="danger" size="sm" onClick={onConfirm} isLoading={isRestoring}>تأكيد الاستعادة من الملف</Button>
      </>
    }
  >
    <div className="flex flex-col gap-4 text-right">
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] p-3 rounded-md flex items-center gap-3">
        <FileCheck2 size={24} className="text-[#2563EB] shrink-0" />
        <div>
          <h4 className="text-xs font-bold text-[#1E40AF]">تم فحص الملف والتحقق من سلامته بنجاح</h4>
          <p className="text-[11px] text-[#1D4ED8] mt-0.5">الملف يطابق معايير قاعدة بيانات نسق (SQLite 3) ويحتوي على كافة الجداول وسجلات الترحيل المطلوبة.</p>
        </div>
      </div>
      <div className="bg-white border border-[#E5E5E3] rounded-md p-3 text-xs flex flex-col gap-2">
        <div className="flex justify-between items-center py-1 border-b border-[#F0F0EF]"><span className="text-[#61748D]">اسم الملف:</span><span className="font-mono font-semibold" dir="ltr">{fileName}</span></div>
        <div className="flex justify-between items-center py-1 border-b border-[#F0F0EF]"><span className="text-[#61748D]">حجم الملف:</span><span className="font-mono">{formatFileSize(validation?.sizeBytes || 0)}</span></div>
        <div className="flex justify-between items-center py-1 border-b border-[#F0F0EF]"><span className="text-[#61748D]">عدد الجداول:</span><span className="font-mono">{validation?.tablesCount} جداول</span></div>
        <div className="flex justify-between items-center py-1"><span className="text-[#61748D]">إصدار ترحيل المخطط:</span><span className="font-mono">{validation?.lastMigrationVersion}</span></div>
      </div>
      <div className="bg-[#FEF2F2] border border-[#FECACA] p-3 rounded-md flex items-start gap-2 text-[#991B1B] text-xs">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div><span className="font-bold">تحذير: </span>سيتم استبدال قاعدة البيانات الحالية بكامل محتويات هذا الملف. سيقوم النظام تلقائياً بإنشاء نسخة أمان احتياطية قبل البدء في الاستبدال.</div>
      </div>
    </div>
  </Modal>
);
