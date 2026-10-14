/**
 * NASAQ POS — SQLite driver for the Tauri desktop runtime.
 * Production desktop builds use one rusqlite Connection owned by Rust.
 * The optional adapter remains only for deterministic unit tests.
 */
import { ISqliteDriver, ISqlRunResult } from '../contracts';
import { wrapSqliteError } from '../errors';

interface ITauriDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  close(): Promise<boolean>;
}
interface NativeBridge {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}
interface NativeRunResult { rows_affected: number; last_insert_id: number; }

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let triggerBodyDepth = 0;
  let word = '';
  let sawCreate = false;
  const flushWord = () => {
    if (!word) return;
    const upper = word.toUpperCase();
    if (upper === 'CREATE') sawCreate = true;
    if (sawCreate && upper === 'BEGIN') triggerBodyDepth++;
    if (triggerBodyDepth > 0 && upper === 'END') triggerBodyDepth--;
    word = '';
  };
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (quote) {
      if (ch === quote && sql[i + 1] === quote) { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { flushWord(); quote = ch; continue; }
    if (/[_A-Za-z0-9]/.test(ch)) { word += ch; continue; }
    flushWord();
    if (ch === ';' && triggerBodyDepth === 0) {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }
  flushWord();
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

export class TauriSqliteDriver implements ISqliteDriver {
  private tauriDb: ITauriDatabase | null = null;
  private bridge: NativeBridge | null = null;
  private isInitialized = false;

  constructor(private dbPath = 'sqlite:data/nasaq.db', customDb?: ITauriDatabase) {
    if (customDb) this.tauriDb = customDb;
  }

  public async init(): Promise<void> {
    try {
      if (this.tauriDb) {
        await this.exec('PRAGMA foreign_keys = ON;');
        await this.exec('PRAGMA journal_mode = WAL;');
        await this.query('SELECT 1 AS ok;');
      } else {
        const api = await import('@tauri-apps/api/core');
        this.bridge = api as NativeBridge;
        await this.bridge.invoke<void>('db_reset_transaction');
        await this.bridge.invoke<void>('db_init');
        await this.query('SELECT 1 AS ok;');
      }
      this.isInitialized = true;
    } catch (err) {
      throw wrapSqliteError(err);
    }
  }

  public async exec(sql: string): Promise<void> {
    try {
      for (const statement of splitSqlStatements(sql)) await this.run(statement);
    } catch (err) { throw wrapSqliteError(err); }
  }

  public async run(sql: string, params: unknown[] = []): Promise<ISqlRunResult> {
    try {
      if (this.tauriDb) {
        const result = await this.tauriDb.execute(sql, params);
        return { rowsAffected: result.rowsAffected, lastInsertRowId: result.lastInsertId };
      }
      if (!this.bridge) throw new Error('Tauri SQLite is not initialized');
      const result = await this.bridge.invoke<NativeRunResult>('db_exec', { sql, params });
      return { rowsAffected: result.rows_affected, lastInsertRowId: result.last_insert_id };
    } catch (err) { throw wrapSqliteError(err); }
  }

  public async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      if (this.tauriDb) return await this.tauriDb.select<T[]>(sql, params);
      if (!this.bridge) throw new Error('Tauri SQLite is not initialized');
      return await this.bridge.invoke<T[]>('db_query', { sql, params });
    } catch (err) { throw wrapSqliteError(err); }
  }

  public async queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  public async close(): Promise<void> {
    // Rust owns the production connection; it remains managed for the app lifetime.
    if (this.tauriDb) await this.tauriDb.close();
    this.tauriDb = null;
    this.bridge = null;
    this.isInitialized = false;
  }

  public async exportBytes(): Promise<Uint8Array> {
    try {
      if (!this.bridge) {
        if (!this.tauriDb) throw new Error('Tauri SQLite is not initialized');
        await this.tauriDb.execute('PRAGMA wal_checkpoint(TRUNCATE);');
        const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
        return new Uint8Array(await readFile(this.dbPath.replace(/^sqlite:/, ''), { baseDir: BaseDirectory.AppData }));
      }
      return new Uint8Array(await this.bridge.invoke<number[]>('db_export_bytes'));
    } catch (err) { throw new Error(`فشل تصدير قاعدة البيانات: ${err instanceof Error ? err.message : String(err)}`); }
  }

  public async loadBytes(bytes: Uint8Array): Promise<void> {
    try {
      if (this.bridge) {
        await this.bridge.invoke<void>('db_load_bytes', { bytes: Array.from(bytes) });
        this.isInitialized = true;
        return;
      }
      await this.close();
      const { writeFile, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const cleanPath = this.dbPath.replace(/^sqlite:/, '');
      await remove(`${cleanPath}-wal`, { baseDir: BaseDirectory.AppData }).catch(() => undefined);
      await remove(`${cleanPath}-shm`, { baseDir: BaseDirectory.AppData }).catch(() => undefined);
      await writeFile(cleanPath, bytes, { baseDir: BaseDirectory.AppData });
      await this.init();
    } catch (err) { throw new Error(`فشل استعادة قاعدة البيانات: ${err instanceof Error ? err.message : String(err)}`); }
  }

  public getDbPath(): string { return this.dbPath; }
  public isReady(): boolean { return this.isInitialized && (this.tauriDb !== null || this.bridge !== null); }
}
