import React from 'react';
import { InvoiceTemplateMeta, InvoiceTemplateId } from '../types';
import { Check } from 'lucide-react';

interface TemplateCardProps {
  meta: InvoiceTemplateMeta;
  isSelected: boolean;
  onSelect: (id: InvoiceTemplateId) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ meta, isSelected, onSelect }) => {
  return (
    <button
      type="button"
      id={`btn-select-template-${meta.id}`}
      onClick={() => onSelect(meta.id)}
      className={`text-right w-full p-4 rounded-lg border-2 transition-all duration-150 flex flex-col justify-between relative cursor-pointer ${
        isSelected
          ? 'border-[#1464D9] bg-[#F4F7F9] shadow-sm ring-1 ring-[#1464D9]'
          : 'border-[#E2E8F0] bg-white hover:border-[#D8E3F0] hover:bg-[#F8FAFC]'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#0F172A]">{meta.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-zinc-100 text-zinc-700">
              {meta.badge}
            </span>
          </div>

          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
              isSelected
                ? 'bg-[#1464D9] border-[#1464D9] text-white'
                : 'border-[#D8E3F0] bg-white'
            }`}
          >
            {isSelected && <Check size={12} strokeWidth={3} />}
          </div>
        </div>

        <p className="text-[11px] text-[#64748B] mb-2 leading-relaxed">{meta.description}</p>
      </div>

      {/* Mini Visual Silhouette / Stylized Preview Thumbnail */}
      <div className="w-full bg-[#F8FBFF] border border-[#E2E8F0] rounded p-2.5 my-2 flex flex-col items-center">
        {meta.id === 'classic' && (
          <div className="w-32 text-[7px] text-center font-mono text-zinc-600 space-y-1">
            <div className="font-bold text-zinc-900">مطعم نسق</div>
            <div className="border-b border-dashed border-zinc-400 my-0.5" />
            <div className="flex justify-between text-[6px]">
              <span>#INV-042</span>
              <span>12/09/2026</span>
            </div>
            <div className="flex justify-between text-[6px]">
              <span>2x شاورما عربي</span>
              <span>220.00</span>
            </div>
            <div className="border-b border-dashed border-zinc-400 my-0.5" />
            <div className="flex justify-between font-bold text-zinc-900 text-[7px]">
              <span>الإجمالي:</span>
              <span>456.00 ج.م</span>
            </div>
          </div>
        )}

        {meta.id === 'modern_minimal' && (
          <div className="w-32 text-[7px] text-center font-sans text-zinc-600 space-y-1">
            <div className="font-black text-zinc-950 uppercase tracking-wide">NASAQ</div>
            <div className="border-b border-zinc-200 my-0.5" />
            <div className="flex justify-between text-[6px] text-zinc-400">
              <span>INV-042</span>
              <span>14:35</span>
            </div>
            <div className="flex justify-between text-[6px]">
              <span className="font-medium text-zinc-800">2&times; شاورما عربي</span>
              <span className="font-mono">220.00</span>
            </div>
            <div className="border-b-2 border-zinc-900 pt-0.5 my-0.5" />
            <div className="flex justify-between font-black text-zinc-950 text-[8px]">
              <span>المطلوب</span>
              <span>456.00</span>
            </div>
          </div>
        )}

        {meta.id === 'compact_pos' && (
          <div className="w-24 text-[6px] text-center font-mono text-zinc-700 leading-tight space-y-0.5">
            <div className="font-black">مطعم نسق</div>
            <div className="border-b border-dotted border-zinc-400" />
            <div className="flex justify-between text-[5px]">
              <span>#042 | صالة</span>
              <span>14:35</span>
            </div>
            <div className="flex justify-between text-[6px]">
              <span>2x شاورما</span>
              <span>220.00</span>
            </div>
            <div className="border-t border-black font-bold flex justify-between text-[7px]">
              <span>إجمالي</span>
              <span>456.00</span>
            </div>
          </div>
        )}

        {meta.id === 'bold_restaurant' && (
          <div className="w-32 text-[7px] text-center font-mono text-zinc-800 space-y-1">
            <div className="bg-black text-white text-[7px] font-black py-0.5 px-1 rounded-sm">
              مطعم نسق
            </div>
            <div className="h-0.5 bg-black my-0.5" />
            <div className="flex justify-between text-[6px]">
              <span className="bg-zinc-800 text-white px-1 text-[5px]">صالة</span>
              <span className="font-bold">ORD-089</span>
            </div>
            <div className="border-2 border-black p-0.5 font-black flex justify-between text-[7px]">
              <span>الإجمالي:</span>
              <span>456.00 ج.م</span>
            </div>
          </div>
        )}

        {meta.id === 'elegant' && (
          <div className="w-32 text-[7px] text-center font-serif text-zinc-800 space-y-0.5">
            <div className="text-[6px] text-zinc-400">❖ ❖ ❖</div>
            <div className="font-bold text-zinc-900">مطعم نسق للمأكولات</div>
            <div className="border-b-2 border-double border-zinc-400 my-0.5" />
            <div className="flex justify-between text-[6px] font-sans">
              <span>شاورما عربي سوبر</span>
              <span className="font-mono">220.00</span>
            </div>
            <div className="border-t-2 border-double border-zinc-700 pt-0.5 mt-0.5 flex justify-between font-bold text-[7px]">
              <span>صافي الحساب</span>
              <span>456.00</span>
            </div>
          </div>
        )}
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap gap-1 mt-1">
        {meta.features.map((feature, idx) => (
          <span
            key={idx}
            className="text-[10px] text-[#475569] bg-white border border-[#E2E8F0] px-1.5 py-0.5 rounded"
          >
            {feature}
          </span>
        ))}
      </div>
    </button>
  );
};
