import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { CategoryRow } from '../../../domain/dbModels';
import { useAuth } from '../../auth/context/AuthContext';
import { CategoryService } from '../services/CategoryService';
import { useToast } from '../../../components/ui/Toast';
import { ValidationError } from '../../../database/errors';

export interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category?: CategoryRow | null;
  categoryService: CategoryService;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  category,
  categoryService,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name);
        setSortOrder(String(category.sort_order));
        setIsActive(category.is_active === 1);
      } else {
        setName('');
        setSortOrder('0');
        setIsActive(true);
      }
      setFieldErrors({});
      setGeneralError(null);
    }
  }, [isOpen, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setFieldErrors({});
    setGeneralError(null);
    setIsSubmitting(true);

    try {
      const parsedSortOrder = parseInt(sortOrder, 10);

      if (category) {
        await categoryService.update(user, category.id, {
          name,
          sort_order: isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
          is_active: isActive,
        });
        showToast('تم تحديث القسم بنجاح', 'success');
      } else {
        await categoryService.create(user, {
          name,
          sort_order: isNaN(parsedSortOrder) ? 0 : parsedSortOrder,
          is_active: isActive,
        });
        showToast('تم إضافة القسم بنجاح', 'success');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ValidationError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('حدث خطأ غير متوقع أثناء حفظ القسم');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = Boolean(category);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'تعديل بيانات القسم' : 'إضافة قسم جديد'}
      description={isEdit ? `تعديل القسم: ${category?.name}` : 'أدخل بيانات القسم لإضافته إلى دليل التصنيفات'}
      size="md"
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
            form="category-form"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
          >
            {isEdit ? 'حفظ التعديلات' : 'إضافة القسم'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="flex flex-col gap-4 text-right">
        {generalError && (
          <div className="p-3 rounded-md bg-[#FDF2F2] border border-[#F5C6CB] text-[#D9534F] text-xs leading-relaxed">
            {generalError}
          </div>
        )}

        <Input
          id="cat-name-input"
          label="اسم القسم *"
          placeholder="مثال: مشروبات ساخنة، وجبات رئيسية"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
          }}
          error={fieldErrors.name}
          disabled={isSubmitting}
          autoFocus
        />

        <Input
          id="cat-sort-input"
          type="number"
          min={0}
          step={1}
          label="ترتيب الظهور في الكاشير"
          helperText="الأرقام الأصغر تظهر أولاً في قائمة الأقسام (0، 1، 2...)"
          value={sortOrder}
          onChange={(e) => {
            setSortOrder(e.target.value);
            if (fieldErrors.sort_order) setFieldErrors((prev) => ({ ...prev, sort_order: '' }));
          }}
          error={fieldErrors.sort_order}
          disabled={isSubmitting}
        />

        <div className="flex items-center gap-2 pt-2 border-t border-[#F0F4FA]">
          <input
            id="cat-active-checkbox"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={isSubmitting}
            className="w-4 h-4 text-[#1464D9] border-[#D8E3F0] rounded cursor-pointer accent-[#1464D9]"
          />
          <label htmlFor="cat-active-checkbox" className="text-xs font-semibold text-[#31445D] cursor-pointer">
            تفعيل القسم للظهور في شاشة الكاشير (نشط)
          </label>
        </div>
      </form>
    </Modal>
  );
};
