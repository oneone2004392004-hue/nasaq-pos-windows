import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShoppingBag, ClipboardList, Receipt, Package, FolderTree, Users, Bike, UtensilsCrossed, Clock, Wallet, DollarSign, Boxes, BarChart3, ShieldCheck, Settings, HardDrive } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../features/auth/context/AuthContext';

export interface RightSidebarProps { collapsed: boolean; }
interface NavItemConfig { id: string; title: string; path: string; icon: React.ComponentType<{ size?: number; className?: string }>; badge?: string | number; requiredPermissions: string[]; }
interface NavSectionConfig { id: string; title: string; items: NavItemConfig[]; }

const NAV_SECTIONS: NavSectionConfig[] = [
  { id: 'operations', title: 'التشغيل اليومي', items: [
    { id: 'pos', title: 'الكاشير والبيع', path: '/pos', icon: ShoppingBag, requiredPermissions: ['pos.view_menu', 'pos.create_order'] },
    { id: 'orders', title: 'الطلبات', path: '/orders', icon: ClipboardList, requiredPermissions: ['orders.view'] },
    { id: 'invoices', title: 'الفواتير', path: '/invoices', icon: Receipt, requiredPermissions: ['orders.view', 'pos.reprint_receipt'] },
    { id: 'products', title: 'الأصناف', path: '/products', icon: Package, requiredPermissions: ['products.view'] },
    { id: 'categories', title: 'التصنيفات', path: '/categories', icon: FolderTree, requiredPermissions: ['categories.manage'] },
    { id: 'customers', title: 'العملاء', path: '/customers', icon: Users, requiredPermissions: ['customers.view'] },
    { id: 'delivery', title: 'الدليفري', path: '/delivery', icon: Bike, requiredPermissions: ['orders.view'] },
    { id: 'tables', title: 'الترابيزات', path: '/tables', icon: UtensilsCrossed, requiredPermissions: ['pos.create_order'] },
  ]},
  { id: 'finance_inventory', title: 'المالية والمخزون', items: [
    { id: 'shifts', title: 'الورديات', path: '/shifts', icon: Clock, requiredPermissions: ['shifts.open', 'shifts.view_all'] },
    { id: 'cash-register', title: 'الخزينة', path: '/cash-register', icon: Wallet, requiredPermissions: ['cash.view_balance'] },
    { id: 'expenses', title: 'المصروفات', path: '/expenses', icon: DollarSign, requiredPermissions: ['expenses.view'] },
    { id: 'inventory', title: 'المخزون', path: '/inventory', icon: Boxes, requiredPermissions: ['inventory.view'] },
  ]},
  { id: 'system', title: 'الإدارة والنظام', items: [
    { id: 'reports', title: 'التقارير', path: '/reports', icon: BarChart3, requiredPermissions: ['reports.sales', 'reports.shifts', 'reports.financial'] },
    { id: 'users', title: 'المستخدمين', path: '/users', icon: ShieldCheck, requiredPermissions: ['users.manage'] },
    { id: 'settings', title: 'الإعدادات', path: '/settings', icon: Settings, requiredPermissions: ['settings.view'] },
    { id: 'backup', title: 'النسخ الاحتياطي', path: '/backup', icon: HardDrive, requiredPermissions: ['system.backup'] },
  ]},
];

export const RightSidebar: React.FC<RightSidebarProps> = ({ collapsed }) => {
  const { hasAnyPermission } = useAuth();
  const filteredSections = NAV_SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => hasAnyPermission(...item.requiredPermissions)) })).filter((section) => section.items.length > 0);

  return (
    <aside className={cn('bg-white border-l border-[#D7E4F2] flex flex-col shrink-0 select-none transition-all duration-200 z-10 shadow-[0_0_24px_rgba(13,45,82,0.045)]', collapsed ? 'w-[72px]' : 'w-[258px]')}>
      <div className="px-3 pt-4 pb-3 border-b border-[#EEF3F9]">
        {!collapsed ? <div className="px-2"><p className="text-[10px] font-bold tracking-[.16em] text-[#8B9BB0] uppercase">لوحة التحكم</p><p className="text-xs text-[#526A84] mt-1">كل ما تحتاجه لإدارة مبيعاتك</p></div> : <div className="h-3" />}
      </div>
      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-5">
        {filteredSections.map((section) => (
          <div key={section.id} className="flex flex-col gap-2">
            {!collapsed ? <span className="text-[10px] font-black text-[#8B9BB0] px-2 tracking-wider">{section.title}</span> : <div className="w-full border-b border-[#EEF3F9]" title={section.title} />}
            <div className="flex flex-col gap-1">
              {section.items.map((item) => { const IconComponent = item.icon; return (
                <NavLink key={item.id} to={item.path} className={({ isActive }) => cn('flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-semibold transition-all relative group', isActive ? 'bg-[#E6F0FF] text-[#0F4595] shadow-[inset_-3px_0_0_#1464D9]' : 'text-[#526A84] hover:bg-[#F4F8FD] hover:text-[#0D2D52]')} title={collapsed ? item.title : undefined}>
                  {({ isActive }) => <><IconComponent size={18} className={cn('shrink-0 transition-colors', isActive ? 'text-[#1464D9]' : 'text-[#7D91A8] group-hover:text-[#1464D9]')} />{!collapsed && <span className="truncate flex-1 text-right">{item.title}</span>}{!collapsed && item.badge !== undefined && <span className="text-[10px] bg-[#EEF5FF] text-[#526A84] px-1.5 py-0.5 rounded-full font-mono">{item.badge}</span>}</>}
                </NavLink>
              ); })}
            </div>
          </div>
        ))}
      </div>
      {!collapsed && <div className="px-5 py-4 border-t border-[#EEF3F9]"><p className="text-[10px] text-[#9AAABC]">نسق POS v1.0</p><p className="text-[10px] text-[#B0BDCB] mt-1">بياناتك محلية وآمنة</p></div>}
    </aside>
  );
};
