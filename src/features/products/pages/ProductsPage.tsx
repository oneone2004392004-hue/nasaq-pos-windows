import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Plus, Search, Edit2, PowerOff, CheckCircle2, Barcode as BarcodeIcon, AlertTriangle } from 'lucide-react';
import { ProductRow, CategoryRow } from '../../../domain/dbModels';
import { ProductService } from '../services/ProductService';
import { CategoryService } from '../../categories/services/CategoryService';
import { ProductFormModal } from '../components/ProductFormModal';
import { useAuth } from '../../auth/context/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import { Can } from '../../auth/guards/PermissionGuard';
import { formatCurrency } from '../../../utils/formatters';

export const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const productService = useMemo(() => new ProductService(), []);
  const categoryService = useMemo(() => new CategoryService(), []);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  // Load Categories & Products
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        categoryService.list(),
        productService.list(user || undefined),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      console.error('Failed to load products or categories:', err);
      showToast('تعذر تحميل بيانات الأصناف', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [categoryService, productService, user, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  // Handle open add modal
  const handleAdd = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  // Handle open edit modal
  const handleEdit = (product: ProductRow) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  // Handle toggle active/inactive
  const handleToggleActive = async (product: ProductRow) => {
    if (!user) return;
    try {
      if (product.is_active === 1) {
        await productService.deactivate(user, product.id);
        showToast(`تم تعطيل صنف "${product.name}" بنجاح`, 'info');
      } else {
        await productService.activate(user, product.id);
        showToast(`تم تفعيل صنف "${product.name}" بنجاح`, 'success');
      }
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تغيير حالة الصنف';
      showToast(msg, 'error');
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      // Search query (name or barcode)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesBarcode = item.barcode ? item.barcode.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesBarcode) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && item.category_id !== selectedCategory) {
        return false;
      }

      // Status filter
      if (statusFilter === 'ACTIVE' && item.is_active !== 1) return false;
      if (statusFilter === 'INACTIVE' && item.is_active !== 0) return false;

      return true;
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  const categoryFilterOptions = [
    { value: 'ALL', label: 'كافة الأقسام' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const statusFilterOptions = [
    { value: 'ALL', label: 'كافة الحالات' },
    { value: 'ACTIVE', label: 'الأصناف النشطة فقط' },
    { value: 'INACTIVE', label: 'الأصناف المعطلة فقط' },
  ];

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      header: 'اسم الصنف',
      width: '260px',
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-sm text-[#132238]">{item.name}</span>
          {item.barcode && (
            <div className="flex items-center gap-1 text-[11px] text-[#8291A5] font-mono">
              <BarcodeIcon size={12} className="shrink-0" />
              <span>{item.barcode}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'category_id',
      header: 'القسم / التصنيف',
      render: (item) => {
        const catName = categoryMap.get(item.category_id) || 'غير محدد';
        return (
          <span className="text-xs font-medium text-[#31445D] bg-[#F3F4F6] px-2.5 py-1 rounded-md">
            {catName}
          </span>
        );
      },
    },
    {
      key: 'price',
      header: 'سعر البيع',
      align: 'left',
      render: (item) => (
        <span className="font-bold tabular-nums text-sm text-[#132238]">
          {formatCurrency(item.price)}
        </span>
      ),
    },
    {
      key: 'cost_price',
      header: 'سعر التكلفة',
      align: 'left',
      render: (item) => (
        <span className="text-xs text-[#61748D] tabular-nums font-mono">
          {item.cost_price > 0 ? formatCurrency(item.cost_price) : '—'}
        </span>
      ),
    },
    {
      key: 'current_stock',
      header: 'المخزون',
      align: 'center',
      render: (item) => {
        if (item.track_stock === 0) {
          return <span className="text-xs text-[#999999]">غير متتبع</span>;
        }

        const isLow = item.current_stock <= item.min_stock_alert;
        return (
          <div className="flex items-center justify-center gap-1.5 font-mono text-xs">
            <span className={`font-semibold ${isLow ? 'text-[#D9534F]' : 'text-[#333333]'}`}>
              {item.current_stock}
            </span>
            <span className="text-[10px] text-[#8291A5]">{item.unit || 'قطعة'}</span>
            {isLow && (
              <span title={`تنبيه نقص المخزون: أقل من أو يساوي ${item.min_stock_alert}`}>
                <AlertTriangle size={13} className="text-[#D9534F]" />
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'is_active',
      header: 'الحالة',
      align: 'center',
      render: (item) => (
        <Badge variant={item.is_active === 1 ? 'success' : 'neutral'} size="sm">
          {item.is_active === 1 ? 'متاح للبيع' : 'معطل مؤقتاً'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      align: 'center',
      width: '180px',
      render: (item) => (
        <div className="flex items-center justify-center gap-1.5">
          <Can permission="products.edit">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(item)}
              title="تعديل الصنف"
              className="text-xs h-7 px-2"
            >
              <Edit2 size={13} className="text-[#1464D9]" />
              <span>تعديل</span>
            </Button>
          </Can>

          <Can permission="products.delete">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleActive(item)}
              title={item.is_active === 1 ? 'تعطيل الصنف' : 'تفعيل الصنف'}
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
          </Can>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#F5F8FC] text-right">
      <PageHeader
        title="دليل الأصناف والمنتجات"
        subtitle="إدارة وتحديث قائمة المبيعات والأسعار ومخزون المنتجات"
        actions={
          <Can permission="products.create">
            <Button variant="primary" size="sm" onClick={handleAdd}>
              <Plus size={15} />
              <span>إضافة صنف جديد</span>
            </Button>
          </Can>
        }
      />

      <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-[#E8EEF6] items-end">
          <div className="sm:col-span-2">
            <Input
              placeholder="البحث باسم الصنف أو الباركود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              rightIcon={<Search size={16} />}
            />
          </div>

          <div>
            <Select
              options={categoryFilterOptions}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            />
          </div>

          <div>
            <Select
              options={statusFilterOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            />
          </div>
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-between text-xs text-[#8291A5] px-1">
          <div>
            عدد الأصناف المعروضة: <strong className="text-[#132238] font-mono">{filteredProducts.length}</strong> صنف
            {filteredProducts.length !== products.length && (
              <span> (من إجمالي {products.length} صنف)</span>
            )}
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg border border-[#E8EEF6] overflow-hidden">
          <Table
            columns={columns}
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            emptyMessage={isLoading ? 'جاري تحميل الأصناف...' : 'لا توجد أصناف مطابقة للبحث أو الفلتر المحدد.'}
          />
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={loadData}
        product={editingProduct}
        categories={categories}
        productService={productService}
      />
    </div>
  );
};
