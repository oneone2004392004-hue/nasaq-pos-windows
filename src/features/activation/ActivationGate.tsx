import React, { useEffect, useState } from 'react';
import { ActivationPage } from './ActivationPage';
import { getActivationStatus } from './ActivationService';

export const ActivationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isActivated, setIsActivated] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    const status = await getActivationStatus();
    setIsActivated(status.active);
    setIsLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (isLoading) {
    return <div className="min-h-screen w-full flex items-center justify-center bg-[#F4F8FD]" dir="rtl"><div className="flex flex-col items-center gap-3"><div className="h-9 w-9 animate-spin rounded-full border-2 border-[#1464D9] border-t-transparent" /><span className="text-xs font-bold text-[#52657D]">جاري التحقق من التفعيل...</span></div></div>;
  }

  if (!isActivated) return <ActivationPage onActivated={() => void refresh()} />;
  return <>{children}</>;
};
