import React from 'react';
import { Input } from '../../../../components/ui/Input';
import { INVOICE_TEMPLATES_CATALOG } from '../constants';
import { InvoiceDesignConfig, InvoiceTemplateId } from '../types';
import { TemplateCard } from './TemplateCard';

interface InvoiceDesignSectionsProps {
  activeSection: string;
  config: InvoiceDesignConfig;
  canEdit: boolean;
  onUpdateField: <K extends keyof InvoiceDesignConfig>(key: K, value: InvoiceDesignConfig[K]) => void;
  onSelectTemplate: (templateId: InvoiceTemplateId) => void;
}

export const InvoiceDesignSections: React.FC<InvoiceDesignSectionsProps> = ({
  activeSection,
  config,
  canEdit,
  onUpdateField,
  onSelectTemplate,
}) => {
  const ToggleSwitch: React.FC<{
    id: string;
    label: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
    helper?: string;
  }> = ({ id, label, checked, disabled = false, onChange, helper }) => (
    <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9] last:border-b-0">
      <div className="flex-1 pl-2">
        <label
          htmlFor={id}
          className={`text-xs font-medium select-none cursor-pointer ${
            disabled ? 'text-[#94A3B8]' : 'text-[#1E293B]'
          }`}
        >
          {label}
        </label>
        {helper && <p className="text-[10px] text-[#64748B] mt-0.5">{helper}</p>}
      </div>

      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled || !canEdit}
        onClick={() => !disabled && canEdit && onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer focus:outline-none ${
          checked ? 'bg-[#1464D9]' : 'bg-[#D8E3F0]'
        } ${disabled || !canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span
          className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
            checked ? 'right-5' : 'right-1'
          }`}
        />
      </button>
    </div>
  );

  return (
        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-sm">
          {/* 1. Template Selection */}
          {activeSection === 'template' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">
                  اختر نمط الفاتورة والإيصال الحراري
                </h3>
                <p className="text-xs text-[#64748B]">
                  حدد النمط البصري المناسب لهوية مطعمك. يتم تحديث المعاينة الحية الفورية فوراً بمجرد
                  الاختيار.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                {INVOICE_TEMPLATES_CATALOG.map((meta) => (
                  <TemplateCard
                    key={meta.id}
                    meta={meta}
                    isSelected={config.templateId === meta.id}
                    onSelect={onSelectTemplate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 2. Store Identity */}
          {activeSection === 'identity' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">
                  بيانات وهوية المنشأة المطبوعة
                </h3>
                <p className="text-xs text-[#64748B]">
                  البيانات الرسمية للمطعم التي تظهر في ترويسة الإيصال والفاتورة.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Input
                  id="input-store-name"
                  label="اسم المطعم / المنشأة"
                  value={config.storeName}
                  disabled={!canEdit}
                  onChange={(e) => onUpdateField('storeName', e.target.value)}
                  placeholder="مثال: مطعم نسق للمأكولات"
                />

                <Input
                  id="input-store-phone"
                  label="رقم الهاتف الأساسي"
                  value={config.storePhone}
                  disabled={!canEdit}
                  onChange={(e) => onUpdateField('storePhone', e.target.value)}
                  placeholder="مثال: 01000000000"
                />

                <Input
                  id="input-store-address"
                  label="العنوان التجاري"
                  value={config.storeAddress}
                  disabled={!canEdit}
                  onChange={(e) => onUpdateField('storeAddress', e.target.value)}
                  placeholder="مثال: القاهرة - جمهورية مصر العربية"
                  className="sm:col-span-2"
                />

                <Input
                  id="input-store-phone2"
                  label="رقم الهاتف الإضافي (اختياري)"
                  value={config.storePhone2}
                  disabled={!canEdit}
                  onChange={(e) => onUpdateField('storePhone2', e.target.value)}
                  placeholder="مثال: 01111111111"
                />

                <Input
                  id="input-tax-number"
                  label="الرقم الضريبي للمنشأة (اختياري)"
                  value={config.taxNumber}
                  disabled={!canEdit}
                  onChange={(e) => onUpdateField('taxNumber', e.target.value)}
                  placeholder="مثال: 123-456-789"
                />

                <Input
                  id="input-comm-reg"
                  label="رقم السجل التجاري (اختياري)"
                  value={config.commercialReg}
                  disabled={!canEdit}
                  onChange={(e) => onUpdateField('commercialReg', e.target.value)}
                  placeholder="مثال: 45892"
                />
              </div>
            </div>
          )}

          {/* 3. Header Visibility */}
          {activeSection === 'header' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">
                  حقول الترويسة والبيانات الأساسية
                </h3>
                <p className="text-xs text-[#64748B]">
                  حدد الحقول المراد إظهارها أو إخفاؤها في أعلى الفاتورة الحرارية.
                </p>
              </div>

              <div className="divide-y divide-[#F1F5F9] pt-2">
                <ToggleSwitch
                  id="toggle-show-store-name"
                  label="إظهار اسم المنشأة / المطعم"
                  checked={config.showStoreName}
                  onChange={(val) => onUpdateField('showStoreName', val)}
                />
                <ToggleSwitch
                  id="toggle-show-address"
                  label="إظهار عنوان المنشأة"
                  checked={config.showAddress}
                  onChange={(val) => onUpdateField('showAddress', val)}
                />
                <ToggleSwitch
                  id="toggle-show-phone"
                  label="إظهار رقم الهاتف الأساسي"
                  checked={config.showPhone}
                  onChange={(val) => onUpdateField('showPhone', val)}
                />
                <ToggleSwitch
                  id="toggle-show-phone2"
                  label="إظهار رقم الهاتف الإضافي"
                  checked={config.showPhone2}
                  onChange={(val) => onUpdateField('showPhone2', val)}
                />
                <ToggleSwitch
                  id="toggle-show-tax-no"
                  label="إظهار الرقم الضريبي في الترويسة"
                  checked={config.showTaxNumber}
                  onChange={(val) => onUpdateField('showTaxNumber', val)}
                />
                <ToggleSwitch
                  id="toggle-show-comm-reg"
                  label="إظهار رقم السجل التجاري"
                  checked={config.showCommercialReg}
                  onChange={(val) => onUpdateField('showCommercialReg', val)}
                />
                <ToggleSwitch
                  id="toggle-show-inv-no"
                  label="إظهار رقم الفاتورة التسلسلي (INV-...)"
                  checked={config.showInvoiceNumber}
                  onChange={(val) => onUpdateField('showInvoiceNumber', val)}
                />
                <ToggleSwitch
                  id="toggle-show-ord-no"
                  label="إظهار رقم الطلب (ORD-...)"
                  checked={config.showOrderNumber}
                  onChange={(val) => onUpdateField('showOrderNumber', val)}
                />
                <ToggleSwitch
                  id="toggle-show-date"
                  label="إظهار تاريخ ووقت إصدار الفاتورة"
                  checked={config.showDateTime}
                  onChange={(val) => onUpdateField('showDateTime', val)}
                />
                <ToggleSwitch
                  id="toggle-show-cashier"
                  label="إظهار اسم الكاشير المصدر للفاتورة"
                  checked={config.showCashier}
                  onChange={(val) => onUpdateField('showCashier', val)}
                />
                <ToggleSwitch
                  id="toggle-show-order-type"
                  label="إظهار نوع الطلب (صالة / سفري / دليفري)"
                  checked={config.showOrderType}
                  onChange={(val) => onUpdateField('showOrderType', val)}
                />
              </div>
            </div>
          )}

          {/* 4. Order Details & Customer */}
          {activeSection === 'order' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">
                  بيانات الطلب والعميل والتوصيل
                </h3>
                <p className="text-xs text-[#64748B]">
                  تخصيص ظهور معلومات الطاولة والعميل وبيانات التوصيل في الإيصال.
                </p>
              </div>

              <div className="divide-y divide-[#F1F5F9] pt-2">
                <ToggleSwitch
                  id="toggle-show-table"
                  label="إظهار رقم / اسم الطاولة (في طلبات الصالة)"
                  checked={config.showTable}
                  onChange={(val) => onUpdateField('showTable', val)}
                />
                <ToggleSwitch
                  id="toggle-show-customer-name"
                  label="إظهار اسم العميل المسجل"
                  checked={config.showCustomerName}
                  onChange={(val) => onUpdateField('showCustomerName', val)}
                />
                <ToggleSwitch
                  id="toggle-show-customer-phone"
                  label="إظهار هاتف العميل"
                  checked={config.showCustomerPhone}
                  onChange={(val) => onUpdateField('showCustomerPhone', val)}
                />
                <ToggleSwitch
                  id="toggle-show-delivery-address"
                  label="إظهار عنوان التوصيل (في طلبات الدليفري)"
                  checked={config.showDeliveryAddress}
                  onChange={(val) => onUpdateField('showDeliveryAddress', val)}
                />
                <ToggleSwitch
                  id="toggle-show-delivery-driver"
                  label="إظهار اسم مندوب / كابتن التوصيل"
                  checked={config.showDeliveryDriver}
                  onChange={(val) => onUpdateField('showDeliveryDriver', val)}
                />
              </div>
            </div>
          )}

          {/* 5. Items Visibility */}
          {activeSection === 'items' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">
                  تفاصيل وأعمدة جدول الأصناف
                </h3>
                <p className="text-xs text-[#64748B]">
                  تحديد الأعمدة والبيانات الظاهرة في سطور المنتجات والوجبات.
                </p>
              </div>

              <div className="divide-y divide-[#F1F5F9] pt-2">
                <ToggleSwitch
                  id="toggle-show-item-qty"
                  label="إظهار عمود / عدد الكمية"
                  checked={config.showItemQuantity}
                  onChange={(val) => onUpdateField('showItemQuantity', val)}
                />
                <ToggleSwitch
                  id="toggle-show-item-unit-price"
                  label="إظهار سعر الوحدة للقطعة"
                  checked={config.showItemUnitPrice}
                  onChange={(val) => onUpdateField('showItemUnitPrice', val)}
                />
                <ToggleSwitch
                  id="toggle-show-item-total"
                  label="إظهار إجمالي السطر (الكمية × السعر)"
                  checked={config.showItemTotal}
                  onChange={(val) => onUpdateField('showItemTotal', val)}
                />
                <ToggleSwitch
                  id="toggle-show-item-barcode"
                  label="إظهار باركود الصنف (إن وجد)"
                  checked={config.showItemBarcode}
                  onChange={(val) => onUpdateField('showItemBarcode', val)}
                />
                <ToggleSwitch
                  id="toggle-show-item-notes"
                  label="إظهار ملاحظات الصنف والتحضير (مثل: بدون مخلل، ثومية إضافية)"
                  checked={config.showItemNotes}
                  onChange={(val) => onUpdateField('showItemNotes', val)}
                />
              </div>
            </div>
          )}

          {/* 6. Totals Visibility */}
          {activeSection === 'totals' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">
                  المجاميع والخصومات والضرائب
                </h3>
                <p className="text-xs text-[#64748B]">
                  تخصيص بنود الحساب المالي. ملاحظة: الإجمالي النهائي مطلوب وثابت دائماً لضمان النزاهة
                  المالية.
                </p>
              </div>

              <div className="divide-y divide-[#F1F5F9] pt-2">
                <ToggleSwitch
                  id="toggle-show-subtotal"
                  label="إظهار المجموع الفرعي (قبل الخصم والضريبة)"
                  checked={config.showSubtotal}
                  onChange={(val) => onUpdateField('showSubtotal', val)}
                />
                <ToggleSwitch
                  id="toggle-show-discount"
                  label="إظهار بند الخصم (إذا كانت هناك خصومات ممنوحة)"
                  checked={config.showDiscount}
                  onChange={(val) => onUpdateField('showDiscount', val)}
                />
                <ToggleSwitch
                  id="toggle-show-delivery-fee"
                  label="إظهار رسوم خدمة التوصيل (في طلبات الدليفري)"
                  checked={config.showDeliveryFee}
                  onChange={(val) => onUpdateField('showDeliveryFee', val)}
                />
                <ToggleSwitch
                  id="toggle-show-tax"
                  label="إظهار ضريبة القيمة المضافة"
                  checked={config.showTax}
                  onChange={(val) => onUpdateField('showTax', val)}
                />
                <ToggleSwitch
                  id="toggle-show-grand-total"
                  label="الإجمالي النهائي الصافي المدفوع"
                  checked={true}
                  disabled={true}
                  onChange={() => {}}
                  helper="الإجمالي النهائي حقل إلزامي وثابت في كافة الفواتير والإيصالات المحاسبية."
                />
              </div>
            </div>
          )}

          {/* 7. Payment Visibility */}
          {activeSection === 'payment' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">
                  تفاصيل وطرق السداد المالي
                </h3>
                <p className="text-xs text-[#64748B]">
                  إظهار طريقة الدفع (نقدي / بطاقة) وتفاصيل النقدية المستلمة والمتبقي (الفكة).
                </p>
              </div>

              <div className="divide-y divide-[#F1F5F9] pt-2">
                <ToggleSwitch
                  id="toggle-show-pmt-method"
                  label="إظهار طريقة السداد (نقدي / بطاقة)"
                  checked={config.showPaymentMethod}
                  onChange={(val) => onUpdateField('showPaymentMethod', val)}
                />
                <ToggleSwitch
                  id="toggle-show-tendered"
                  label="إظهار المبلغ المستلم من العميل (في السداد النقدي)"
                  checked={config.showAmountReceived}
                  onChange={(val) => onUpdateField('showAmountReceived', val)}
                />
                <ToggleSwitch
                  id="toggle-show-change"
                  label="إظهار المبلغ المتبقي المعاد للعميل (الباقي)"
                  checked={config.showChange}
                  onChange={(val) => onUpdateField('showChange', val)}
                />
              </div>
            </div>
          )}

          {/* 8. Footer Section */}
          {activeSection === 'footer' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1">
                  تذييل الفاتورة والرسائل الختامية
                </h3>
                <p className="text-xs text-[#64748B]">
                  الرسائل الترحيبية والختامية المطبوعة في نهاية الإيصال.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <ToggleSwitch
                  id="toggle-show-footer"
                  label="تفعيل وتضمين تذييل الفاتورة"
                  checked={config.showFooter}
                  onChange={(val) => onUpdateField('showFooter', val)}
                />

                {config.showFooter && (
                  <>
                    <div>
                      <label
                        htmlFor="input-footer-text-1"
                        className="block text-xs font-bold text-[#1E293B] mb-1"
                      >
                        الرسالة الختامية الأساسية
                      </label>
                      <input
                        type="text"
                        id="input-footer-text-1"
                        value={config.footerText}
                        disabled={!canEdit}
                        onChange={(e) => onUpdateField('footerText', e.target.value)}
                        placeholder="مثال: شكراً لزيارتكم ونتمنى لكم وجبة شهية"
                        className="w-full px-3 py-2 text-xs border border-[#D8E3F0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1464D9]"
                      />
                    </div>

                    <ToggleSwitch
                      id="toggle-show-footer-2"
                      label="تفعيل سطر ختامي إضافي (ملاحظة خدمة العملاء أو سياسة الاسترجاع)"
                      checked={config.showFooter2}
                      onChange={(val) => onUpdateField('showFooter2', val)}
                    />

                    {config.showFooter2 && (
                      <div>
                        <label
                          htmlFor="input-footer-text-2"
                          className="block text-xs font-bold text-[#1E293B] mb-1"
                        >
                          السطر الختامي الإضافي
                        </label>
                        <input
                          type="text"
                          id="input-footer-text-2"
                          value={config.footerText2}
                          disabled={!canEdit}
                          onChange={(e) => onUpdateField('footerText2', e.target.value)}
                          placeholder="مثال: يرجى الاحتفاظ بالإيصال لخدمات ما بعد البيع"
                          className="w-full px-3 py-2 text-xs border border-[#D8E3F0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1464D9]"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

  );
};
