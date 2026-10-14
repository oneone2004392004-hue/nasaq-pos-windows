import React from 'react';
import { ProductRow } from '../../../domain/dbModels';
import { formatCurrency } from '../../../utils/formatters';

interface ProductCardProps { product: ProductRow; onSelect: (product: ProductRow) => void; cartQuantity?: number; }

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect, cartQuantity = 0 }) => (
  <button id={`product-card-${product.id}`} type="button" onClick={() => onSelect(product)} className="relative flex flex-col justify-between p-3.5 min-h-[122px] bg-white border border-[#E2EBF5] hover:border-[#1464D9] hover:-translate-y-0.5 active:scale-[0.98] transition-all rounded-2xl text-right group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1464D9] shadow-[0_2px_8px_rgba(13,45,82,0.035)]">
    <div className="flex items-start justify-between gap-2 w-full">
      <span className="font-bold text-sm text-[#17304F] line-clamp-2 leading-snug">{product.name}</span>
      {cartQuantity > 0 && <span id={`badge-qty-${product.id}`} className="shrink-0 flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-[#1464D9] text-white text-[11px] font-mono font-bold rounded-lg shadow-[0_4px_10px_rgba(20,100,217,0.22)]">{cartQuantity}</span>}
    </div>
    <div className="flex items-end justify-between w-full pt-2.5 mt-2 border-t border-[#EEF3F9]">
      <span className="text-[10px] text-[#8B9BB0] font-mono truncate max-w-[80px]">{product.barcode || product.unit}</span>
      <span className="text-sm font-black font-mono text-[#0D2D52] tracking-tight">{formatCurrency(product.price)}</span>
    </div>
  </button>
);
