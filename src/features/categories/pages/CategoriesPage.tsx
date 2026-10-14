import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Plus, Search, Edit2, Trash2, PowerOff, CheckCircle2 } from 'lucide-react';
import { CategoryRow } from '../../../domain/dbModels';
import { CategoryService } from '../services/CategoryService';
import { CategoryFormModal } from '../components/CategoryFormModal';
import { useAuth } from '../../auth/context/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import { Can } from '../../auth/guards/PermissionGuard';

type CategoryWithCount = CategoryRow & { product_count: number };

export const CategoriesPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const categoryService = useMemo(() => new CategoryService(), []);

  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);

  // Delete Confirm State
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryWithCount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await categoryService.listWithProductCount();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
      showToast('تعذر تحميل قائمة الأقسام', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [categoryService, showToast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Handle open add modal
  const handleAdd = () => {
    setEditingCategory(null);
    setIsFormOpen(true);
  };

  // Handle open edit modal
  const handleEdit = (category: CategoryRow) => {
    setEditingCategory(category);
    setIsFormOpen(true);
  };

  // Handle toggle active/inactive
  const handleToggleActive = async (category: CategoryWithCount) => {
    if (!user) return;
    try {
      if (category.is_active === 1) {
        await categoryService.deactivate(user, category.id);
        showToast(`تم تعطيل قسم "${category.name}" بنجاح`, 'info');
      } else {
        await categoryService.activate(user, category.id);
        showToast(`تم تفعيل قسم "${category.name}" بنجاح`, 'success');
      }
      await loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تغيير حالة القسم';
      showToast(msg, 'error');
    }
  };

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!user || !categoryToDelete) return;
    setIsDeleting(true);
    try {
      await categoryService.delete(user, categoryToDelete.id);
      showToast(`تم حذف قسم "${categoryToDelete.name}" بنجاح`, 'success');
      setCategoryToDelete(null);
      await loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل حذف القسم';
      showToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered list
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.trim().toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  const columns: Column<CategoryWithCount>[] = [
    {
      key: 'name',
      header: 'اسم القسم',
      width: '280px',
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-[#132238]">{item.name}</span>
          <span className="text-[11px] text-[#92A0B2] font-mono">ID: {item.id}</span>
        </div>
      ),
    },
    {
      key: 'product_count',
      header: 'الأصناف المرتبطة',
      align: 'center',
      render: (item) => (
        <span
          className={`font-mono text-xs px-2 py-0.5 rounded-full ${
            item.product_count > 0 ? 'bg-[#EAF3FF] text-[#0D4EAE] font-medium' : 'bg-[#F0F4FA] text-[#92A0B2]'
          }`}
        >
          {item.product_count} صنف
        </span>
      ),
    },
    {
      key: 'sort_order',
      header: 'ترتيب الكاشير',
      align: 'center',
      render: (item) => (
        <span className="font-mono text-xs text-[#52657D]">#{item.sort_order}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'الحالة',
      align: 'center',
      render: (item) => (
        <Badge variant={item.is_active === 1 ? 'success' : 'neutral'} size="sm">
          {item.is_active === 1 ? 'نشط في البيع' : 'معطل مؤقتاً'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'center',
      width: '220px',
      render: (item) => (
        <div className="flex items-center justify-center gap-1.5">
          <Can permission="categories.manage">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(item)}
              title="تعديل القسم"
              className="text-xs h-7 px-2"
            >
              <Edit2 size={13} className="text-[#1464D9]" />
              <span>تعديل</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleActive(item)}
              title={item.is_active === 1 ? 'تعطيل القسم' : 'تفعيل القسم'}
              className="text-xs h-7 px-2"
            >
              {item.is_active === 1 ? (
                <>
                  <PowerOff size={13} className="text-[#92A0B2]" />
                  <span>تعطيل</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} className="text-[#43A047]" />
                  <span>تفعيل</span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCategoryToDelete(item)}
              title={item.product_count > 0 ? 'لا يمكن حذفه لوجود منتجات مرتبطة' : 'حذف القسم'}
              className={`text-xs h-7 px-2 ${
                item.product_count > 0 ? 'text-[#A5B2C2] hover:text-[#A5B2C2]' : 'text-[#D9534F] hover:bg-[#FDF2F2]'
              }`}
            >
              <Trash2 size={13} />
              <span>حذف</span>
            </Button>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC] text-right">
      <PageHeader
        title="دليل الأقسام والتصنيفات"
        subtitle="تنظيم وهيكلة فئات المنيو لتسهيل وتسريع عمليات البيع في الكاشير"
        actions={
          <Can permission="categories.manage">
            <Button variant="primary" size="sm" onClick={handleAdd}>
              <Plus size={15} />
              <span>إضافة قسم جديد</span>
            </Button>
          </Can>
        }
      />

      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {/* Search Toolbar */}
        <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-lg border border-[#E8EEF6]">
          <div className="w-72">
            <Input
              placeholder="البحث بالاسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              rightIcon={<Search size={16} />}
            />
          </div>

          <div className="text-xs text-[#8291A5]">
            إجمالي الأقسام: <strong className="text-[#132238] font-mono">{filteredCategories.length}</strong>
          </div>
        </div>

        {/* Categories Table */}
        <div className="bg-white rounded-lg border border-[#E8EEF6] overflow-hidden">
          <Table
            columns={columns}
            data={filteredCategories}
            keyExtractor={(item) => item.id}
            emptyMessage={isLoading ? 'جاري تحميل الأقسام...' : 'لا توجد أقسام مسجلة حتى الآن.'}
          />
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      <CategoryFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={loadCategories}
        category={editingCategory}
        categoryService={categoryService}
      />

      {/* Delete Confirmation Dialog */}
      {categoryToDelete && (
        <ConfirmDialog
          isOpen={Boolean(categoryToDelete)}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="حذف القسم"
          message={
            categoryToDelete.product_count > 0
              ? `تنبيه أمان: هذا القسم يحتوي على (${categoryToDelete.product_count}) منتج مرتبط به! يمنع النظام حذف الأقسام ذات المنتجات لحماية سلامة البيانات وتاريخ الفواتير. يرجى نقل أو حذف المنتجات أولاً.`
              : `هل أنت متأكد من رغبتك في حذف قسم "${categoryToDelete.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
          }
          confirmText={categoryToDelete.product_count > 0 ? 'محاولة الحذف' : 'نعم، احذف القسم'}
          isDangerous={true}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
};
