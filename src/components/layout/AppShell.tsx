import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopHeader } from './TopHeader';
import { RightSidebar } from './RightSidebar';
import { useActiveShift } from '../../features/shifts/hooks/useActiveShift';

export const AppShell: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { activeShift } = useActiveShift();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden page-canvas text-[#12243D]" dir="rtl">
      <TopHeader
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        shiftNumber={activeShift?.shift_number}
        isShiftOpen={!!activeShift}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <RightSidebar collapsed={sidebarCollapsed} />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden page-canvas relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
