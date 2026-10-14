import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('يرجى ملء جميع الحقول المطلوبة.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('يجب ألا تقل كلمة المرور الجديدة عن 6 خانات.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('تأكيد كلمة المرور الجديدة غير متطابق.');
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية.');
      return;
    }

    try {
      setIsSubmitting(true);
      await changePassword(currentPassword, newPassword, confirmPassword);
      setSuccessMessage('تم تغيير كلمة المرور بنجاح.');
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('حدث خطأ أثناء تغيير كلمة المرور.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="تغيير كلمة المرور"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-right" dir="rtl">
        {errorMessage && (
          <div
            id="change-pwd-error"
            className="flex items-start gap-2 p-2.5 rounded-md bg-[#FDF2F2] border border-[#F8D7DA] text-[#D9534F] text-xs leading-relaxed"
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            id="change-pwd-success"
            className="flex items-start gap-2 p-2.5 rounded-md bg-[#EDF7ED] border border-[#D4EDDA] text-[#2E7D32] text-xs leading-relaxed"
          >
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Current Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current-password" className="text-xs font-semibold text-[#31445D]">
            كلمة المرور الحالية
          </label>
          <div className="relative flex items-center w-full">
            <input
              id="current-password"
              type={showCurrentPassword ? 'text' : 'password'}
              disabled={isSubmitting}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="أدخل كلمة المرور الحالية"
              className="w-full bg-white text-[#132238] text-sm rounded-md border border-[#D8E3F0] px-3 py-2 pr-9 pl-9 outline-none transition-colors placeholder:text-[#999999] focus:border-[#1464D9] focus:ring-1 focus:ring-[#1464D9] disabled:bg-[#F5F8FC]"
            />
            <div className="absolute right-3 text-[#92A0B2] pointer-events-none flex items-center">
              <Lock size={16} />
            </div>
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              className="absolute left-3 text-[#8291A5] hover:text-[#333333] transition-colors p-0.5 cursor-pointer"
              title={showCurrentPassword ? 'إخفاء' : 'إظهار'}
            >
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-xs font-semibold text-[#31445D]">
            كلمة المرور الجديدة (6 خانات على الأقل)
          </label>
          <div className="relative flex items-center w-full">
            <input
              id="new-password"
              type={showNewPassword ? 'text' : 'password'}
              disabled={isSubmitting}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="أدخل كلمة المرور الجديدة"
              className="w-full bg-white text-[#132238] text-sm rounded-md border border-[#D8E3F0] px-3 py-2 pr-9 pl-9 outline-none transition-colors placeholder:text-[#999999] focus:border-[#1464D9] focus:ring-1 focus:ring-[#1464D9] disabled:bg-[#F5F8FC]"
            />
            <div className="absolute right-3 text-[#92A0B2] pointer-events-none flex items-center">
              <KeyRound size={16} />
            </div>
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute left-3 text-[#8291A5] hover:text-[#333333] transition-colors p-0.5 cursor-pointer"
              title={showNewPassword ? 'إخفاء' : 'إظهار'}
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-new-password" className="text-xs font-semibold text-[#31445D]">
            تأكيد كلمة المرور الجديدة
          </label>
          <div className="relative flex items-center w-full">
            <input
              id="confirm-new-password"
              type={showNewPassword ? 'text' : 'password'}
              disabled={isSubmitting}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="أعد إدخال كلمة المرور للتأكيد"
              className="w-full bg-white text-[#132238] text-sm rounded-md border border-[#D8E3F0] px-3 py-2 pr-9 outline-none transition-colors placeholder:text-[#999999] focus:border-[#1464D9] focus:ring-1 focus:ring-[#1464D9] disabled:bg-[#F5F8FC]"
            />
            <div className="absolute right-3 text-[#92A0B2] pointer-events-none flex items-center">
              <KeyRound size={16} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F0F4FA] mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            إلغاء
          </Button>
          <Button
            id="change-pwd-submit"
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
