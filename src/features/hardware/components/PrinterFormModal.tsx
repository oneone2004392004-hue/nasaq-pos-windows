import { errorMessage } from '../../../utils/errors';
import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { PrinterRow } from '../../../domain/dbModels';
import { PrinterService } from '../services/PrinterService';
import { AuthenticatedUser } from '../../auth/types';

interface PrinterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  printer?: PrinterRow | null;
  printerService: PrinterService;
  user: AuthenticatedUser | null;
}

export const PrinterFormModal: React.FC<PrinterFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  printer,
  printerService,
  user,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(printer?.name || '');
  const [printerType, setPrinterType] = useState<'RECEIPT' | 'KITCHEN'>(
    printer?.printer_type || 'RECEIPT'
  );
  const [connectionType, setConnectionType] = useState<'USB' | 'NETWORK' | 'SERIAL'>(
    printer?.connection_type || 'USB'
  );
  const [address, setAddress] = useState(printer?.address || '');
  const [paperWidth, setPaperWidth] = useState<number>(printer?.paper_width || 80);
  const [codePage, setCodePage] = useState<'CP864' | 'WPC1256'>(printer?.code_page || 'CP864');
  const [printMode, setPrintMode] = useState<'RAW' | 'RASTER'>(printer?.print_mode || 'RAW');
  const [isDefault, setIsDefault] = useState(printer?.is_default === 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      showToast('يرجى إدخال اسم الطابعة', 'error');
      return;
    }

    try {
      setLoading(true);
      await printerService.savePrinter(user, {
        id: printer?.id,
        name: name.trim(),
        printer_type: printerType,
        connection_type: connectionType,
        address: address.trim() || null,
        paper_width: paperWidth,
        code_page: codePage,
        print_mode: printMode,
        is_default: isDefault ? 1 : 0,
        is_active: 1,
      });

      showToast(printer ? 'تم تحديث بيانات الطابعة بنجاح' : 'تمت إضافة الطابعة بنجاح', 'success');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'حدث خطأ أثناء حفظ الطابعة'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={printer ? 'تعديل بيانات الطابعة' : 'إضافة طابعة جديدة'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-right" dir="rtl">
        <div>
          <label className="block text-xs font-bold text-[#0F172A] mb-1">
            اسم الطابعة <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: طابعة الكاشير الرئيسية (XPrinter)"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">نوع الطابعة</label>
            <select
              value={printerType}
              onChange={(e) => setPrinterType(e.target.value as 'RECEIPT' | 'KITCHEN')}
              className="w-full h-10 px-3 text-xs bg-white border border-[#E2E8F0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1464D9]"
            >
              <option value="RECEIPT">إيصالات العملاء (Receipt)</option>
              <option value="KITCHEN">أوامر المطبخ (Kitchen)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">نوع التوصيل</label>
            <select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value as 'USB' | 'NETWORK' | 'SERIAL')}
              className="w-full h-10 px-3 text-xs bg-white border border-[#E2E8F0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1464D9]"
            >
              <option value="USB">USB محلي</option>
              <option value="NETWORK">شبكة داخلية (Network / LAN)</option>
              <option value="SERIAL">منفذ تسلسلي (Serial / COM)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#0F172A] mb-1">
            عنوان المنفذ أو عنوان IP (اختياري)
          </label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={
              connectionType === 'NETWORK'
                ? '192.168.1.100:9100'
                : connectionType === 'SERIAL'
                ? 'COM1'
                : 'USB001 أو اسم الطابعة في ويندوز'
            }
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#0F172A] mb-1">عرض ورق الإيصال</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaperWidth(80)}
              className={`py-2 px-3 text-xs font-bold rounded border transition-all cursor-pointer ${
                paperWidth === 80
                  ? 'border-[#1464D9] bg-[#1464D9]/10 text-[#0F172A]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B]'
              }`}
            >
              80 مم (قياسي - 48 حرف)
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth(58)}
              className={`py-2 px-3 text-xs font-bold rounded border transition-all cursor-pointer ${
                paperWidth === 58
                  ? 'border-[#1464D9] bg-[#1464D9]/10 text-[#0F172A]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B]'
              }`}
            >
              58 مم (مدمج - 32 حرف)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">ترميز العربية</label>
            <select value={codePage} onChange={(e) => setCodePage(e.target.value as 'CP864' | 'WPC1256')} className="w-full h-10 px-3 text-xs bg-white border border-[#E2E8F0] rounded-md">
              <option value="CP864">CP864 — افتراضي</option>
              <option value="WPC1256">WPC1256 — Windows</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">طريقة الطباعة</label>
            <select value={printMode} onChange={(e) => setPrintMode(e.target.value as 'RAW' | 'RASTER')} className="w-full h-10 px-3 text-xs bg-white border border-[#E2E8F0] rounded-md">
              <option value="RAW">ESC/POS نصية</option>
              <option value="RASTER">صورة Raster</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9]">
          <input
            type="checkbox"
            id="is-default-printer"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="w-4 h-4 rounded text-[#1464D9] focus:ring-[#1464D9] cursor-pointer"
          />
          <label htmlFor="is-default-printer" className="text-xs text-[#0F172A] cursor-pointer">
            تعيين كطابعة افتراضية لقسم ({printerType === 'RECEIPT' ? 'إيصالات العملاء' : 'أوامر المطبخ'})
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-[#E2E8F0]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'جاري الحفظ...' : printer ? 'حفظ التعديلات' : 'إضافة الطابعة'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
