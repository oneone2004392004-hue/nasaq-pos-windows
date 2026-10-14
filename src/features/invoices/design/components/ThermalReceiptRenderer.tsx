import React from 'react';
import { InvoiceDesignConfig, InvoiceReceiptData, ThermalPaperWidth } from '../types';
import { ClassicTemplate } from '../templates/ClassicTemplate';
import { ModernMinimalTemplate } from '../templates/ModernMinimalTemplate';
import { CompactPosTemplate } from '../templates/CompactPosTemplate';
import { BoldRestaurantTemplate } from '../templates/BoldRestaurantTemplate';
import { ElegantTemplate } from '../templates/ElegantTemplate';

interface ThermalReceiptRendererProps {
  data: InvoiceReceiptData;
  config: InvoiceDesignConfig;
  paperWidthOverride?: ThermalPaperWidth;
  className?: string;
  showTearEdges?: boolean;
}

export const ThermalReceiptRenderer: React.FC<ThermalReceiptRendererProps> = ({
  data,
  config,
  paperWidthOverride,
  className = '',
  showTearEdges = true,
}) => {
  const activePaperWidth = paperWidthOverride || config.paperWidth || '80mm';
  const is58mm = activePaperWidth === '58mm';

  // Paper width classes
  const widthClasses = is58mm
    ? 'w-[270px] sm:w-[285px] max-w-[285px]'
    : 'w-[340px] sm:w-[380px] max-w-[380px]';

  const renderTemplate = () => {
    const templateId = config.templateId || 'classic';
    switch (templateId) {
      case 'modern_minimal':
        return <ModernMinimalTemplate data={data} config={config} isCompactPaper={is58mm} />;
      case 'compact_pos':
        return <CompactPosTemplate data={data} config={config} isCompactPaper={is58mm} />;
      case 'bold_restaurant':
        return <BoldRestaurantTemplate data={data} config={config} isCompactPaper={is58mm} />;
      case 'elegant':
        return <ElegantTemplate data={data} config={config} isCompactPaper={is58mm} />;
      case 'classic':
      default:
        return <ClassicTemplate data={data} config={config} isCompactPaper={is58mm} />;
    }
  };

  return (
    <div className={`relative mx-auto transition-all duration-200 ${widthClasses} ${className}`}>
      {/* Top Perforated Receipt Tear Edge */}
      {showTearEdges && (
        <div
          className="w-full h-2.5 bg-white relative overflow-hidden"
          style={{
            clipPath:
              'polygon(0% 100%, 2% 0%, 4% 100%, 6% 0%, 8% 100%, 10% 0%, 12% 100%, 14% 0%, 16% 100%, 18% 0%, 20% 100%, 22% 0%, 24% 100%, 26% 0%, 28% 100%, 30% 0%, 32% 100%, 34% 0%, 36% 100%, 38% 0%, 40% 100%, 42% 0%, 44% 100%, 46% 0%, 48% 100%, 50% 0%, 52% 100%, 54% 0%, 56% 100%, 58% 0%, 60% 100%, 62% 0%, 64% 100%, 66% 0%, 68% 100%, 70% 0%, 72% 100%, 74% 0%, 76% 100%, 78% 0%, 80% 100%, 82% 0%, 84% 100%, 86% 0%, 88% 100%, 90% 0%, 92% 100%, 94% 0%, 96% 100%, 98% 0%, 100% 100%)',
            boxShadow: '0 -2px 4px rgba(0,0,0,0.04)',
          }}
        />
      )}

      {/* Main Thermal Paper Sheet */}
      <div
        id="thermal-receipt-paper"
        className="bg-white text-black shadow-lg border-x border-zinc-200/80 transition-all duration-200"
        style={{
          minHeight: '280px',
        }}
      >
        {renderTemplate()}
      </div>

      {/* Bottom Perforated Receipt Tear Edge */}
      {showTearEdges && (
        <div
          className="w-full h-2.5 bg-white relative overflow-hidden"
          style={{
            clipPath:
              'polygon(0% 0%, 2% 100%, 4% 0%, 6% 100%, 8% 0%, 10% 100%, 12% 0%, 14% 100%, 16% 0%, 18% 100%, 20% 0%, 22% 100%, 24% 0%, 26% 100%, 28% 0%, 30% 100%, 32% 0%, 34% 100%, 36% 0%, 38% 100%, 40% 0%, 42% 100%, 44% 0%, 46% 100%, 48% 0%, 50% 100%, 52% 0%, 54% 100%, 56% 0%, 58% 100%, 60% 0%, 62% 100%, 64% 0%, 66% 100%, 68% 0%, 70% 100%, 72% 0%, 74% 100%, 76% 0%, 78% 100%, 80% 0%, 82% 100%, 84% 0%, 86% 100%, 88% 0%, 90% 100%, 92% 0%, 94% 100%, 96% 0%, 98% 100%, 100% 0%)',
            boxShadow: '0 3px 6px rgba(0,0,0,0.08)',
          }}
        />
      )}
    </div>
  );
};
