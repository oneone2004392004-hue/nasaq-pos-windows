import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, Lock, RefreshCw, ShieldCheck, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../../../components/ui/Button';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    isAuthenticated,
    needsSetup,
    isLocked,
    databaseError,
    resetPasswordWithActivation,
  } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    if (needsSetup) void navigate('/setup', { replace: true });
    else if (isAuthenticated && !isLocked) {
      void navigate((location.state as { from?: { pathname: string } })?.from?.pathname || '/pos', { replace: true });
    }
  }, [isAuthenticated, isLocked, needsSetup, navigate, location]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (databaseError) return;
    if (!username.trim() || !password) {
      setErrorMessage('أدخل اسم المستخدم وكلمة المرور.');
      return;
    }
    try {
      setIsSubmitting(true);
      await login({ username, password });
      void navigate((location.state as { from?: { pathname: string } })?.from?.pathname || '/pos', { replace: true });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetMessage(null);
    try {
      setResetSubmitting(true);
      await resetPasswordWithActivation(username, resetPassword, resetConfirm);
      setResetMessage('تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.');
      setPassword('');
      setResetPassword('');
      setResetConfirm('');
    } catch (err: unknown) {
      setResetMessage(err instanceof Error ? err.message : 'تعذر استعادة كلمة المرور.');
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="auth-shell min-h-screen w-full flex items-center justify-center p-4 sm:p-8 font-sans" dir="rtl">
      <main className="w-full max-w-md bg-white rounded-[28px] border border-white/80 shadow-[0_24px_70px_rgba(13,45,82,.16)] overflow-hidden">
        <header className="flex items-center justify-between px-6 py-5 bg-[#0D2D52] text-white">
          <div className="flex items-center gap-3">
            <img src="/nasaq-logo.png" alt="نسق" className="w-11 h-11 rounded-2xl bg-white" />
            <div><p className="font-black text-lg">نسق POS</p><p className="text-[11px] text-white/60">نقاط البيع</p></div>
          </div>
          <ShieldCheck size={22} className="text-[#66B5FF]" />
        </header>

        <section className="p-6 sm:p-9">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-[#0D2D52]">تسجيل الدخول</h1>
            <p className="text-xs text-[#8291A5] mt-2">أدخل بياناتك للمتابعة</p>
          </div>

          {(databaseError || errorMessage) && (
            <div className="flex items-start gap-2.5 mb-5 p-3.5 rounded-2xl bg-[#FFF2F2] border border-[#F6C5C4] text-[#B33B37] text-xs leading-relaxed">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{databaseError ? 'قاعدة البيانات المحلية لم تبدأ.' : errorMessage}</span>
            </div>
          )}

          {databaseError ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-[#66758A] leading-6">أغلق البرنامج وافتحه مرة أخرى. إذا استمرت المشكلة استخدم نسخة التثبيت الأخيرة.</p>
              <Button type="button" variant="primary" onClick={() => window.location.reload()} className="w-full justify-center gap-2"><RefreshCw size={16} /> إعادة المحاولة</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <label className="flex flex-col gap-2"><span className="text-xs font-bold text-[#31445D]">اسم المستخدم</span><div className="relative flex items-center"><input id="login-username" type="text" autoComplete="username" autoFocus disabled={isSubmitting} value={username} onChange={(e) => setUsername(e.target.value)} className="w-full h-12 bg-white text-[#132238] text-sm rounded-2xl border border-[#D7E4F2] px-4 pr-11 outline-none focus:border-[#1464D9] focus:ring-4 focus:ring-[#1464D9]/10" /><User size={17} className="absolute right-4 text-[#8B9BB0] pointer-events-none" /></div></label>
              <label className="flex flex-col gap-2"><span className="text-xs font-bold text-[#31445D]">كلمة المرور</span><div className="relative flex items-center"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" disabled={isSubmitting} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-12 bg-white text-[#132238] text-sm rounded-2xl border border-[#D7E4F2] px-4 pr-11 pl-11 outline-none focus:border-[#1464D9] focus:ring-4 focus:ring-[#1464D9]/10" /><Lock size={17} className="absolute right-4 text-[#8B9BB0] pointer-events-none" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-4 text-[#8291A5] p-1" aria-label="إظهار كلمة المرور">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
              <Button id="login-submit-button" type="submit" variant="primary" size="md" disabled={isSubmitting} className="w-full h-12 mt-1 font-bold justify-center rounded-2xl">{isSubmitting ? 'جارٍ التحقق...' : <span className="flex items-center justify-center gap-2">دخول <ArrowLeft size={16} /></span>}</Button>
              <button type="button" onClick={() => { setResetMessage(null); setShowReset(true); }} className="text-xs font-bold text-[#1464D9] hover:underline flex items-center justify-center gap-2"><KeyRound size={14} /> نسيت كلمة المرور؟</button>
            </form>
          )}
        </section>
      </main>

      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A31]/55" role="dialog" aria-modal="true" dir="rtl">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5"><div><h2 className="text-lg font-black text-[#0D2D52]">استعادة كلمة المرور</h2><p className="text-xs text-[#8291A5] mt-1">يتطلب تفعيل الجهاز</p></div><button type="button" onClick={() => setShowReset(false)} className="p-2 text-[#8291A5]" aria-label="إغلاق"><X size={18} /></button></div>
            {resetMessage && <div className="mb-4 p-3 rounded-2xl bg-[#EEF8F1] text-[#287A43] text-xs leading-5">{resetMessage}</div>}
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" className="h-11 rounded-xl border border-[#D7E4F2] px-4 text-sm outline-none focus:border-[#1464D9]" />
              <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="كلمة المرور الجديدة" className="h-11 rounded-xl border border-[#D7E4F2] px-4 text-sm outline-none focus:border-[#1464D9]" />
              <input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="تأكيد كلمة المرور الجديدة" className="h-11 rounded-xl border border-[#D7E4F2] px-4 text-sm outline-none focus:border-[#1464D9]" />
              <Button type="submit" variant="primary" disabled={resetSubmitting} className="w-full justify-center">{resetSubmitting ? 'جارٍ الحفظ...' : 'تغيير كلمة المرور'}</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
