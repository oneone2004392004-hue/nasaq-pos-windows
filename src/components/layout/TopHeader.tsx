import React, { useState, useRef, useEffect } from 'react';
import { PanelRightClose, PanelRightOpen, User as UserIcon, Lock, CircleDot, LogOut, KeyRound, ChevronDown, Wifi } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../features/auth/context/AuthContext';
import { ChangePasswordModal } from '../../features/auth/components/ChangePasswordModal';

export interface TopHeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  shiftNumber?: string | number;
  isShiftOpen?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ sidebarCollapsed, onToggleSidebar, shiftNumber = '102', isShiftOpen = true }) => {
  const { user, lock, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    try { await logout(); } catch (err) { console.error('Logout error:', err); }
  };

  return (
    <>
      <header className="h-[68px] bg-white border-b border-[#E5EDF6] px-4 lg:px-6 flex items-center justify-between select-none z-20 shrink-0 shadow-[0_2px_14px_rgba(13,45,82,0.045)]" dir="rtl">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onToggleSidebar} className="p-2.5 rounded-xl text-[#526A84] hover:text-[#0D2D52] hover:bg-[#EEF5FF] transition-colors cursor-pointer" title={sidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}>
            {sidebarCollapsed ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          </button>
          <div className="flex items-center gap-2.5 pr-1">
            <img src="/nasaq-logo.png" alt="نسق" className="w-10 h-10 rounded-[13px] object-cover shadow-[0_6px_16px_rgba(20,100,217,.18)]" />
            <div className="flex flex-col leading-none">
              <span className="font-black text-[17px] tracking-tight text-[#0D2D52]">نسق <span className="text-[#1464D9] text-sm">POS</span></span>
              <span className="text-[10px] text-[#8B9BB0] mt-1">نظام التشغيل الذكي</span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 mr-2 text-[10px] px-2.5 py-1 rounded-full bg-[#EAF3FF] text-[#1464D9] font-bold border border-[#C9DCF3]"><Wifi size={11} /> محلي وآمن</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${isShiftOpen ? 'bg-[#ECFBF4] border-[#B9EAD5] text-[#11724F]' : 'bg-[#FFF8EB] border-[#F5D79E] text-[#A76014]'}`}>
            <CircleDot size={13} className={isShiftOpen ? 'text-[#15966A] animate-pulse' : 'text-[#C9771E]'} />
            <span>{isShiftOpen ? `وردية مفتوحة #${shiftNumber}` : 'لا توجد وردية مفتوحة'}</span>
          </div>

          <div className="relative" ref={menuRef}>
            <button id="user-profile-menu-button" type="button" onClick={() => setIsMenuOpen((prev) => !prev)} className="flex items-center gap-2.5 pr-2.5 pl-1.5 py-1.5 rounded-xl hover:bg-[#F4F8FD] transition-colors border-r border-[#E8EFF7] cursor-pointer">
              <div className="w-9 h-9 rounded-xl bg-[#EAF3FF] border border-[#D4E4F5] flex items-center justify-center text-[#1464D9]"><UserIcon size={17} /></div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-[#12243D] leading-tight">{user?.name || 'مستخدم النظام'}</span>
                <span className="text-[10px] text-[#8291A5] leading-none mt-1">{user?.roleName || 'كاشير'}</span>
              </div>
              <ChevronDown size={14} className="text-[#92A0B2]" />
            </button>
            {isMenuOpen && (
              <div className="absolute left-0 mt-2 w-52 bg-white rounded-2xl border border-[#D7E4F2] shadow-[0_16px_35px_rgba(13,45,82,0.14)] py-2 z-30 flex flex-col text-xs text-[#31445D] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#EEF3F9] bg-[#F8FBFF]"><p className="font-bold text-[#12243D] truncate">{user?.name}</p><p className="text-[10px] text-[#8291A5] font-mono mt-1">@{user?.username}</p></div>
                <button type="button" onClick={() => { setIsMenuOpen(false); setIsPasswordModalOpen(true); }} className="flex items-center gap-2.5 px-4 py-3 text-right hover:bg-[#F4F8FD] transition-colors cursor-pointer"><KeyRound size={15} className="text-[#61748D]" /><span>تغيير كلمة المرور</span></button>
                <div className="mx-4 border-t border-[#EEF3F9]" />
                <button id="header-logout-button" type="button" onClick={handleLogout} className="flex items-center gap-2.5 px-4 py-3 text-right text-[#D9534F] hover:bg-[#FFF2F2] transition-colors cursor-pointer"><LogOut size={15} /><span>تسجيل الخروج</span></button>
              </div>
            )}
          </div>
          <Button id="header-lock-button" variant="ghost" size="sm" onClick={() => lock()} className="text-[#61748D] hover:text-[#0D2D52] hover:bg-[#EEF5FF] text-xs gap-1.5 rounded-xl" title="قفل النظام (Lock)"><Lock size={15} /><span className="hidden sm:inline">قفل</span></Button>
        </div>
      </header>
      <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
    </>
  );
};
