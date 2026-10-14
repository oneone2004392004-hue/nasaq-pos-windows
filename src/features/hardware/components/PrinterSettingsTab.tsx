import { errorMessage } from '../../../utils/errors';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../auth/context/AuthContext';
import { hasPermission } from '../../auth/utils/permissions';
import { PrinterService } from '../services/PrinterService';
import { CashDrawerService } from '../services/CashDrawerService';
import { PrinterDevice, PrintJob } from '../types';
import { PrinterFormModal } from './PrinterFormModal';
import { RecentPrintJobsTable } from './RecentPrintJobsTable';
import { PrinterRow } from '../../../domain/dbModels';
import { isTauriRuntime } from '../../../database/drivers/DriverFactory';
import {
  Printer as PrinterIcon,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  Star,
  Monitor,
  HardDrive,
  Flame,
  FileText,
} from 'lucide-react';

interface PrinterSettingsTabProps {
  printerService?: PrinterService;
  cashDrawerService?: CashDrawerService;
}

export const PrinterSettingsTab: React.FC<PrinterSettingsTabProps> = ({
  printerService: propPrinterService,
  cashDrawerService: propCashDrawerService,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const printerService = React.useMemo(
    () => propPrinterService || new PrinterService(),
    [propPrinterService]
  );
  const cashDrawerService = React.useMemo(
    () => propCashDrawerService || new CashDrawerService(),
    [propCashDrawerService]
  );

  const canEdit = hasPermission(user, 'settings.edit');
  const canTestDrawer = hasPermission(user, 'cash.view_balance') || canEdit;

  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [recentJobs, setRecentJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [testingDrawer, setTestingDrawer] = useState(false);
  const [deletingPrinter, setDeletingPrinter] = useState<PrinterDevice | null>(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterRow | null>(null);

  // Environment detection
  const isDesktopNative = isTauriRuntime();

  const loadPrinters = useCallback(async () => {
    try {
      setLoading(true);
      const list = await printerService.listPrinters();
      setPrinters(list);
      setRecentJobs(printerService.getRecentJobs());
    } catch (err: unknown) {
      showToast(errorMessage(err, 'تعذر تحميل قائمة الطابعات'), 'error');
    } finally {
      setLoading(false);
    }
  }, [printerService, showToast]);

  useEffect(() => {
    loadPrinters();
  }, [loadPrinters]);

  const handleTestPrint = async (printer: PrinterDevice) => {
    if (!user) return;
    try {
      setTestingPrinterId(printer.id);
      const res = await printerService.testPrint(user, printer.id);
      if (res.success) {
        showToast(`تم إرسال أمر اختبار الطباعة إلى (${printer.name}) بنجاح`, 'success');
      } else {
        showToast(res.error || 'تعذر إتمام اختبار الطباعة', 'error');
      }
      setRecentJobs(printerService.getRecentJobs());
    } catch (err: unknown) {
      showToast(errorMessage(err, 'حدث خطأ أثناء اختبار الطباعة'), 'error');
    } finally {
      setTestingPrinterId(null);
    }
  };

  const handleTestCashDrawer = async () => {
    if (!user) return;
    try {
      setTestingDrawer(true);
      const res = await cashDrawerService.manualTestDrawer(user);
      if (res.success && res.opened) {
        showToast('تم إرسال نبضة فتح درج الكاشير بنجاح', 'success');
      } else {
        showToast(res.error || 'تعذر إرسال إشارة فتح الدرج', 'error');
      }
    } catch (err: unknown) {
      showToast(errorMessage(err, 'حدث خطأ أثناء اختبار درج الكاشير'), 'error');
    } finally {
      setTestingDrawer(false);
    }
  };

  const handleSetDefault = async (printer: PrinterDevice) => {
    if (!user || !canEdit) return;
    try {
      await printerService.setDefaultPrinter(user, printer.id, printer.printer_type);
      showToast(`تم تعيين (${printer.name}) كطابعة افتراضية`, 'success');
      await loadPrinters();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'تعذر تعيين الطابعة كافتراضية'), 'error');
    }
  };

  const handleDelete = async (printer: PrinterDevice) => {
    if (!user || !canEdit) return;
    setDeletingPrinter(printer);
  };

  const confirmDelete = async () => {
    if (!user || !canEdit || !deletingPrinter) return;
    try {
      await printerService.deletePrinter(user, deletingPrinter.id);
      showToast(`تم حذف الطابعة (${deletingPrinter.name}) بنجاح`, 'success');
      setDeletingPrinter(null);
      await loadPrinters();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'تعذر حذف الطابعة'), 'error');
    }
  };

  const receiptPrinters = printers.filter((p) => p.printer_type === 'RECEIPT');
  const kitchenPrinters = printers.filter((p) => p.printer_type === 'KITCHEN');

  const renderStatusPill = (status: PrinterDevice['status'], message?: string) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
            title={message}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            متصلة وجاهزة
          </span>
        );
      case 'OFFLINE':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
            title={message}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            غير متصلة
          </span>
        );
      case 'PAPER_OUT':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200"
            title={message}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            الورق منتهي
          </span>
        );
      case 'ERROR':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
            title={message}
          >
            <AlertCircle size={12} />
            خطأ في الاتصال
          </span>
        );
      case 'UNAVAILABLE':
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
            title={message}
          >
            <Monitor size={12} />
            وضع المتصفح (غير مباشر)
          </span>
        );
    }
  };

  const renderPrinterCard = (p: PrinterDevice) => (
    <div
      key={p.id}
      id={`printer-card-${p.id}`}
      className="bg-white rounded-lg border border-[#E2E8F0] p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-[#D8E3F0] transition-all"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-[#F1F5F9] text-[#0F172A]">
              {p.printer_type === 'RECEIPT' ? <PrinterIcon size={18} /> : <Flame size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[#0F172A]">{p.name}</h4>
                {p.is_default === 1 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <Star size={10} className="fill-blue-700" />
                    افتراضية
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#64748B]">
                {p.printer_type === 'RECEIPT' ? 'إيصالات العملاء' : 'أوامر المطبخ'} • {p.paper_width} مم
              </p>
            </div>
          </div>
          {renderStatusPill(p.status, p.statusMessage)}
        </div>

        <div className="text-[11px] text-[#475569] space-y-1 bg-[#F8FAFC] p-2.5 rounded border border-[#F1F5F9]">
          <div className="flex justify-between">
            <span className="text-[#64748B]">طريقة الاتصال:</span>
            <span className="font-semibold">{p.connection_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">المنفذ / العنوان:</span>
            <span className="font-mono text-[10px]">{p.address || 'المنفذ الافتراضي للنظام'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9] gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handleTestPrint(p)}
            disabled={testingPrinterId === p.id}
          >
            <FileText size={12} />
            <span>{testingPrinterId === p.id ? 'جاري الإرسال...' : 'اختبار طباعة'}</span>
          </Button>

          {p.is_default !== 1 && canEdit && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleSetDefault(p)}
              title="تعيين كطابعة افتراضية لهذا القسم"
            >
              <Star size={12} />
              <span>تعيين كافتراضية</span>
            </Button>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setEditingPrinter(p);
                setIsModalOpen(true);
              }}
              className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded cursor-pointer transition-all"
              title="تعديل الطابعة"
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(p)}
              className="p-1.5 text-[#EF4444] hover:bg-red-50 rounded cursor-pointer transition-all"
              title="حذف الطابعة"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl text-right" dir="rtl">
      {/* Environment Mode Banner */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-lg ${
              isDesktopNative
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {isDesktopNative ? <HardDrive size={22} /> : <Monitor size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A]">
                {isDesktopNative
                  ? 'تطبيق سطح المكتب (Desktop Native)'
                  : 'وضع المتصفح والمعاينة (Browser Preview Mode)'}
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isDesktopNative
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {isDesktopNative ? 'محرك ويندوز نشط' : 'محاكاة ومعاينة'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              {isDesktopNative
                ? 'النظام متصل بمحرك ويندوز المحلي ويدعم الطباعة المباشرة وفتح درج الكاشير عبر منافذ USB/COM والشبكة.'
                : 'أوامر الطباعة والدرج تعمل بنظام المحاكاة والأمان. للاتصال بالعتاد الفيزيائي مباشرة يتم تشغيل التطبيق على سطح المكتب.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {canTestDrawer && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleTestCashDrawer}
              disabled={testingDrawer}
              id="btn-test-cash-drawer"
            >
              <HardDrive size={14} />
              <span>{testingDrawer ? 'جاري الفتح...' : 'اختبار فتح درج الكاشير'}</span>
            </Button>
          )}

          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditingPrinter(null);
                setIsModalOpen(true);
              }}
              id="btn-add-printer"
            >
              <Plus size={14} />
              <span>إضافة طابعة جديدة</span>
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadPrinters}
            disabled={loading}
            title="تحديث القائمة"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-[#64748B] bg-white rounded-lg border border-[#E2E8F0]">
          جاري فحص وتحديث حالة الطابعات...
        </div>
      ) : (
        <>
          {/* Section 1: Customer Receipt Printers */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <div className="flex items-center gap-2">
                <PrinterIcon size={16} className="text-[#1464D9]" />
                <h3 className="text-sm font-bold text-[#0F172A]">طابعات إيصالات العملاء (Receipt Printers)</h3>
              </div>
              <span className="text-xs text-[#64748B]">
                {receiptPrinters.length} طابعة مهيأة
              </span>
            </div>

            {receiptPrinters.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B] bg-white rounded-lg border border-dashed border-[#D8E3F0]">
                لا توجد طابعة إيصالات مهيأة. انقر على &quot;إضافة طابعة جديدة&quot; لإضافة طابعة الكاشير.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {receiptPrinters.map(renderPrinterCard)}
              </div>
            )}
          </div>

          {/* Section 2: Kitchen Printers */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-[#1464D9]" />
                <h3 className="text-sm font-bold text-[#0F172A]">طابعات أوامر المطبخ (Kitchen Printers)</h3>
              </div>
              <span className="text-xs text-[#64748B]">
                {kitchenPrinters.length} طابعة مهيأة
              </span>
            </div>

            {kitchenPrinters.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B] bg-white rounded-lg border border-dashed border-[#D8E3F0]">
                لا توجد طابعة مطبخ مهيأة. يمكنك إضافة طابعة خاصة لتجهيز الطلبات والمطبخ.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {kitchenPrinters.map(renderPrinterCard)}
              </div>
            )}
          </div>

          <RecentPrintJobsTable jobs={recentJobs} />
        </>
      )}

      {/* Printer Form Modal */}
      {isModalOpen && (
        <PrinterFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={loadPrinters}
          printer={editingPrinter}
          printerService={printerService}
          user={user}
        />
      )}
      <ConfirmDialog
        isOpen={!!deletingPrinter}
        onClose={() => setDeletingPrinter(null)}
        onConfirm={() => void confirmDelete()}
        title="حذف الطابعة"
        message={`هل تريد حذف الطابعة (${deletingPrinter?.name || ''})؟`}
        confirmText="حذف الطابعة"
        isDangerous
      />
    </div>
  );
};
