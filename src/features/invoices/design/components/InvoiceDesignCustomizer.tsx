import { errorMessage } from '../../../../utils/errors';
import React, { useState, useEffect, useMemo } from 'react';
import {
  InvoiceDesignConfig,
  InvoiceTemplateId,
  ThermalPaperWidth,
} from '../types';
import { DEFAULT_INVOICE_DESIGN_CONFIG } from '../constants';
import { InvoiceDesignService } from '../services/InvoiceDesignService';
import { ThermalReceiptRenderer } from './ThermalReceiptRenderer';
import { InvoiceDesignSections } from './InvoiceDesignSections';
import { useAuth } from '../../../auth/context/AuthContext';
import { hasPermission } from '../../../auth/utils/permissions';
import { useToast } from '../../../../components/ui/Toast';
import { Button } from '../../../../components/ui/Button';
import {
  Save,
  RotateCcw,
  Store,
  FileText,
  Users,
  ShoppingBag,
  Calculator,
  CreditCard,
  MessageSquare,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Check,
} from 'lucide-react';

interface InvoiceDesignCustomizerProps {
  onSaved?: (config: InvoiceDesignConfig) => void;
}

export const InvoiceDesignCustomizer: React.FC<InvoiceDesignCustomizerProps> = ({ onSaved }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = hasPermission(user, 'settings.edit');

  const invoiceDesignService = useMemo(() => new InvoiceDesignService(), []);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Configuration state
  const [config, setConfig] = useState<InvoiceDesignConfig>(DEFAULT_INVOICE_DESIGN_CONFIG);
  const [activeSection, setActiveSection] = useState<string>('template');

  // Preview options
  const [previewWidth, setPreviewWidth] = useState<ThermalPaperWidth>('80mm');

  // Sample data for instant live preview
  const sampleData = useMemo(() => invoiceDesignService.getSampleInvoiceData(), [invoiceDesignService]);

  // Load configuration on mount
  useEffect(() => {
    let isMounted = true;
    const loadConfig = async () => {
      try {
        setLoading(true);
        const loaded = await invoiceDesignService.getConfig();
        if (isMounted) {
          setConfig(loaded);
          setPreviewWidth(loaded.paperWidth || '80mm');
        }
      } catch (err) {
        console.error('Failed to load invoice design config:', err);
        showToast('فشل تحميل إعدادات تصميم الفاتورة', 'error');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    void loadConfig();
    return () => {
      isMounted = false;
    };
  }, [invoiceDesignService, showToast]);

  const handleUpdateField = <K extends keyof InvoiceDesignConfig>(
    key: K,
    value: InvoiceDesignConfig[K]
  ) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSelectTemplate = (templateId: InvoiceTemplateId) => {
    handleUpdateField('templateId', templateId);
  };

  const handlePaperWidthToggle = (width: ThermalPaperWidth) => {
    setPreviewWidth(width);
    handleUpdateField('paperWidth', width);
  };

  const handleSave = async () => {
    if (!canEdit) {
      showToast('ليس لديك صلاحية تعديل إعدادات تصميم الفواتير.', 'error');
      return;
    }

    try {
      setSaving(true);
      const updated = await invoiceDesignService.updateConfig(user!, config);
      setConfig(updated);
      showToast('تم حفظ تصميم الفاتورة والإيصال بنجاح.', 'success');
      if (onSaved) {
        onSaved(updated);
      }
    } catch (err: unknown) {
      console.error('Failed to save invoice design:', err);
      showToast(errorMessage(err, 'حدث خطأ أثناء حفظ الإعدادات.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!canEdit) {
      showToast('ليس لديك صلاحية استعادة إعدادات الفواتير.', 'error');
      return;
    }

    try {
      setResetting(true);
      const restored = await invoiceDesignService.resetConfig(user!);
      setConfig(restored);
      setPreviewWidth(restored.paperWidth);
      setShowResetConfirm(false);
      showToast('تمت استعادة الإعدادات الافتراضية لتصميم الفواتير بنجاح.', 'success');
      if (onSaved) {
        onSaved(restored);
      }
    } catch (err: unknown) {
      console.error('Failed to reset invoice design:', err);
      showToast(errorMessage(err, 'حدث خطأ أثناء استعادة الإعدادات.'), 'error');
    } finally {
      setResetting(false);
    }
  };


  const SECTIONS = [
    { id: 'template', label: 'نمط الفاتورة', icon: FileText },
    { id: 'identity', label: 'هوية المنشأة', icon: Store },
    { id: 'header', label: 'بيانات الترويسة', icon: Eye },
    { id: 'order', label: 'بيانات الطلب والعميل', icon: Users },
    { id: 'items', label: 'تفاصيل الأصناف', icon: ShoppingBag },
    { id: 'totals', label: 'المجاميع والضرائب', icon: Calculator },
    { id: 'payment', label: 'بيانات السداد', icon: CreditCard },
    { id: 'footer', label: 'تذييل الإيصال', icon: MessageSquare },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-[#64748B] text-sm gap-2">
        <div className="w-5 h-5 border-2 border-[#1464D9] border-t-transparent rounded-full animate-spin" />
        <span>جاري تحميل إعدادات وتصاميم الفواتير...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full" dir="rtl">
      {/* RIGHT SIDE: Customization Controls (Forms, Toggles, Templates) */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">
        {/* Section Navigation Tabs */}
        <div className="bg-white p-2 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-wrap gap-1">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                id={`tab-section-${sec.id}`}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1464D9] text-white shadow-sm'
                    : 'text-[#475569] hover:bg-[#F1F5F9]'
                }`}
              >
                <Icon size={14} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        <InvoiceDesignSections
          activeSection={activeSection}
          config={config}
          canEdit={canEdit}
          onUpdateField={handleUpdateField}
          onSelectTemplate={handleSelectTemplate}
        />
        {/* Global Save / Reset Action Bar */}
        <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              id="btn-save-invoice-design"
              variant="primary"
              onClick={handleSave}
              disabled={saving || !canEdit}
              className="h-10 px-5 text-xs font-bold flex items-center gap-2"
            >
              <Save size={16} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ تصميم الفاتورة'}</span>
            </Button>

            <Button
              id="btn-reset-invoice-design"
              variant="secondary"
              onClick={() => setShowResetConfirm(true)}
              disabled={resetting || !canEdit}
              className="h-10 px-4 text-xs font-bold flex items-center gap-2 text-[#DC2626] hover:bg-[#FEF2F2] border-[#FCA5A5]"
            >
              <RotateCcw size={15} />
              <span>استعادة الافتراضي</span>
            </Button>
          </div>

          {!canEdit && (
            <span className="text-[11px] text-[#DC2626] flex items-center gap-1 font-medium">
              <AlertCircle size={14} />
              <span>للمعاينة فقط: يلزم وجود صلاحية (settings.edit) لتعديل وحفظ التصميم.</span>
            </span>
          )}

          {canEdit && (
            <span className="text-[11px] text-[#16A34A] flex items-center gap-1 font-medium">
              <CheckCircle2 size={14} />
              <span>المعاينة الحية الفورية نشطة تلقائياً.</span>
            </span>
          )}
        </div>
      </div>

      {/* LEFT SIDE: Live Sticky Preview Container */}
      <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-4">
        {/* Preview Control Header */}
        <div className="bg-white p-3.5 rounded-lg border border-[#E2E8F0] shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-[#1464D9]" />
            <span className="text-xs font-bold text-[#0F172A]">المعاينة الحية للإيصال</span>
          </div>

          {/* Paper Width Toggle: 80mm vs 58mm */}
          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-md border border-[#E2E8F0] text-xs">
            <button
              type="button"
              id="btn-preview-width-80"
              onClick={() => handlePaperWidthToggle('80mm')}
              className={`px-3 py-1 rounded font-bold transition-all cursor-pointer ${
                previewWidth === '80mm'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              80 مم (قياسي)
            </button>
            <button
              type="button"
              id="btn-preview-width-58"
              onClick={() => handlePaperWidthToggle('58mm')}
              className={`px-3 py-1 rounded font-bold transition-all cursor-pointer ${
                previewWidth === '58mm'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              58 مم (مدمج)
            </button>
          </div>
        </div>

        {/* Realistic Thermal Receipt Backdrop */}
        <div className="bg-[#EEF3F9] p-4 sm:p-6 rounded-lg border border-[#D1D5DB] flex flex-col items-center justify-start min-h-[560px] overflow-y-auto max-h-[80vh] shadow-inner">
          <div className="text-[10px] text-zinc-500 font-medium mb-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>معاينة حية واقعية لورق الطباعة الحرارية ({previewWidth})</span>
          </div>

          <ThermalReceiptRenderer
            data={sampleData}
            config={config}
            paperWidthOverride={previewWidth}
            showTearEdges={true}
          />

          <div className="mt-4 text-center text-[10px] text-zinc-500 max-w-xs leading-relaxed">
            * يتم استخدام هذه الإعدادات الدقيقة عند طباعة الفواتير مستقبلاً بواسطة محرك الطباعة
            الحرارية.
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Reset to Defaults */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                <RotateCcw size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#0F172A]">
                  هل أنت متأكد من استعادة الإعدادات الافتراضية؟
                </h4>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                  سيتم إعادة ضبط نمط الفاتورة إلى "النمط الكلاسيكي" وتفعيل كافة حقول العرض القياسية.
                  لن يؤثر هذا الإجراء على أي فواتير أو طلبات مسجلة مسبقاً.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
              >
                إلغاء
              </Button>
              <Button
                id="btn-confirm-reset-invoice-design"
                variant="primary"
                size="sm"
                onClick={handleResetToDefaults}
                disabled={resetting}
                className="bg-[#DC2626] hover:bg-[#B91C1C] border-[#DC2626]"
              >
                {resetting ? 'جاري الاستعادة...' : 'تأكيد الاستعادة'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
