import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clipboard, KeyRound, Smartphone, Sparkles } from 'lucide-react';
import { activateWithKey, formatExpiryDate, getActivationStatus } from './ActivationService';

interface ActivationPageProps {
  onActivated: () => void;
}

export const ActivationPage: React.FC<ActivationPageProps> = ({ onActivated }) => {
  const [deviceId, setDeviceId] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { void getActivationStatus().then((status) => setDeviceId(status.deviceId)); }, []);

  const copyDeviceId = async () => {
    await navigator.clipboard?.writeText(deviceId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    if (!activationKey.trim()) {
      setErrorMessage('أدخل مفتاح التفعيل أولاً.');
      return;
    }
    try {
      setIsSubmitting(true);
      const result = await activateWithKey(activationKey);
      if (!result.active) {
        setErrorMessage(result.reason || 'مفتاح التفعيل غير صالح.');
        return;
      }
      setStatusMessage(`تم تفعيل الجهاز حتى ${formatExpiryDate(result.expiryDate)}.`);
      window.setTimeout(onActivated, 450);
    } catch {
      setErrorMessage('تعذر التحقق من مفتاح التفعيل. حاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell min-h-screen w-full flex items-center justify-center p-4 sm:p-8" dir="rtl">
      <section className="w-full max-w-5xl grid lg:grid-cols-[.86fr_1.14fr] overflow-hidden rounded-[32px] border border-white/80 bg-white/75 shadow-[0_28px_80px_rgba(13,45,82,.16)] backdrop-blur-xl">
        <div className="relative hidden overflow-hidden bg-[#0D2D52] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#1464D9]/35 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-[#23A6A6]/25 blur-3xl" />
          <div className="relative">
            <div className="mb-8 flex items-center gap-3"><img src="/nasaq-logo.png" alt="نسق" className="h-10 w-10 rounded-[13px] object-cover" /><span className="text-sm font-black tracking-wide">نسق POS</span></div>
            <p className="mb-3 text-xs font-bold text-white/55">حماية التشغيل</p>
            <h1 className="text-4xl font-black leading-[1.25]">فعّل جهازك<br />وابدأ البيع بثقة.</h1>
            <p className="mt-5 max-w-xs text-sm leading-7 text-white/65">كل مفتاح مرتبط بجهاز محدد ومدة استخدام واضحة، لحماية بيانات التشغيل وتنظيم التراخيص.</p>
          </div>
          <div className="relative space-y-3 text-xs text-white/65"><p className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#7FE0C8]" /> تفعيل مرتبط بهذا الجهاز</p><p className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#7FE0C8]" /> تحقق محلي بتوقيع آمن</p></div>
        </div>
        <div className="p-6 sm:p-10 lg:p-14">
          <div className="mb-8 flex items-start gap-4"><img src="/nasaq-logo.png" alt="نسق" className="h-10 w-10 shrink-0 rounded-[13px] object-cover" /><div><p className="mb-1 text-[11px] font-bold tracking-[.16em] text-[#1464D9]">ACTIVATION CENTER</p><h2 className="text-2xl font-black text-[#0D2D52]">تفعيل برنامج نسق</h2><p className="mt-2 text-xs leading-6 text-[#61748D]">لن يفتح النظام قبل إدخال مفتاح صالح صادر لهذا الجهاز.</p></div></div>
          <div className="mb-6 rounded-2xl border border-[#CFE0F3] bg-[#F5F9FF] p-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#31445D]"><Smartphone size={15} className="text-[#1464D9]" /> Device ID الخاص بالجهاز</div><div className="flex gap-2"><code dir="ltr" className="min-w-0 flex-1 rounded-xl border border-[#D7E4F2] bg-white px-3 py-3 text-center text-sm font-black tracking-[.12em] text-[#0D2D52]">{deviceId || 'جاري الإنشاء...'}</code><button type="button" onClick={copyDeviceId} className="rounded-xl border border-[#D7E4F2] bg-white px-3 text-[#1464D9] transition hover:bg-[#EAF2FF]" title="نسخ Device ID"><Clipboard size={17} /></button></div>{copied && <p className="mt-2 text-center text-[11px] font-bold text-[#16856F]">تم نسخ Device ID</p>}<p className="mt-3 text-[11px] leading-5 text-[#71839A]">أرسل هذا الكود للإدارة لإنشاء مفتاح مرتبط بهذا الجهاز.</p></div>
          {errorMessage && <div className="mb-5 rounded-2xl border border-[#F4C8C6] bg-[#FFF4F3] p-3.5 text-xs font-semibold leading-6 text-[#B33B37]">{errorMessage}</div>}
          {statusMessage && <div className="mb-5 flex items-center gap-2 rounded-2xl border border-[#BCE8DC] bg-[#F0FCF8] p-3.5 text-xs font-semibold leading-6 text-[#137A68]"><Sparkles size={16} />{statusMessage}</div>}
          <form onSubmit={handleSubmit} className="space-y-4"><label className="flex flex-col gap-2"><span className="text-xs font-bold text-[#31445D]">مفتاح التفعيل</span><div className="relative"><KeyRound size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B9BB0]" /><textarea dir="ltr" rows={4} value={activationKey} onChange={(event) => setActivationKey(event.target.value)} placeholder="NQ2...." disabled={isSubmitting} className="w-full resize-none rounded-2xl border border-[#D7E4F2] bg-white px-11 py-3 text-left font-mono text-xs text-[#132238] outline-none transition focus:border-[#1464D9] focus:ring-4 focus:ring-[#1464D9]/10 disabled:bg-[#F5F8FC]" /></div></label><button type="submit" disabled={isSubmitting || !deviceId} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1464D9] text-sm font-black text-white shadow-[0_10px_22px_rgba(20,100,217,.22)] transition hover:bg-[#0F55BC] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'جاري التحقق...' : 'تفعيل الجهاز وفتح النظام'}</button></form>
          <div className="mt-8 border-t border-[#E8EFF7] pt-5 text-center text-[11px] leading-6 text-[#8291A5]">إذا انتهت مدة المفتاح، اطلب مفتاح تجديد جديد من الإدارة باستخدام نفس Device ID.</div>
        </div>
      </section>
    </main>
  );
};

export async function isActivationRequired(): Promise<boolean> {
  const status = await getActivationStatus();
  return !status.active;
}
