import { errorMessage } from '../../../utils/errors';
/**
 * NASAQ POS — Barcode Scanner Hardware Service (Phase 12B)
 *
 * Provides fast, reliable barcode scanning and lookup:
 * 1. Cleans barcode input (strips carriage returns, line feeds, whitespace).
 * 2. Resolves product safely through ProductRepository (no raw queries from UI).
 * 3. Enforces business rules:
 *    - Unknown barcode -> clear Arabic error message.
 *    - Inactive product -> clear Arabic warning.
 *    - Never creates products automatically.
 */

import { IProductRepository, ProductRepository } from '../../../repositories/ProductRepository';
import { ProductRow } from '../../../domain/dbModels';
import { BarcodeScanResult } from '../types';

export class BarcodeService {
  private productRepo: IProductRepository;

  constructor(productRepo?: IProductRepository) {
    this.productRepo = productRepo || new ProductRepository();
  }

  /**
   * Sanitizes raw barcode string emitted by hardware laser/CCD scanners.
   * Strips prefix/suffix characters such as Enter (\r, \n), tabs, and surrounding whitespace.
   */
  public sanitizeBarcode(rawInput: string): string {
    if (!rawInput) return '';
    return rawInput.replace(/[\r\n\t]/g, '').trim();
  }

  /**
   * Processes a barcode scan event and returns the resolved product or descriptive error.
   */
  public async scan(rawBarcode: string): Promise<BarcodeScanResult> {
    const cleaned = this.sanitizeBarcode(rawBarcode);

    if (!cleaned) {
      return {
        barcode: '',
        found: false,
        error: 'الباركود المدخل فارغ',
      };
    }

    try {
      const product = await this.productRepo.findByBarcode(cleaned);

      if (!product) {
        return {
          barcode: cleaned,
          found: false,
          error: `الباركود غير مسجل في النظام: ${cleaned}`,
        };
      }

      if (product.is_active === 0) {
        return {
          barcode: cleaned,
          found: false,
          product,
          error: `الصنف (${product.name}) معطل وغير متاح للبيع حالياً`,
        };
      }

      return {
        barcode: cleaned,
        found: true,
        product,
      };
    } catch (err: unknown) {
      return {
        barcode: cleaned,
        found: false,
        error: errorMessage(err, 'حدث خطأ أثناء البحث عن الباركود'),
      };
    }
  }

  /**
   * Direct product lookup by barcode.
   */
  public async lookup(barcode: string): Promise<ProductRow | null> {
    const cleaned = this.sanitizeBarcode(barcode);
    if (!cleaned) return null;
    return await this.productRepo.findByBarcode(cleaned);
  }
}
