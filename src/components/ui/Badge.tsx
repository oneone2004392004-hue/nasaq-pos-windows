import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded whitespace-nowrap border';

  const sizeStyles = {
    sm: 'text-[11px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variantStyles = {
    neutral: 'bg-[#EEF3F9] text-[#52657D] border-[#D8E3F0]',
    accent: 'bg-[#E6F0FF] text-[#0F4595] border-[#B7CAD4]',
    success: 'bg-[#F0FDF4] text-[#246345] border-[#BBF7D0]',
    warning: 'bg-[#FFFBEB] text-[#9A5B15] border-[#FDE68A]',
    danger: 'bg-[#FDF2F2] text-[#9C2825] border-[#F8B4B4]',
  };

  return (
    <span className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)} {...props}>
      {children}
    </span>
  );
};
