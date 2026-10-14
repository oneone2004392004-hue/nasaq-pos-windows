import { ICategoryRepository, CategoryRepository } from '../../../repositories/CategoryRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requirePermission } from '../../auth/utils/permissions';
import { CategoryRow } from '../../../domain/dbModels';
import { ConflictError, ConstraintError, NotFoundError } from '../../../database/errors';
import { generateId } from '../../../utils/id';
import {
  CreateCategoryDTO,
  UpdateCategoryDTO,
  validateCategoryCreate,
  validateCategoryUpdate,
} from '../validation';

export interface ICategoryService {
  list(activeOnly?: boolean): Promise<CategoryRow[]>;
  listWithProductCount(): Promise<(CategoryRow & { product_count: number })[]>;
  getById(id: string): Promise<CategoryRow>;
  create(user: AuthenticatedUser, data: CreateCategoryDTO): Promise<CategoryRow>;
  update(user: AuthenticatedUser, id: string, data: UpdateCategoryDTO): Promise<CategoryRow>;
  activate(user: AuthenticatedUser, id: string): Promise<CategoryRow>;
  deactivate(user: AuthenticatedUser, id: string): Promise<CategoryRow>;
  delete(user: AuthenticatedUser, id: string): Promise<void>;
  reorder(user: AuthenticatedUser, orderMap: { id: string; sort_order: number }[]): Promise<void>;
}

export class CategoryService implements ICategoryService {
  private categoryRepo: ICategoryRepository;
  private auditRepo: IAuditLogRepository;

  constructor(
    categoryRepo?: ICategoryRepository,
    auditRepo?: IAuditLogRepository
  ) {
    this.categoryRepo = categoryRepo || new CategoryRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
  }

  /**
   * List categories
   */
  public async list(activeOnly: boolean = false): Promise<CategoryRow[]> {
    return activeOnly ? await this.categoryRepo.listActive() : await this.categoryRepo.listAll();
  }

  /**
   * List categories with linked products count
   */
  public async listWithProductCount(): Promise<(CategoryRow & { product_count: number })[]> {
    return await this.categoryRepo.listWithProductCount();
  }

  /**
   * Get single category by ID
   */
  public async getById(id: string): Promise<CategoryRow> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      throw new NotFoundError('Category', id);
    }
    return category;
  }

  /**
   * Create a new category
   */
  public async create(user: AuthenticatedUser, data: CreateCategoryDTO): Promise<CategoryRow> {
    requirePermission(user, 'categories.manage', this.auditRepo);

    const validated = validateCategoryCreate(data);

    // Verify name uniqueness
    const existing = await this.categoryRepo.findByName(validated.name);
    if (existing) {
      throw new ConflictError(`اسم القسم "${validated.name}" موجود بالفعل. يرجى اختيار اسم مختلف.`);
    }

    const now = new Date().toISOString();
    const newCategory: CategoryRow = {
      id: generateId('cat'),
      name: validated.name,
      sort_order: validated.sort_order ?? 0,
      is_active: validated.is_active !== undefined ? (validated.is_active ? 1 : 0) : 1,
      created_at: now,
      updated_at: now,
    };

    const created = await this.categoryRepo.create(newCategory);

    await this.auditRepo.log(
      'CATEGORY_CREATED',
      'categories',
      created.id,
      user.id,
      { name: created.name, sort_order: created.sort_order, is_active: created.is_active }
    );

    return created;
  }

  /**
   * Update category
   */
  public async update(
    user: AuthenticatedUser,
    id: string,
    data: UpdateCategoryDTO
  ): Promise<CategoryRow> {
    requirePermission(user, 'categories.manage', this.auditRepo);

    const category = await this.getById(id);
    const validated = validateCategoryUpdate(data);

    // If name changed, check uniqueness
    if (validated.name && validated.name.toLowerCase() !== category.name.toLowerCase()) {
      const existing = await this.categoryRepo.findByName(validated.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`اسم القسم "${validated.name}" موجود بالفعل لقسم آخر.`);
      }
    }

    const updates: Partial<CategoryRow> = {
      ...validated,
      updated_at: new Date().toISOString(),
    };

    const updated = await this.categoryRepo.update(id, updates);

    await this.auditRepo.log(
      'CATEGORY_UPDATED',
      'categories',
      id,
      user.id,
      {
        old_values: { name: category.name, sort_order: category.sort_order, is_active: category.is_active },
        new_values: { name: updated.name, sort_order: updated.sort_order, is_active: updated.is_active },
      }
    );

    return updated;
  }

  /**
   * Activate category
   */
  public async activate(user: AuthenticatedUser, id: string): Promise<CategoryRow> {
    requirePermission(user, 'categories.manage', this.auditRepo);

    const current = await this.getById(id);
    if (current.is_active === 1) {
      return current;
    }

    const updated = await this.categoryRepo.update(id, {
      is_active: 1,
      updated_at: new Date().toISOString(),
    });

    await this.auditRepo.log(
      'CATEGORY_ACTIVATED',
      'categories',
      id,
      user.id,
      { is_active: 1, name: current.name }
    );

    return updated;
  }

  /**
   * Deactivate category
   */
  public async deactivate(user: AuthenticatedUser, id: string): Promise<CategoryRow> {
    requirePermission(user, 'categories.manage', this.auditRepo);

    const current = await this.getById(id);
    if (current.is_active === 0) {
      return current;
    }

    const updated = await this.categoryRepo.update(id, {
      is_active: 0,
      updated_at: new Date().toISOString(),
    });

    await this.auditRepo.log(
      'CATEGORY_DEACTIVATED',
      'categories',
      id,
      user.id,
      { is_active: 0, name: current.name }
    );

    return updated;
  }

  /**
   * Delete category safely (only if no products are associated)
   */
  public async delete(user: AuthenticatedUser, id: string): Promise<void> {
    requirePermission(user, 'categories.manage', this.auditRepo);

    const category = await this.getById(id);
    const productCount = await this.categoryRepo.countProducts(id);

    if (productCount > 0) {
      await this.auditRepo.log(
        'DELETE_ATTEMPT_BLOCKED',
        'categories',
        id,
        user.id,
        {
          name: category.name,
          product_count: productCount,
          reason: 'CANNOT_DELETE_CATEGORY_WITH_PRODUCTS',
        }
      );

      throw new ConstraintError(
        `لا يمكن حذف القسم "${category.name}" لوجود ${productCount} منتج مرتبط به. يرجى نقل أو حذف المنتجات أولاً.`,
        'FOREIGN_KEY'
      );
    }

    await this.categoryRepo.delete(id);

    await this.auditRepo.log(
      'CATEGORY_DELETED',
      'categories',
      id,
      user.id,
      { name: category.name }
    );
  }

  /**
   * Reorder categories
   */
  public async reorder(
    user: AuthenticatedUser,
    orderMap: { id: string; sort_order: number }[]
  ): Promise<void> {
    requirePermission(user, 'categories.manage', this.auditRepo);

    for (const item of orderMap) {
      await this.categoryRepo.update(item.id, {
        sort_order: item.sort_order,
        updated_at: new Date().toISOString(),
      });
    }

    await this.auditRepo.log(
      'CATEGORIES_REORDERED',
      'categories',
      'bulk',
      user.id,
      { count: orderMap.length }
    );
  }
}
