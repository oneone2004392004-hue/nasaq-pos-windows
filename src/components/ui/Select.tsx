import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-right">
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-[#31445D]">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            'w-full bg-white text-[#132238] text-sm rounded-md border border-[#D8E3F0] px-3 py-2 outline-none transition-colors focus:border-[#1464D9] focus:ring-1 focus:ring-[#1464D9] disabled:bg-[#F5F8FC] cursor-pointer',
            error ? 'border-[#D9534F] focus:border-[#D9534F]' : '',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-[#D9534F]">{error}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
