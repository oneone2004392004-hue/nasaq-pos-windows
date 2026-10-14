import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../../../components/ui/Button';

export const LockScreen: React.FC = () => {
  const { user, unlock, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password) {
      setErrorMessage('يرجى إدخال كلمة المرور لفك القفل.');
      return;
    }

    try {
      setIsSubmitting(true);
      await unlock(password);
      setPassword('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('كلمة المرور غير صحيحة.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchUser = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div
      id="app-lock-screen"
      className="fixed inset-0 z-50 bg-[#F5F8FC] flex flex-col items-center justify-center p-4 select-none font-sans text-right"
      dir="rtl"
    >
      <div className="w-full max-w-sm bg-white rounded-lg border border-[#D8E3F0] shadow-md p-6 sm:p-8 flex flex-col gap-6">
        
        {/* Lock Header */}
        <div className="flex flex-col items-center text-center gap-2 pb-4 border-b border-[#E8EEF6]">
          <div className="w-12 h-12 rounded-full bg-[#F4F4F2] border border-[#D8E3F0] text-[#333333] flex items-center justify-center mb-1">
            <Lock size={22} className="text-[#0D4EAE]" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-[#92A0B2] font-medium">النظام في وضع القفل</span>
            <h2 className="text-lg font-bold text-[#132238] mt-0.5">{user?.name || 'المستخدم'}</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[11px] px-2 py-0.5 rounded bg-[#EAF3FF] text-[#0D4EAE] font-medium border border-[#C9DCF3]">
                {user?.roleName || 'كاشير'}
              </span>
              <span className="text-xs text-[#92A0B2] font-mono">@{user?.username}</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            id="lock-error-alert"
            className="flex items-start gap-2.5 p-3 rounded-md bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] text-xs leading-relaxed"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 text-right">
            <label htmlFor="unlock-password" className="text-xs font-semibold text-[#31445D]">
              أدخل كلمة المرور للمتابعة
            </label>
            <div className="relative flex items-center w-full">
              <input
                id="unlock-password"
                type={showPassword ? 'text' : 'password'}
                autoFocus
                disabled={isSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="w-full bg-white text-[#132238] text-sm rounded-md border border-[#D8E3F0] px-3 py-2 pr-9 pl-9 outline-none transition-colors placeholder:text-[#999999] focus:border-[#1464D9] focus:ring-1 focus:ring-[#1464D9] disabled:bg-[#F5F8FC]"
              />
              <div className="absolute right-3 text-[#92A0B2] pointer-events-none flex items-center">
                <Lock size={16} />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute left-3 text-[#8291A5] hover:text-[#333333] transition-colors p-0.5 cursor-pointer"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button
            id="unlock-submit-button"
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            className="w-full mt-1 font-medium justify-center"
          >
            {isSubmitting ? 'جاري الفتح...' : 'إلغاء القفل واستئناف العمل'}
          </Button>
        </form>

        {/* Switch User Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E8EEF6]">
          <span className="text-xs text-[#92A0B2]">مستخدم آخر؟</span>
          <button
            type="button"
            onClick={handleSwitchUser}
            className="flex items-center gap-1.5 text-xs text-[#61748D] hover:text-[#D9534F] transition-colors cursor-pointer py-1 px-2 rounded hover:bg-[#FAF0F0]"
          >
            <LogOut size={14} />
            <span>تسجيل الخروج والتبديل</span>
          </button>
        </div>
      </div>
    </div>
  );
};
