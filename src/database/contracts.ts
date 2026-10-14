/**
 * Database Layer Contracts
 * Defines repository and executor interfaces to ensure complete independence between
 * Business Logic / Application Services and the underlying SQLite engine or desktop runtime bridge.
 */

export interface ISqlRunResult {
  lastInsertRowId?: number | bigint;
  rowsAffected: number;
}

export interface ISqliteDriver {
  /**
   * Execute raw SQL statements (can contain multiple statements separated by semicolons)
   */
  exec(sql: string): Promise<void>;

  /**
   * Execute a single parameterized statement (INSERT, UPDATE, DELETE)
   */
  run(sql: string, params?: unknown[]): Promise<ISqlRunResult>;

  /**
   * Query multiple rows
   */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Query a single row (or null if empty)
   */
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;

  /**
   * Close connection and release resources
   */
  close(): Promise<void>;

  /**
   * Export the SQLite database as binary Uint8Array bytes
   */
  exportBytes?(): Promise<Uint8Array>;

  /**
   * Replace/reload the database with new SQLite binary bytes
   */
  loadBytes?(bytes: Uint8Array): Promise<void>;
}

export interface ISqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<ISqlRunResult>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  transaction<T>(action: (executor: ISqlExecutor) => Promise<T>): Promise<T>;
}

export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  getAll(filter?: Record<string, unknown>): Promise<T[]>;
  create(entity: T): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  deactivate?(id: string): Promise<boolean>;
  delete?(id: string): Promise<boolean>;
}
