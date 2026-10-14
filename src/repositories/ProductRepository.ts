import { BaseRepository } from './BaseRepository';
import { ProductRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IProductRepository {
  findById(id: string): Promise<ProductRow | null>;
  findByBarcode(barcode: string): Promise<ProductRow | null>;
  listByCategory(categoryId: string, onlyActive?: boolean): Promise<ProductRow[]>;
  listWithFilter(filter?: { categoryId?: string; isActive?: boolean; search?: string }): Promise<ProductRow[]>;
  searchByNameOrBarcode(query: string): Promise<ProductRow[]>;
  countByCategoryId(categoryId: string): Promise<number>;
  updateStock(productId: string, quantityDelta: number): Promise<void>;
  create(product: ProductRow): Promise<ProductRow>;
  update(id: string, updates: Partial<ProductRow>): Promise<ProductRow>;
  deactivate(id: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  listLowStock(): Promise<ProductRow[]>;
}

export class ProductRepository extends BaseRepository<ProductRow> implements IProductRepository {
  constructor(executor?: ISqlExecutor) {
    super('products', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new ProductRepository(executor) as this;
  }

  public async findByBarcode(barcode: string): Promise<ProductRow | null> {
    return await this.executor.queryOne<ProductRow>(
      'SELECT * FROM products WHERE barcode = ?;',
      [barcode]
    );
  }

  public async countByCategoryId(categoryId: string): Promise<number> {
    const res = await this.executor.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?;',
      [categoryId]
    );
    return res ? Number(res.count) : 0;
  }

  public async listByCategory(categoryId: string, onlyActive: boolean = true): Promise<ProductRow[]> {
    if (onlyActive) {
      return await this.executor.query<ProductRow>(
        'SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY name ASC;',
        [categoryId]
      );
    }
    return await this.executor.query<ProductRow>(
      'SELECT * FROM products WHERE category_id = ? ORDER BY name ASC;',
      [categoryId]
    );
  }

  public async listWithFilter(filter?: { categoryId?: string; isActive?: boolean; search?: string }): Promise<ProductRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.categoryId) {
      conditions.push('category_id = ?');
      params.push(filter.categoryId);
    }

    if (filter?.isActive !== undefined) {
      conditions.push('is_active = ?');
      params.push(filter.isActive ? 1 : 0);
    }

    if (filter?.search && filter.search.trim().length > 0) {
      const q = `%${filter.search.trim()}%`;
      conditions.push('(name LIKE ? OR barcode LIKE ?)');
      params.push(q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return await this.executor.query<ProductRow>(
      `SELECT * FROM products ${whereClause} ORDER BY name ASC;`,
      params
    );
  }

  public async searchByNameOrBarcode(query: string): Promise<ProductRow[]> {
    const q = `%${query.trim()}%`;
    return await this.executor.query<ProductRow>(
      `SELECT * FROM products
       WHERE (name LIKE ? OR barcode LIKE ?) AND is_active = 1
       ORDER BY name ASC LIMIT 50;`,
      [q, q]
    );
  }

  public async updateStock(productId: string, quantityDelta: number): Promise<void> {
    await this.executor.execute(
      `UPDATE products
       SET current_stock = current_stock + ?, updated_at = ?
       WHERE id = ?;`,
      [quantityDelta, new Date().toISOString(), productId]
    );
  }

  public async listLowStock(): Promise<ProductRow[]> {
    return await this.executor.query<ProductRow>(
      `SELECT * FROM products
       WHERE track_stock = 1 AND current_stock <= min_stock_alert AND is_active = 1
       ORDER BY current_stock ASC;`
    );
  }
}
