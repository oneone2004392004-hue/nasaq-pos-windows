import { IBaseRepository, ISqlExecutor } from '../database/contracts';
import { DatabaseManager } from '../database/DatabaseManager';
import { NotFoundError } from '../database/errors';

export abstract class BaseRepository<T extends { id: string }> implements IBaseRepository<T> {
  protected tableName: string;
  protected executor: ISqlExecutor;

  constructor(tableName: string, executor?: ISqlExecutor) {
    this.tableName = tableName;
    this.executor = executor || DatabaseManager.getInstance();
  }

  /**
   * Returns a new instance of the repository bound to a transaction executor
   */
  public abstract withTransaction(executor: ISqlExecutor): this;

  public async findById(id: string): Promise<T | null> {
    return await this.executor.queryOne<T>(
      `SELECT * FROM ${this.tableName} WHERE id = ?;`,
      [id]
    );
  }

  public async getRequiredById(id: string): Promise<T> {
    const item = await this.findById(id);
    if (!item) {
      throw new NotFoundError(this.tableName, id);
    }
    return item;
  }

  public async getAll(filter?: Record<string, unknown>): Promise<T[]> {
    if (!filter || Object.keys(filter).length === 0) {
      return await this.executor.query<T>(`SELECT * FROM ${this.tableName};`);
    }

    const conditions: string[] = [];
    const values: unknown[] = [];

    for (const [key, val] of Object.entries(filter)) {
      if (val !== undefined) {
        conditions.push(`${key} = ?`);
        values.push(val);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return await this.executor.query<T>(
      `SELECT * FROM ${this.tableName} ${whereClause};`,
      values
    );
  }

  public async create(entity: T): Promise<T> {
    const keys = Object.keys(entity);
    const values = Object.values(entity);
    const placeholders = keys.map(() => '?').join(', ');

    await this.executor.execute(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders});`,
      values
    );

    return entity;
  }

  public async update(id: string, updates: Partial<T>): Promise<T> {
    const keys = Object.keys(updates).filter((k) => k !== 'id');
    if (keys.length === 0) {
      return await this.getRequiredById(id);
    }

    const setClauses = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => (updates as Record<string, unknown>)[k]);
    values.push(id);

    const res = await this.executor.run(
      `UPDATE ${this.tableName} SET ${setClauses} WHERE id = ?;`,
      values
    );

    if (res.rowsAffected === 0) {
      throw new NotFoundError(this.tableName, id);
    }

    return await this.getRequiredById(id);
  }

  public async deactivate(id: string): Promise<boolean> {
    const res = await this.executor.run(
      `UPDATE ${this.tableName} SET is_active = 0, updated_at = ? WHERE id = ?;`,
      [new Date().toISOString(), id]
    );
    return res.rowsAffected > 0;
  }

  public async delete(id: string): Promise<boolean> {
    const res = await this.executor.run(
      `DELETE FROM ${this.tableName} WHERE id = ?;`,
      [id]
    );
    return res.rowsAffected > 0;
  }
}
