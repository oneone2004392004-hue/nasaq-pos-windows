import { errorMessage } from '../../../utils/errors';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../auth/context/AuthContext';
import { hasPermission } from '../../auth/utils/permissions';
import { SettingsRepository } from '../../../repositories/SettingsRepository';
import { AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { InvoiceDesignCustomizer } from '../../invoices/design/components/InvoiceDesignCustomizer';
import { PrinterSettingsTab } from '../../hardware/components/PrinterSettingsTab';
import { isTauriRuntime } from '../../../database/drivers/DriverFactory';
import { Receipt, Sliders, Save, Building, Percent, Printer, Info, Download } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const initialTab = urlTab === 'general' ? 'general' : urlTab === 'hardware' || urlTab === 'printers' ? 'hardware' : 'design';
  const [activeTab, setActiveTab] = useState<'design' | 'general' | 'hardware'>(initialTab);

  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = hasPermission(user, 'settings.edit');
  const settingsRepo = React.useMemo(() => new SettingsRepository(), []);

  // General Settings State
  const [loadingGeneral, setLoadingGeneral] = useState<boolean>(false);
  const [savingGeneral, setSavingGeneral] = useState<boolean>(false);
  const [storeName, setStoreName] = useState<string>('مطعم نسق للمأكولات');
  const [storePhone, setStorePhone] = useState<string>('01000000000');
  const [storeAddress, setStoreAddress] = useState<string>('القاهرة - جمهورية مصر العربية');
  const [taxRate, setTaxRate] = useState<string>('14');
  const [paperWidth, setPaperWidth] = useState<string>('80');
  const [autoCashDrawer, setAutoCashDrawer] = useState<boolean>(true);
  const [exportingSupportLog, setExportingSupportLog] = useState(false);

  // Sync tab with URL search parameter
  const handleTabChange = (tab: 'design' | 'general' | 'hardware') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Load General Settings
  useEffect(() => {
    if (activeTab === 'general') {
      const loadSettings = async () => {
        try {
          setLoadingGeneral(true);
          const all = await settingsRepo.getAllSettings();
          if (all.store_name) setStoreName(all.store_name);
          if (all.store_phone) setStorePhone(all.store_phone);
          if (all.store_address) setStoreAddress(all.store_address);
          if (all.default_tax_rate) setTaxRate(all.default_tax_rate);
          if (all.receipt_width) setPaperWidth(all.receipt_width);
          if (all.auto_cash_drawer !== undefined) {
            setAutoCashDrawer(all.auto_cash_drawer === '1');
          }
        } catch (err) {
          console.error('Failed to load general settings:', err);
        } finally {
          setLoadingGeneral(false);
        }
      };
      void loadSettings();
    }
  }, [activeTab, settingsRepo]);

  const handleSaveGeneral = async () => {
    if (!canEdit) {
      showToast('ليس لديك صلاحية تعديل إعدادات المنشأة.', 'error');
      return;
    }

    try {
      setSavingGeneral(true);
      await settingsRepo.set('store_name', storeName);
      await settingsRepo.set('store_phone', storePhone);
      await settingsRepo.set('store_address', storeAddress);
      await settingsRepo.set('default_tax_rate', taxRate);
      await settingsRepo.set('receipt_width', paperWidth);
      await settingsRepo.set('auto_cash_drawer', autoCashDrawer ? '1' : '0');
      showToast('تم حفظ إعدادات المنشأة بنجاح.', 'success');
    } catch (err: unknown) {
      console.error('Failed to save general settings:', err);
      showToast(errorMessage(err, 'حدث خطأ أثناء حفظ الإعدادات.'), 'error');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleExportSupportLog = async () => {
    if (!user || !hasPermission(user, 'settings.view') || !isTauriRuntime()) return;
    try {
      setExportingSupportLog(true);
      const { save } = await import('@tauri-apps/plugin-dialog');
      const destination = await save({
        defaultPath: 'NasaqPOS-support-log.txt',
        filters: [{ name: 'Support log', extensions: ['txt'] }],
      });
      if (!destination) return;
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('export_support_log', { destination, exportedAt: new Date().toISOString() });
      await new AuditLogRepository().log('SUPPORT_LOG_EXPORTED', 'system', 'support-log', user.id, { destination: '[محلي]' });
      showToast('تم تصدير سجل الدعم بنجاح.', 'success');
    } catch (err: unknown) {
      showToast(errorMessage(err, 'تعذر تصدير سجل الدعم.'), 'error');
    } finally {
      setExportingSupportLog(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC]" dir="rtl">
      <PageHeader
        title="إعدادات النظام وتخصيص الفواتير"
        subtitle="تخصيص تصاميم الفاتورة والإيصال الحراري، بيانات المنشأة، وقواعد التشغيل"
      />

      {/* Top Tabs */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 pt-3 flex items-center gap-4">
        <button
          type="button"
          id="tab-invoice-design"
          onClick={() => handleTabChange('design')}
          className={`pb-3 px-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'design'
              ? 'border-[#1464D9] text-[#0F172A]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Receipt size={16} />
          <span>تصميم الفاتورة والإيصال الحراري</span>
        </button>

        <button
          type="button"
          id="tab-hardware-settings"
          onClick={() => handleTabChange('hardware')}
          className={`pb-3 px-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'hardware'
              ? 'border-[#1464D9] text-[#0F172A]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Printer size={16} />
          <span>إعدادات الطابعات والعتاد</span>
        </button>

        <button
          type="button"
          id="tab-general-settings"
          onClick={() => handleTabChange('general')}
          className={`pb-3 px-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'border-[#1464D9] text-[#0F172A]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Sliders size={16} />
          <span>بيانات المنشأة والتشغيل</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'design' ? (
          <InvoiceDesignCustomizer />
        ) : activeTab === 'hardware' ? (
          <PrinterSettingsTab />
        ) : (
          <div className="p-6 flex flex-col gap-6 max-w-3xl">
            {loadingGeneral ? (
              <div className="p-8 text-center text-xs text-[#64748B]">جاري تحميل البيانات...</div>
            ) : (
              <>
                {/* Store Profile */}
                <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
                    <Building size={16} className="text-[#1464D9]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">بيانات المنشأة الأساسية</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="اسم المنشأة / المطعم"
                      value={storeName}
                      disabled={!canEdit}
                      onChange={(e) => setStoreName(e.target.value)}
                    />
                    <Input
                      label="رقم الهاتف"
                      value={storePhone}
                      disabled={!canEdit}
                      onChange={(e) => setStorePhone(e.target.value)}
                    />
                    <Input
                      label="العنوان التجاري"
                      value={storeAddress}
                      disabled={!canEdit}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      className="sm:col-span-2"
                    />
                  </div>
                </div>

                {/* Currency & Tax */}
                <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
                    <Percent size={16} className="text-[#1464D9]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">العملة والضرائب</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="رمز العملة الافتراضية" defaultValue="ج.م (EGP)" disabled />
                    <Input
                      label="نسبة ضريبة القيمة المضافة (%)"
                      value={taxRate}
                      disabled={!canEdit}
                      onChange={(e) => setTaxRate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Printing Preferences */}
                <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
                    <Printer size={16} className="text-[#1464D9]" />
                    <h3 className="text-sm font-bold text-[#0F172A]">الطباعة والدرج</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1E293B] mb-1">
                        عرض ورق الإيصال الحراري الافتراضي
                      </label>
                      <select
                        value={paperWidth}
                        disabled={!canEdit}
                        onChange={(e) => setPaperWidth(e.target.value)}
                        className="w-full h-10 px-3 text-xs border border-[#D8E3F0] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#1464D9]"
                      >
                        <option value="80">80 مم (قياسي - 80mm)</option>
                        <option value="58">58 مم (مدمج - 58mm)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="auto-drawer"
                        checked={autoCashDrawer}
                        disabled={!canEdit}
                        onChange={(e) => setAutoCashDrawer(e.target.checked)}
                        className="rounded text-[#1464D9] focus:ring-[#1464D9]"
                      />
                      <label htmlFor="auto-drawer" className="text-xs text-[#333333] cursor-pointer">
                        فتح درج الكاشير تلقائياً عند السداد النقدي
                      </label>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                {canEdit && (
                  <div className="flex justify-end">
                    <Button
                      id="btn-save-general-settings"
                      variant="primary"
                      onClick={handleSaveGeneral}
                      disabled={savingGeneral}
                      className="h-10 px-5 text-xs font-bold flex items-center gap-2"
                    >
                      <Save size={15} />
                      <span>{savingGeneral ? 'جاري الحفظ...' : 'حفظ الإعدادات العامة'}</span>
                    </Button>
                  </div>
                )}

                <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-sm flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">سجل الدعم الفني</h3>
                    <p className="mt-1 text-xs leading-6 text-[#64748B]">يجمع آخر السجلات مع حذف كلمات المرور ومفاتيح التفعيل.</p>
                  </div>
                  {hasPermission(user, 'settings.view') && isTauriRuntime() && (
                    <Button id="btn-export-support-log" variant="secondary" onClick={handleExportSupportLog} disabled={exportingSupportLog} className="h-10 px-4 text-xs font-bold flex items-center gap-2 shrink-0">
                      <Download size={15} />
                      <span>{exportingSupportLog ? 'جاري التصدير...' : 'تصدير سجل الدعم'}</span>
                    </Button>
                  )}
                </div>

                {/* System & Version Information */}
                <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B] mt-2">
                  <div className="flex items-center gap-2">
                    <Info size={14} className="text-[#1464D9]" />
                    <span className="font-bold text-[#1E293B]">نظام نسق لإدارة نقاط البيع:</span>
                    <span>الإصدار 1.0.2 (Windows Desktop)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-[#E2E8F0] text-[#334155] font-medium">
                      {isTauriRuntime() ? 'تطبيق سطح المكتب (Tauri Native)' : 'معاينة المتصفح (Web Preview)'}
                    </span>
                    <span>قاعدة البيانات: {isTauriRuntime() ? 'SQLite Native (%APPDATA%)' : 'SQLite WASM (In-Memory)'}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
