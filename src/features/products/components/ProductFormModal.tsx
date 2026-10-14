import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ProductRow, CategoryRow } from '../../../domain/dbModels';
import { useAuth } from '../../auth/context/AuthContext';
import { ProductService } from '../services/ProductService';
import { useToast } from '../../../components/ui/Toast';
import { ValidationError } from '../../../database/errors';

export interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: ProductRow | null;
  categories: CategoryRow[];
  productService: ProductService;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
  categories,
  productService,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [priceMajor, setPriceMajor] = useState(''); // e.g. "85.00"
  const [costPriceMajor, setCostPriceMajor] = useState(''); // e.g. "40.00"
  const [barcode, setBarcode] = useState('');
  const [trackStock, setTrackStock] = useState(false);
  const [currentStock, setCurrentStock] = useState('0');
  const [minStockAlert, setMinStockAlert] = useState('5');
  const [unit, setUnit] = useState('piece');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setCategoryId(product.category_id);
        setName(product.name);
        setPriceMajor((product.price / 100).toFixed(2));
        setCostPriceMajor(product.cost_price > 0 ? (product.cost_price / 100).toFixed(2) : '');
        setBarcode(product.barcode || '');
        setTrackStock(product.track_stock === 1);
        setCurrentStock(String(product.current_stock));
        setMinStockAlert(String(product.min_stock_alert));
        setUnit(product.unit || 'piece');
        setIsActive(product.is_active === 1);
      } else {
        setCategoryId(categories.length > 0 ? categories[0].id : '');
        setName('');
        setPriceMajor('');
        setCostPriceMajor('');
        setBarcode('');
        setTrackStock(false);
        setCurrentStock('0');
        setMinStockAlert('5');
        setUnit('piece');
        setIsActive(true);
      }
      setFieldErrors({});
      setGeneralError(null);
    }
  }, [isOpen, product, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setFieldErrors({});
    setGeneralError(null);

    // Convert EGP major to minor units
    const parsedPrice = parseFloat(priceMajor);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setFieldErrors({ price: 'يرجى إدخال سعر بيع صحيح وموجب' });
      return;
    }
    const priceMinor = Math.round(parsedPrice * 100);

    let costPriceMinor = 0;
    if (costPriceMajor.trim().length > 0) {
      const parsedCost = parseFloat(costPriceMajor);
      if (isNaN(parsedCost) || parsedCost < 0) {
        setFieldErrors({ cost_price: 'يرجى إدخال سعر تكلفة صحيح' });
        return;
      }
      costPriceMinor = Math.round(parsedCost * 100);
    }

    setIsSubmitting(true);

    try {
      if (product) {
        await productService.update(user, product.id, {
          category_id: categoryId,
          name,
          price: priceMinor,
          cost_price: costPriceMinor,
          barcode: barcode.trim() || null,
          track_stock: trackStock,
          current_stock: parseInt(currentStock, 10) || 0,
          min_stock_alert: parseInt(minStockAlert, 10) || 0,
          unit,
          is_active: isActive,
        });
        showToast('تم تحديث الصنف بنجاح', 'success');
      } else {
        await productService.create(user, {
          category_id: categoryId,
          name,
          price: priceMinor,
          cost_price: costPriceMinor,
          barcode: barcode.trim() || null,
          track_stock: trackStock,
          current_stock: parseInt(currentStock, 10) || 0,
          min_stock_alert: parseInt(minStockAlert, 10) || 0,
          unit,
          is_active: isActive,
        });
        showToast('تم إضافة الصنف بنجاح', 'success');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ValidationError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('حدث خطأ غير متوقع أثناء حفظ الصنف');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = Boolean(product);

  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: `${cat.name}${cat.is_active === 0 ? ' (معطل)' : ''}`,
  }));

  const unitOptions = [
    { value: 'piece', label: 'قطعة (Piece)' },
    { value: 'meal', label: 'وجبة (Meal)' },
    { value: 'sandwich', label: 'ساندوتش' },
    { value: 'cup', label: 'كوب' },
    { value: 'bottle', label: 'زجاجة' },
    { value: 'kg', label: 'كيلوجرام' },
    { value: 'portion', label: 'طبق / حصة' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد'}
      description={isEdit ? `تعديل الصنف: ${product?.name}` : 'أدخل بيانات الصنف لإدراجه في قائمة المبيعات'}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            form="product-form"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
          >
            {isEdit ? 'حفظ التعديلات' : 'إضافة الصنف'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-4 text-right">
        {generalError && (
          <div className="p-3 rounded-md bg-[#FDF2F2] border border-[#F5C6CB] text-[#D9534F] text-xs leading-relaxed">
            {generalError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            id="prod-name-input"
            label="اسم الصنف *"
            placeholder="مثال: برجر دجاج مقرمش"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
            }}
            error={fieldErrors.name}
            disabled={isSubmitting}
            autoFocus
          />

          <Select
            id="prod-category-select"
            label="القسم / التصنيف *"
            options={categoryOptions}
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              if (fieldErrors.category_id) setFieldErrors((prev) => ({ ...prev, category_id: '' }));
            }}
            error={fieldErrors.category_id}
            disabled={isSubmitting || categories.length === 0}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Input
            id="prod-price-input"
            type="number"
            step="0.25"
            min="0"
            label="سعر البيع (ج.م) *"
            placeholder="0.00"
            value={priceMajor}
            onChange={(e) => {
              setPriceMajor(e.target.value);
              if (fieldErrors.price) setFieldErrors((prev) => ({ ...prev, price: '' }));
            }}
            error={fieldErrors.price}
            disabled={isSubmitting}
          />

          <Input
            id="prod-cost-input"
            type="number"
            step="0.25"
            min="0"
            label="سعر التكلفة (ج.م)"
            placeholder="0.00"
            value={costPriceMajor}
            onChange={(e) => {
              setCostPriceMajor(e.target.value);
              if (fieldErrors.cost_price) setFieldErrors((prev) => ({ ...prev, cost_price: '' }));
            }}
            error={fieldErrors.cost_price}
            disabled={isSubmitting}
          />

          <Input
            id="prod-barcode-input"
            label="الباركود (اختياري)"
            placeholder="مثال: 622123456789"
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              if (fieldErrors.barcode) setFieldErrors((prev) => ({ ...prev, barcode: '' }));
            }}
            error={fieldErrors.barcode}
            disabled={isSubmitting}
          />
        </div>

        <div className="p-3 rounded-md bg-[#F8FBFF] border border-[#F0F4FA] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="prod-track-stock"
                type="checkbox"
                checked={trackStock}
                onChange={(e) => setTrackStock(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 text-[#1464D9] border-[#D8E3F0] rounded cursor-pointer accent-[#1464D9]"
              />
              <label htmlFor="prod-track-stock" className="text-xs font-semibold text-[#31445D] cursor-pointer">
                تتبع حركة المخزون لهذا الصنف
              </label>
            </div>

            <div className="w-40">
              <Select
                id="prod-unit-select"
                label="الوحدة"
                options={unitOptions}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {trackStock && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#EEF3F9]">
              <Input
                id="prod-stock-input"
                type="number"
                min="0"
                step="1"
                label="الرصيد الحالي"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                disabled={isSubmitting}
              />

              <Input
                id="prod-alert-input"
                type="number"
                min="0"
                step="1"
                label="حد التنبيه لنقص المخزون"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-[#F0F4FA]">
          <input
            id="prod-active-checkbox"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={isSubmitting}
            className="w-4 h-4 text-[#1464D9] border-[#D8E3F0] rounded cursor-pointer accent-[#1464D9]"
          />
          <label htmlFor="prod-active-checkbox" className="text-xs font-semibold text-[#31445D] cursor-pointer">
            الصنف متاح للبيع في شاشة الكاشير (نشط)
          </label>
        </div>
      </form>
    </Modal>
  );
};
