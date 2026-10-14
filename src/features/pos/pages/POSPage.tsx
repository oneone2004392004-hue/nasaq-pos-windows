import React from 'react';
import { usePOSPageController } from '../hooks/usePOSPageController';
import { POSCatalogPanel } from '../components/POSCatalogPanel';
import { POSCartPanel } from '../components/POSCartPanel';
import { POSPageDialogs } from '../components/POSPageDialogs';

export const POSPage: React.FC = () => {
  const controller = usePOSPageController();
  return (
    <div className="flex flex-col lg:flex-row flex-1 h-full overflow-hidden bg-[#F4F8FD]">
      <POSCatalogPanel controller={controller} />
      <POSCartPanel controller={controller} />
      <POSPageDialogs controller={controller} />
    </div>
  );
};
