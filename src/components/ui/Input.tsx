import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-right">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-[#31445D]">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {rightIcon && (
            <div className="absolute right-3 text-[#92A0B2] pointer-events-none flex items-center">
              {rightIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full bg-white text-[#132238] text-sm rounded-md border border-[#D8E3F0] px-3 py-2 outline-none transition-colors placeholder:text-[#999999] focus:border-[#1464D9] focus:ring-1 focus:ring-[#1464D9] disabled:bg-[#F5F8FC] disabled:text-[#92A0B2]',
              rightIcon ? 'pr-9' : 'pr-3',
              leftIcon ? 'pl-9' : 'pl-3',
              error ? 'border-[#D9534F] focus:border-[#D9534F] focus:ring-[#D9534F]' : '',
              className
            )}
            {...props}
          />
          {leftIcon && (
            <div className="absolute left-3 text-[#92A0B2] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-[#D9534F]">{error}</span>}
        {!error && helperText && <span className="text-xs text-[#92A0B2]">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
