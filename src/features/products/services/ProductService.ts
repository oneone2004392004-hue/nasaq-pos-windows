import { IProductRepository, ProductRepository } from '../../../repositories/ProductRepository';
import { ICategoryRepository, CategoryRepository } from '../../../repositories/CategoryRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requirePermission } from '../../auth/utils/permissions';
import { ProductRow } from '../../../domain/dbModels';
import { ConflictError, NotFoundError, ValidationError } from '../../../database/errors';
import { generateId } from '../../../utils/id';
import {
  CreateProductDTO,
  UpdateProductDTO,
  validateProductCreate,
  validateProductUpdate,
} from '../validation';

export interface ProductListFilter {
  category_id?: string;
  is_active?: boolean;
  search?: string;
}

export class ProductService {
  private productRepo: IProductRepository;
  private categoryRepo: ICategoryRepository;
  private auditRepo: IAuditLogRepository;

  constructor(
    productRepo?: IProductRepository,
    categoryRepo?: ICategoryRepository,
    auditRepo?: IAuditLogRepository
  ) {
    this.productRepo = productRepo || new ProductRepository();
    this.categoryRepo = categoryRepo || new CategoryRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
  }

  /**
   * List products with flexible filtering
   */
  public async list(
    user?: AuthenticatedUser,
    filter?: ProductListFilter
  ): Promise<ProductRow[]> {
    if (user) {
      requirePermission(user, 'products.view', this.auditRepo);
    }
    return await this.productRepo.listWithFilter({
      categoryId: filter?.category_id,
      isActive: filter?.is_active,
      search: filter?.search,
    });
  }

  /**
   * Get active products only (for POS sales catalog)
   */
  public async getActiveProducts(categoryId?: string): Promise<ProductRow[]> {
    return await this.productRepo.listWithFilter({
      categoryId,
      isActive: true,
    });
  }

  /**
   * Get single product by ID
   */
  public async getById(id: string): Promise<ProductRow> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError('Product', id);
    }
    return product;
  }

  /**
   * Find product by Barcode
   */
  public async getByBarcode(barcode: string): Promise<ProductRow | null> {
    const clean = barcode.trim();
    if (!clean) return null;
    return await this.productRepo.findByBarcode(clean);
  }

  /**
   * Search products by name or barcode
   */
  public async search(term: string): Promise<ProductRow[]> {
    const clean = term.trim();
    if (!clean) return [];

    return await this.productRepo.searchByNameOrBarcode(clean);
  }

  /**
   * List products by category
   */
  public async getByCategory(categoryId: string, activeOnly: boolean = false): Promise<ProductRow[]> {
    return await this.productRepo.listByCategory(categoryId, activeOnly);
  }

  /**
   * Create a new product
   */
  public async create(user: AuthenticatedUser, data: CreateProductDTO): Promise<ProductRow> {
    requirePermission(user, 'products.create', this.auditRepo);

    const validated = validateProductCreate(data);

    // Verify category exists
    const category = await this.categoryRepo.findById(validated.category_id);
    if (!category) {
      throw new ValidationError('القسم المحدد غير موجود بقاعدة البيانات', {
        category_id: 'القسم المحدد غير موجود',
      });
    }

    // Verify barcode uniqueness if provided
    if (validated.barcode) {
      const existingWithBarcode = await this.productRepo.findByBarcode(validated.barcode);
      if (existingWithBarcode) {
        throw new ConflictError(`الباركود "${validated.barcode}" مسجل مسبقاً لصنف آخر (${existingWithBarcode.name})`);
      }
    }

    const now = new Date().toISOString();
    const newProduct: ProductRow = {
      id: generateId('prod'),
      category_id: validated.category_id,
      name: validated.name,
      price: validated.price,
      cost_price: validated.cost_price ?? 0,
      barcode: validated.barcode ?? null,
      track_stock: validated.track_stock ? 1 : 0,
      current_stock: validated.current_stock ?? 0,
      min_stock_alert: validated.min_stock_alert ?? 5,
      unit: validated.unit ?? 'piece',
      is_active: validated.is_active !== undefined ? (validated.is_active ? 1 : 0) : 1,
      created_at: now,
      updated_at: now,
    };

    const created = await this.productRepo.create(newProduct);

    await this.auditRepo.log(
      'PRODUCT_CREATED',
      'products',
      created.id,
      user.id,
      {
        name: created.name,
        category_id: created.category_id,
        price: created.price,
        barcode: created.barcode,
        is_active: created.is_active,
      }
    );

    return created;
  }

  /**
   * Update existing product
   */
  public async update(
    user: AuthenticatedUser,
    id: string,
    data: UpdateProductDTO
  ): Promise<ProductRow> {
    requirePermission(user, 'products.edit', this.auditRepo);

    const existing = await this.getById(id);
    const validated = validateProductUpdate(data);

    // If category changed, verify it exists
    if (validated.category_id && validated.category_id !== existing.category_id) {
      const category = await this.categoryRepo.findById(validated.category_id);
      if (!category) {
        throw new ValidationError('القسم المحدد غير موجود بقاعدة البيانات', {
          category_id: 'القسم المحدد غير موجود',
        });
      }
    }

    // If barcode changed, verify uniqueness
    if (validated.barcode && validated.barcode !== existing.barcode) {
      const existingWithBarcode = await this.productRepo.findByBarcode(validated.barcode);
      if (existingWithBarcode && existingWithBarcode.id !== id) {
        throw new ConflictError(`الباركود "${validated.barcode}" مسجل مسبقاً لصنف آخر (${existingWithBarcode.name})`);
      }
    }

    const updates: Partial<ProductRow> = {
      ...validated,
      updated_at: new Date().toISOString(),
    };

    const updated = await this.productRepo.update(id, updates);

    await this.auditRepo.log(
      'PRODUCT_UPDATED',
      'products',
      id,
      user.id,
      {
        old_values: {
          name: existing.name,
          category_id: existing.category_id,
          price: existing.price,
          barcode: existing.barcode,
          is_active: existing.is_active,
        },
        new_values: {
          name: updated.name,
          category_id: updated.category_id,
          price: updated.price,
          barcode: updated.barcode,
          is_active: updated.is_active,
        },
      }
    );

    return updated;
  }

  /**
   * Activate product
   */
  public async activate(user: AuthenticatedUser, id: string): Promise<ProductRow> {
    requirePermission(user, 'products.edit', this.auditRepo);

    const product = await this.getById(id);
    if (product.is_active === 1) {
      return product;
    }

    const updated = await this.productRepo.update(id, {
      is_active: 1,
      updated_at: new Date().toISOString(),
    });

    await this.auditRepo.log(
      'PRODUCT_ACTIVATED',
      'products',
      id,
      user.id,
      { name: product.name, is_active: 1 }
    );

    return updated;
  }

  /**
   * Deactivate product
   */
  public async deactivate(user: AuthenticatedUser, id: string): Promise<ProductRow> {
    requirePermission(user, 'products.delete', this.auditRepo);

    const product = await this.getById(id);
    if (product.is_active === 0) {
      return product;
    }

    const updated = await this.productRepo.update(id, {
      is_active: 0,
      updated_at: new Date().toISOString(),
    });

    await this.auditRepo.log(
      'PRODUCT_DEACTIVATED',
      'products',
      id,
      user.id,
      { name: product.name, is_active: 0 }
    );

    return updated;
  }
}
