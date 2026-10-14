import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LockScreen } from './LockScreen';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
}) => {
  const { isAuthenticated, isLocked, isLoading, needsSetup, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F5F8FC] select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#1464D9] border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-[#52657D]">جاري تحميل النظام...</span>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If locked, render LockScreen overlay blocking all view
  if (isLocked) {
    return <LockScreen />;
  }

  // Check required permission for this specific route
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <div className="w-12 h-12 rounded-full bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] flex items-center justify-center mb-3">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-base font-bold text-[#132238] mb-1">غير مصرح بالوصول</h2>
        <p className="text-xs text-[#61748D] max-w-sm mb-4 leading-relaxed">
          ليس لديك الصلاحيات الكافية للوصول إلى هذه الشاشة. إذا كنت تعتقد أن هذا خطأ، يرجى مراجعة مدير النظام.
        </p>
        <span className="text-[11px] font-mono text-[#92A0B2] bg-[#EEF3F9] px-2 py-0.5 rounded border border-[#D8E3F0] mb-4">
          صلاحية مطلوبة: {requiredPermission}
        </span>
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          العودة للخلف
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
