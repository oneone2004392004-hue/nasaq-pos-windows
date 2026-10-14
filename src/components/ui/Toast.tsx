import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { generateId } from '../../utils/id';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = generateId('toast');
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        removeToast(id);
      }, 3500);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => {
          const typeStyles = {
            success: 'bg-[#F0FDF4] text-[#1E4620] border-[#BBF7D0]',
            error: 'bg-[#FDF2F2] text-[#7A1D1A] border-[#F8B4B4]',
            info: 'bg-[#FFFFFF] text-[#132238] border-[#D8E3F0] shadow-sm',
          };

          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-md border text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-150',
                typeStyles[toast.type]
              )}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'success' && <CheckCircle2 size={16} className="text-[#3C8D67]" />}
                {toast.type === 'error' && <AlertCircle size={16} className="text-[#D9534F]" />}
                {toast.type === 'info' && <Info size={16} className="text-[#1464D9]" />}
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-current opacity-60 hover:opacity-100 p-0.5 rounded cursor-pointer"
                aria-label="إغلاق التنبيه"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
