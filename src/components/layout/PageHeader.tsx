import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[#E8EFF7] bg-white shrink-0 shadow-[0_2px_12px_rgba(13,45,82,0.035)]">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-8 rounded-full bg-[#1464D9] shadow-[0_4px_10px_rgba(20,100,217,0.24)]" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-[#0D2D52] truncate">{title}</h1>
            {subtitle && <span className="sr-only">{subtitle}</span>}
          </div>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};
