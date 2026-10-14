import { ISqliteDriver, ISqlExecutor, ISqlRunResult } from './contracts';
import { createSqliteDriver } from './drivers/DriverFactory';
import { MigrationRunner } from './migrations/MigrationRunner';
import { runInitialSeed } from './seeds/initialSeed';
import { wrapSqliteError } from './errors';
import { logger } from '../utils/logger';
import { generateId } from '../utils/id';

export class DatabaseManager implements ISqlExecutor {
  private static instance: DatabaseManager | null = null;
  private driver: ISqliteDriver | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private operationQueue: Promise<void> = Promise.resolve();

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initializes the database connection, enforces foreign keys, executes migrations,
   * and runs initial production system seeds.
   */
  public async initialize(customDriver?: ISqliteDriver): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (customDriver) {
          this.driver = customDriver;
        } else if (!this.driver) {
          this.driver = await createSqliteDriver();
        }

        // 1. Enforce SQLite Foreign Keys
        await this.driver.exec('PRAGMA foreign_keys = ON;');

        // 2. Run Migrations
        const migrationRunner = new MigrationRunner();
        await migrationRunner.runPending(this);

        // 3. Run Production Initial Seed (Roles, Permissions, Settings)
        await runInitialSeed(this);

        this.isInitialized = true;
      } catch (err) {
        this.driver = null;
        this.isInitialized = false;
        throw wrapSqliteError(err);
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public getDriver(): ISqliteDriver {
    if (!this.driver) {
      throw new Error('قاعدة البيانات لم يتم تهيئتها بعد. يجب استدعاء DatabaseManager.initialize() أولاً.');
    }
    return this.driver;
  }

  public async execute(sql: string, params: unknown[] = []): Promise<void> {
    return this.enqueue(async () => {
      const driver = this.getDriver();
      try {
        if (params.length === 0) await driver.exec(sql);
        else await driver.run(sql, params);
      } catch (err) { throw wrapSqliteError(err); }
    });
  }

  public async run(sql: string, params: unknown[] = []): Promise<ISqlRunResult> {
    return this.enqueue(async () => {
      try { return await this.getDriver().run(sql, params); }
      catch (err) { throw wrapSqliteError(err); }
    });
  }

  public async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.enqueue(async () => {
      try { return await this.getDriver().query<T>(sql, params); }
      catch (err) { throw wrapSqliteError(err); }
    });
  }

  public async queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    return this.enqueue(async () => {
      try { return await this.getDriver().queryOne<T>(sql, params); }
      catch (err) { throw wrapSqliteError(err); }
    });
  }

  /**
   * Atomic Transaction Execution with automatic COMMIT and ROLLBACK
   */
  public async transaction<T>(action: (executor: ISqlExecutor) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      const driver = this.getDriver();
      await driver.exec('BEGIN TRANSACTION;');
      const transactionExecutor = this.createTransactionExecutor(driver);
      try {
        const result = await action(transactionExecutor);
        await driver.exec('COMMIT;');
        return result;
      } catch (err) {
        try {
          await driver.exec('ROLLBACK;');
        } catch (rollbackError) {
          logger.error('Transaction rollback failed; database connection may be lost', rollbackError);
        }
        throw wrapSqliteError(err);
      }
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationQueue;
    let release!: () => void;
    this.operationQueue = new Promise<void>((resolve) => { release = resolve; });
    return previous.then(operation).finally(release);
  }

  private createTransactionExecutor(driver: ISqliteDriver): ISqlExecutor {
    const executor = {} as ISqlExecutor;
    executor.execute = async (sql, params = []) => {
      try {
        if (params.length === 0) await driver.exec(sql);
        else await driver.run(sql, params);
      } catch (err) {
        throw wrapSqliteError(err);
      }
    };
    executor.run = async (sql, params = []) => driver.run(sql, params);
    executor.query = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => driver.query<T>(sql, params);
    executor.queryOne = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => driver.queryOne<T>(sql, params);
    executor.transaction = async <T>(action: (nested: ISqlExecutor) => Promise<T>) => {
      const savepoint = generateId('sp').replace(/-/g, '_');
      await driver.exec(`SAVEPOINT ${savepoint};`);
      try {
        const result = await action(executor);
        await driver.exec(`RELEASE SAVEPOINT ${savepoint};`);
        return result;
      } catch (err) {
        await driver.exec(`ROLLBACK TO SAVEPOINT ${savepoint};`);
        throw wrapSqliteError(err);
      }
    };
    return executor;
  }

  public async close(): Promise<void> {
    await this.operationQueue;
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
    this.isInitialized = false;
  }

  /**
   * Exports the entire SQLite database as a binary Uint8Array byte buffer.
   */
  public async exportDatabase(): Promise<Uint8Array> {
    return this.enqueue(async () => {
      const driver = this.getDriver();
      if (typeof driver.exportBytes === 'function') return await driver.exportBytes();
      throw new Error('محرك قاعدة البيانات الحالي لا يدعم تصدير الملف الثنائي.');
    });
  }

  /**
   * Restores the SQLite database from a binary Uint8Array byte buffer.
   * Keeps the same DatabaseManager singleton instance so all repositories immediately
   * operate on the newly restored database.
   */
  public async restoreDatabase(bytes: Uint8Array): Promise<void> {
    await this.enqueue(async () => {
      const driver = this.getDriver();
      if (typeof driver.loadBytes !== 'function') {
        throw new Error('محرك قاعدة البيانات الحالي لا يدعم استعادة الملف الثنائي.');
      }
      await driver.loadBytes(bytes);
    });
    // Queue migration and seed work after binary load; do not nest enqueue calls inside a queued action.
    await new MigrationRunner().runPending(this);
    await runInitialSeed(this);
    await this.execute("DELETE FROM settings WHERE key LIKE 'auth_session_token_hash:%' OR key LIKE 'auth_session_expires:%';");
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('nasaq_pos_auth_session');
      window.dispatchEvent(new Event('nasaq:database-restored'));
    }
  }

  /**
   * Reset instance for tests
   */
  public static async resetForTesting(customDriver?: ISqliteDriver): Promise<DatabaseManager> {
    if (DatabaseManager.instance) {
      await DatabaseManager.instance.close();
      DatabaseManager.instance = null;
    }
    const instance = DatabaseManager.getInstance();
    await instance.initialize(customDriver);
    return instance;
  }
}
