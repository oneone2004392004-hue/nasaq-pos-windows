import { BaseRepository } from './BaseRepository';
import { CategoryRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface ICategoryRepository {
  findById(id: string): Promise<CategoryRow | null>;
  findByName(name: string): Promise<CategoryRow | null>;
  listAll(): Promise<CategoryRow[]>;
  listActive(): Promise<CategoryRow[]>;
  listWithProductCount(): Promise<(CategoryRow & { product_count: number })[]>;
  countProducts(categoryId: string): Promise<number>;
  create(category: CategoryRow): Promise<CategoryRow>;
  update(id: string, updates: Partial<CategoryRow>): Promise<CategoryRow>;
  deactivate(id: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  reorder(orderMap: { id: string; sort_order: number }[]): Promise<void>;
}

export class CategoryRepository extends BaseRepository<CategoryRow> implements ICategoryRepository {
  constructor(executor?: ISqlExecutor) {
    super('categories', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new CategoryRepository(executor) as this;
  }

  public async findByName(name: string): Promise<CategoryRow | null> {
    return await this.executor.queryOne<CategoryRow>(
      'SELECT * FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?));',
      [name]
    );
  }

  public async countProducts(categoryId: string): Promise<number> {
    const res = await this.executor.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?;',
      [categoryId]
    );
    return res ? Number(res.count) : 0;
  }

  public async listAll(): Promise<CategoryRow[]> {
    return await this.executor.query<CategoryRow>(
      'SELECT * FROM categories ORDER BY sort_order ASC, name ASC;'
    );
  }

  public async listActive(): Promise<CategoryRow[]> {
    return await this.executor.query<CategoryRow>(
      'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC;'
    );
  }

  public async listWithProductCount(): Promise<(CategoryRow & { product_count: number })[]> {
    return await this.executor.query<CategoryRow & { product_count: number }>(
      `SELECT c.*, COALESCE(COUNT(p.id), 0) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC;`
    );
  }

  public async reorder(orderMap: { id: string; sort_order: number }[]): Promise<void> {
    for (const item of orderMap) {
      await this.executor.execute(
        'UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?;',
        [item.sort_order, new Date().toISOString(), item.id]
      );
    }
  }
}
