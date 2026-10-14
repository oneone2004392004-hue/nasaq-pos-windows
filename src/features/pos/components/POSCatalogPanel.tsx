import React from 'react';
import type { POSPageController } from '../hooks/usePOSPageController';
import { Search, Clock, RefreshCw, CheckCircle2, AlertCircle, ShoppingBag } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ProductCard } from './ProductCard';
import { cn } from '../../../utils/cn';


interface Props { controller: POSPageController; }

export const POSCatalogPanel: React.FC<Props> = ({ controller }) => (
      <div className="flex flex-col flex-1 h-full min-w-0 border-l border-[#E2EBF5] overflow-hidden">
        {/* Top Control Bar: Search, Barcode Info & Categories */}
        <div className="p-4 bg-white/95 border-b border-[#E2EBF5] flex flex-col gap-3 shrink-0 shadow-[0_2px_14px_rgba(13,45,82,0.04)]">
          <div className="flex items-center gap-3">
            {/* Search Input with F2 shortcut indicator */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none"
              />
              <Input
                ref={controller.searchInputRef}
                id="pos-search-input"
                placeholder="ابحث بالاسم أو امسح الباركود مباشرة... (F2)"
                value={controller.searchQuery}
                onChange={(e) => controller.setSearchQuery(e.target.value)}
                onKeyDown={controller.handleSearchKeyDown}
                className="pr-10 pl-12 h-11 text-xs bg-[#F7FAFE] border-[#D7E4F2] rounded-xl focus:bg-white"
              />
              {controller.searchQuery && (
                <button
                  type="button"
                  onClick={() => controller.setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Open Orders Quick Button */}
            <Button
              id="pos-btn-open-orders-top"
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => controller.setIsOpenOrdersOpen(true)}
              title="عرض الطلبات المعلقة (F3)"
              className={cn(
                'h-11 px-3.5 rounded-xl flex items-center gap-2 text-xs font-bold border transition-colors cursor-pointer',
                controller.pendingOrdersCount > 0
                  ? 'border-[#F59E0B] bg-[#FFFBEB] text-[#B45309] hover:bg-[#FEF3C7]'
                  : 'border-[#D8E3F0] text-[#334155] hover:bg-[#F8FAFC]'
              )}
            >
              <Clock size={15} className={controller.pendingOrdersCount > 0 ? 'text-[#D97706]' : 'text-[#64748B]'} />
              <span>الطلبات المعلقة</span>
              {controller.pendingOrdersCount > 0 && (
                <span className="px-1.5 py-0.5 bg-[#D97706] text-white rounded-full text-[10px] font-mono leading-none font-bold">
                  {controller.pendingOrdersCount}
                </span>
              )}
              <span className="text-[10px] text-[#94A3B8] font-mono hidden sm:inline">(F3)</span>
            </Button>

            {/* Refresh Catalog button */}
            <Button
              id="pos-btn-refresh"
              variant="secondary"
              size="sm"
              onClick={controller.loadCatalogData}
              title="تحديث قائمة الأصناف"
              className="h-10 px-3"
            >
              <RefreshCw size={14} className={controller.loadingCatalog ? 'animate-spin' : ''} />
            </Button>
          </div>

          {/* Category Tabs Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              id="cat-tab-all"
              type="button"
              onClick={() => controller.setSelectedCategoryId('ALL')}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer',
                controller.selectedCategoryId === 'ALL'
                  ? 'bg-[#1464D9] text-white shadow-[0_5px_12px_rgba(20,100,217,0.18)]'
                  : 'bg-[#F1F5F9] text-[#526A84] hover:bg-[#E6F0FF]'
              )}
            >
              الكل ({controller.products.length})
            </button>
            {controller.categories.map((cat) => (
              <button
                key={cat.id}
                id={`cat-tab-${cat.id}`}
                type="button"
                onClick={() => controller.setSelectedCategoryId(cat.id)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer',
                  controller.selectedCategoryId === cat.id
                    ? 'bg-[#1464D9] text-white shadow-[0_5px_12px_rgba(20,100,217,0.18)]'
                    : 'bg-[#F1F5F9] text-[#526A84] hover:bg-[#E6F0FF]'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback notification banner */}
        {controller.feedbackMessage && (
          <div
            id="pos-feedback-banner"
            className={cn(
              'mx-4 mt-3 px-4 py-3 rounded-xl text-xs font-medium flex items-center justify-between border',
              controller.feedbackMessage.type === 'success'
                ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
            )}
          >
            <div className="flex items-center gap-2">
              {controller.feedbackMessage.type === 'success' ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{controller.feedbackMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => controller.setFeedbackMessage(null)}
              className="text-xs hover:underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Catalog Content Area */}
        <div className="flex-1 p-5 overflow-y-auto">
          {controller.loadingCatalog ? (
            <div className="flex items-center justify-center h-48 text-xs text-[#64748B]">
              جاري تحميل أصناف القائمة...
            </div>
          ) : controller.catalogError ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-[#DC2626] text-xs">
              <AlertCircle size={24} className="mb-2" />
              <p>{controller.catalogError}</p>
              <Button variant="secondary" size="sm" onClick={controller.loadCatalogData} className="mt-3">
                إعادة المحاولة
              </Button>
            </div>
          ) : controller.filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-[#64748B]">
              <ShoppingBag size={36} className="mb-2 stroke-1 opacity-50" />
              <p className="text-sm font-semibold text-[#1E293B]">لا توجد أصناف مطابقة</p>
              <p className="text-xs text-[#94A3B8] mt-1">
                {controller.searchQuery
                  ? `لا توجد نتائج بحث لكلمة "${controller.searchQuery}"`
                  : 'لم يتم تفعيل أي أصناف في هذا القسم بعد'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {controller.filteredProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onSelect={controller.cart.addItem}
                  cartQuantity={controller.cartQtyMap.get(prod.id) ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>


);
