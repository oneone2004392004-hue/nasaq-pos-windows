import { SettingsRepository, ISettingsRepository } from '../../../../repositories/SettingsRepository';
import { AuditLogRepository, IAuditLogRepository } from '../../../../repositories/AuditLogRepository';
import { AuthenticatedUser } from '../../../auth/types';
import { requirePermission } from '../../../auth/utils/permissions';
import { ValidationError } from '../../../../database/errors';
import {
  InvoiceDesignConfig,
  InvoiceReceiptData,
  InvoiceTemplateId,
  ThermalPaperWidth,
} from '../types';
import {
  DEFAULT_INVOICE_DESIGN_CONFIG,
  SAMPLE_INVOICE_DATA,
} from '../constants';
import { mapInvoiceDetailsToReceiptData } from '../utils/receiptFormatter';
import { InvoiceDetailsDTO } from '../../types';

export const SETTINGS_KEY_INVOICE_DESIGN = 'invoice_design_config';

const VALID_TEMPLATES: InvoiceTemplateId[] = [
  'classic',
  'modern_minimal',
  'compact_pos',
  'bold_restaurant',
  'elegant',
];

const VALID_PAPER_WIDTHS: ThermalPaperWidth[] = ['80mm', '58mm'];

export class InvoiceDesignService {
  private settingsRepo: ISettingsRepository;
  private auditRepo: IAuditLogRepository;

  constructor(
    settingsRepo?: ISettingsRepository,
    auditRepo?: IAuditLogRepository
  ) {
    this.settingsRepo = settingsRepo || new SettingsRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
  }

  /**
   * Retrieves the current invoice design configuration.
   * If not configured or corrupted, falls back to defaults merged with store settings.
   */
  public async getConfig(): Promise<InvoiceDesignConfig> {
    try {
      const rawJson = await this.settingsRepo.get(SETTINGS_KEY_INVOICE_DESIGN);

      if (rawJson) {
        try {
          const parsed = JSON.parse(rawJson);
          if (parsed && typeof parsed === 'object') {
            return this.sanitizeAndMergeConfig(parsed);
          }
        } catch (parseErr) {
          console.warn('Failed to parse invoice_design_config JSON, falling back to defaults:', parseErr);
        }
      }

      // If not yet saved in DB, construct from standard settings or defaults
      const allSettings = await this.settingsRepo.getAllSettings();
      const initialConfig: InvoiceDesignConfig = {
        ...DEFAULT_INVOICE_DESIGN_CONFIG,
        storeName: allSettings.store_name || DEFAULT_INVOICE_DESIGN_CONFIG.storeName,
        storePhone: allSettings.store_phone || DEFAULT_INVOICE_DESIGN_CONFIG.storePhone,
        storeAddress: allSettings.store_address || DEFAULT_INVOICE_DESIGN_CONFIG.storeAddress,
        paperWidth: (allSettings.receipt_width === '58' ? '58mm' : '80mm'),
      };

      return initialConfig;
    } catch (err) {
      console.error('Error fetching invoice design config:', err);
      return { ...DEFAULT_INVOICE_DESIGN_CONFIG };
    }
  }

  /**
   * Updates invoice design settings.
   * Requires 'settings.edit' permission.
   * Maintains financial immutability — does NOT alter historical invoices or orders.
   */
  public async updateConfig(
    user: AuthenticatedUser,
    changes: Partial<InvoiceDesignConfig>
  ): Promise<InvoiceDesignConfig> {
    requirePermission(user, 'settings.edit', this.auditRepo);

    // Validate template ID if provided
    if (changes.templateId && !VALID_TEMPLATES.includes(changes.templateId)) {
      throw new ValidationError(
        `نمط الفاتورة المحدد "${changes.templateId}" غير صالح. الأنماط المتاحة: ${VALID_TEMPLATES.join(', ')}`
      );
    }

    // Validate paper width if provided
    if (changes.paperWidth && !VALID_PAPER_WIDTHS.includes(changes.paperWidth)) {
      throw new ValidationError(
        `عرض الورق المحدد "${changes.paperWidth}" غير مدعوم. الخيارات المتاحة: 80mm أو 58mm.`
      );
    }

    const currentConfig = await this.getConfig();

    const mergedConfig: InvoiceDesignConfig = this.sanitizeAndMergeConfig({
      ...currentConfig,
      ...changes,
    });

    // Save to settings repository
    await this.settingsRepo.set(
      SETTINGS_KEY_INVOICE_DESIGN,
      JSON.stringify(mergedConfig),
      'إعدادات وتخصيص تصميم الإيصال والفاتورة الحرارية'
    );

    // Sync basic store settings if modified
    if (changes.storeName && changes.storeName !== currentConfig.storeName) {
      await this.settingsRepo.set('store_name', changes.storeName);
    }
    if (changes.storePhone && changes.storePhone !== currentConfig.storePhone) {
      await this.settingsRepo.set('store_phone', changes.storePhone);
    }
    if (changes.storeAddress && changes.storeAddress !== currentConfig.storeAddress) {
      await this.settingsRepo.set('store_address', changes.storeAddress);
    }
    if (changes.paperWidth && changes.paperWidth !== currentConfig.paperWidth) {
      await this.settingsRepo.set('receipt_width', changes.paperWidth === '58mm' ? '58' : '80');
    }

    // Log template change audit if template changed
    if (changes.templateId && changes.templateId !== currentConfig.templateId) {
      await this.auditRepo.log(
        'INVOICE_TEMPLATE_CHANGED',
        'settings',
        SETTINGS_KEY_INVOICE_DESIGN,
        user.id,
        {
          previous_template: currentConfig.templateId,
          new_template: mergedConfig.templateId,
        }
      );
    }

    // Log general update
    await this.auditRepo.log(
      'INVOICE_SETTINGS_UPDATED',
      'settings',
      SETTINGS_KEY_INVOICE_DESIGN,
      user.id,
      {
        templateId: mergedConfig.templateId,
        paperWidth: mergedConfig.paperWidth,
      }
    );

    return mergedConfig;
  }

  /**
   * Resets configuration to system defaults.
   * Requires 'settings.edit' permission.
   */
  public async resetConfig(user: AuthenticatedUser): Promise<InvoiceDesignConfig> {
    requirePermission(user, 'settings.edit', this.auditRepo);

    // Fetch store settings to preserve restaurant identity if wanted
    const allSettings = await this.settingsRepo.getAllSettings();
    const freshDefault: InvoiceDesignConfig = {
      ...DEFAULT_INVOICE_DESIGN_CONFIG,
      storeName: allSettings.store_name || DEFAULT_INVOICE_DESIGN_CONFIG.storeName,
      storePhone: allSettings.store_phone || DEFAULT_INVOICE_DESIGN_CONFIG.storePhone,
      storeAddress: allSettings.store_address || DEFAULT_INVOICE_DESIGN_CONFIG.storeAddress,
    };

    await this.settingsRepo.set(
      SETTINGS_KEY_INVOICE_DESIGN,
      JSON.stringify(freshDefault),
      'إعدادات وتخصيص تصميم الإيصال والفاتورة الحرارية (استعادة الافتراضي)'
    );

    await this.auditRepo.log(
      'INVOICE_SETTINGS_RESET',
      'settings',
      SETTINGS_KEY_INVOICE_DESIGN,
      user.id,
      { action: 'reset_to_defaults' }
    );

    return freshDefault;
  }

  /**
   * Returns sample invoice receipt data for live preview.
   * This is in-memory only and never persisted as an actual order or invoice.
   */
  public getSampleInvoiceData(): InvoiceReceiptData {
    return JSON.parse(JSON.stringify(SAMPLE_INVOICE_DATA));
  }

  /**
   * Maps an actual invoice with details from the database into universal receipt data
   */
  public mapDetailsToReceipt(details: InvoiceDetailsDTO): InvoiceReceiptData {
    return mapInvoiceDetailsToReceiptData(details);
  }

  /**
   * Sanitizes input and merges with default keys to ensure complete object structure
   */
  private sanitizeAndMergeConfig(input: Partial<InvoiceDesignConfig>): InvoiceDesignConfig {
    const templateId = VALID_TEMPLATES.includes(input.templateId as InvoiceTemplateId)
      ? (input.templateId as InvoiceTemplateId)
      : DEFAULT_INVOICE_DESIGN_CONFIG.templateId;

    const paperWidth = VALID_PAPER_WIDTHS.includes(input.paperWidth as ThermalPaperWidth)
      ? (input.paperWidth as ThermalPaperWidth)
      : DEFAULT_INVOICE_DESIGN_CONFIG.paperWidth;

    return {
      version: 1,
      templateId,
      paperWidth,

      // Identity
      storeName: typeof input.storeName === 'string' ? input.storeName : DEFAULT_INVOICE_DESIGN_CONFIG.storeName,
      storeAddress: typeof input.storeAddress === 'string' ? input.storeAddress : DEFAULT_INVOICE_DESIGN_CONFIG.storeAddress,
      storePhone: typeof input.storePhone === 'string' ? input.storePhone : DEFAULT_INVOICE_DESIGN_CONFIG.storePhone,
      storePhone2: typeof input.storePhone2 === 'string' ? input.storePhone2 : DEFAULT_INVOICE_DESIGN_CONFIG.storePhone2,
      taxNumber: typeof input.taxNumber === 'string' ? input.taxNumber : DEFAULT_INVOICE_DESIGN_CONFIG.taxNumber,
      commercialReg: typeof input.commercialReg === 'string' ? input.commercialReg : DEFAULT_INVOICE_DESIGN_CONFIG.commercialReg,

      // Header Visibility
      showStoreName: input.showStoreName !== undefined ? Boolean(input.showStoreName) : DEFAULT_INVOICE_DESIGN_CONFIG.showStoreName,
      showAddress: input.showAddress !== undefined ? Boolean(input.showAddress) : DEFAULT_INVOICE_DESIGN_CONFIG.showAddress,
      showPhone: input.showPhone !== undefined ? Boolean(input.showPhone) : DEFAULT_INVOICE_DESIGN_CONFIG.showPhone,
      showPhone2: input.showPhone2 !== undefined ? Boolean(input.showPhone2) : DEFAULT_INVOICE_DESIGN_CONFIG.showPhone2,
      showTaxNumber: input.showTaxNumber !== undefined ? Boolean(input.showTaxNumber) : DEFAULT_INVOICE_DESIGN_CONFIG.showTaxNumber,
      showCommercialReg: input.showCommercialReg !== undefined ? Boolean(input.showCommercialReg) : DEFAULT_INVOICE_DESIGN_CONFIG.showCommercialReg,
      showInvoiceNumber: input.showInvoiceNumber !== undefined ? Boolean(input.showInvoiceNumber) : DEFAULT_INVOICE_DESIGN_CONFIG.showInvoiceNumber,
      showOrderNumber: input.showOrderNumber !== undefined ? Boolean(input.showOrderNumber) : DEFAULT_INVOICE_DESIGN_CONFIG.showOrderNumber,
      showDateTime: input.showDateTime !== undefined ? Boolean(input.showDateTime) : DEFAULT_INVOICE_DESIGN_CONFIG.showDateTime,
      showCashier: input.showCashier !== undefined ? Boolean(input.showCashier) : DEFAULT_INVOICE_DESIGN_CONFIG.showCashier,
      showOrderType: input.showOrderType !== undefined ? Boolean(input.showOrderType) : DEFAULT_INVOICE_DESIGN_CONFIG.showOrderType,

      // Order Details Visibility
      showTable: input.showTable !== undefined ? Boolean(input.showTable) : DEFAULT_INVOICE_DESIGN_CONFIG.showTable,
      showCustomerName: input.showCustomerName !== undefined ? Boolean(input.showCustomerName) : DEFAULT_INVOICE_DESIGN_CONFIG.showCustomerName,
      showCustomerPhone: input.showCustomerPhone !== undefined ? Boolean(input.showCustomerPhone) : DEFAULT_INVOICE_DESIGN_CONFIG.showCustomerPhone,
      showDeliveryAddress: input.showDeliveryAddress !== undefined ? Boolean(input.showDeliveryAddress) : DEFAULT_INVOICE_DESIGN_CONFIG.showDeliveryAddress,
      showDeliveryDriver: input.showDeliveryDriver !== undefined ? Boolean(input.showDeliveryDriver) : DEFAULT_INVOICE_DESIGN_CONFIG.showDeliveryDriver,

      // Items Visibility
      showItemQuantity: input.showItemQuantity !== undefined ? Boolean(input.showItemQuantity) : DEFAULT_INVOICE_DESIGN_CONFIG.showItemQuantity,
      showItemUnitPrice: input.showItemUnitPrice !== undefined ? Boolean(input.showItemUnitPrice) : DEFAULT_INVOICE_DESIGN_CONFIG.showItemUnitPrice,
      showItemTotal: input.showItemTotal !== undefined ? Boolean(input.showItemTotal) : DEFAULT_INVOICE_DESIGN_CONFIG.showItemTotal,
      showItemBarcode: input.showItemBarcode !== undefined ? Boolean(input.showItemBarcode) : DEFAULT_INVOICE_DESIGN_CONFIG.showItemBarcode,
      showItemNotes: input.showItemNotes !== undefined ? Boolean(input.showItemNotes) : DEFAULT_INVOICE_DESIGN_CONFIG.showItemNotes,

      // Totals Visibility (Note: Total is always visible)
      showSubtotal: input.showSubtotal !== undefined ? Boolean(input.showSubtotal) : DEFAULT_INVOICE_DESIGN_CONFIG.showSubtotal,
      showDiscount: input.showDiscount !== undefined ? Boolean(input.showDiscount) : DEFAULT_INVOICE_DESIGN_CONFIG.showDiscount,
      showTax: input.showTax !== undefined ? Boolean(input.showTax) : DEFAULT_INVOICE_DESIGN_CONFIG.showTax,
      showDeliveryFee: input.showDeliveryFee !== undefined ? Boolean(input.showDeliveryFee) : DEFAULT_INVOICE_DESIGN_CONFIG.showDeliveryFee,

      // Payment Visibility
      showPaymentMethod: input.showPaymentMethod !== undefined ? Boolean(input.showPaymentMethod) : DEFAULT_INVOICE_DESIGN_CONFIG.showPaymentMethod,
      showAmountReceived: input.showAmountReceived !== undefined ? Boolean(input.showAmountReceived) : DEFAULT_INVOICE_DESIGN_CONFIG.showAmountReceived,
      showChange: input.showChange !== undefined ? Boolean(input.showChange) : DEFAULT_INVOICE_DESIGN_CONFIG.showChange,

      // Footer
      showFooter: input.showFooter !== undefined ? Boolean(input.showFooter) : DEFAULT_INVOICE_DESIGN_CONFIG.showFooter,
      footerText: typeof input.footerText === 'string' ? input.footerText : DEFAULT_INVOICE_DESIGN_CONFIG.footerText,
      showFooter2: input.showFooter2 !== undefined ? Boolean(input.showFooter2) : DEFAULT_INVOICE_DESIGN_CONFIG.showFooter2,
      footerText2: typeof input.footerText2 === 'string' ? input.footerText2 : DEFAULT_INVOICE_DESIGN_CONFIG.footerText2,
    };
  }
}
