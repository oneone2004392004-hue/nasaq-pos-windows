import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { ISqliteDriver, ISqlRunResult } from '../contracts';
import { wrapSqliteError } from '../errors';
import { logger } from '../../utils/logger';

export interface WasmSqliteDriverOptions {
  wasmBinary?: ArrayBuffer;
  wasmUrl?: string;
  initialDbBytes?: Uint8Array;
}

let cachedWasmBinary: ArrayBuffer | Uint8Array | null = null;

export class WasmSqliteDriver implements ISqliteDriver {
  private db: SqlJsDatabase | null = null;
  private isClosed = false;
  private SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

  constructor(private options: WasmSqliteDriverOptions = {}) {}

  public async init(): Promise<void> {
    if (this.db) return;

    try {
      const config: Parameters<typeof initSqlJs>[0] = {};

      if (this.options.wasmBinary) {
        config.wasmBinary = this.options.wasmBinary;
      } else if (cachedWasmBinary) {
        config.wasmBinary = cachedWasmBinary;
      } else if (typeof window !== 'undefined') {
        // Browser environment: pre-fetch wasmBinary as ArrayBuffer to bypass
        // Emscripten's problematic WebAssembly.instantiateStreaming credentials fetch in iframes,
        // preventing the "wasm streaming compile failed: TypeError: Failed to fetch" console error.
        const baseUrl = import.meta.env?.BASE_URL || '/';
        const wasmUrl = this.options.wasmUrl || (baseUrl.endsWith('/') ? `${baseUrl}sql-wasm.wasm` : `${baseUrl}/sql-wasm.wasm`);

        try {
          const response = await fetch(wasmUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            cachedWasmBinary = buffer;
            config.wasmBinary = buffer;
          }
        } catch (error) {
          logger.warn('WASM prefetch failed; using locateFile fallback', error);
        }

        config.locateFile = (file: string) => {
          if (file.endsWith('.wasm')) {
            return wasmUrl;
          }
          return file;
        };

        // Filter out benign Emscripten streaming compile notices if they ever occur
        config.printErr = (msg: string) => {
          if (
            typeof msg === 'string' &&
            (msg.includes('wasm streaming compile failed') || msg.includes('falling back to ArrayBuffer'))
          ) {
            return;
          }
          console.error(msg);
        };
      } else {
        // Node / test environment: read wasm from node_modules if in Node
        try {
          // Dynamic import of fs/path for Node environment
          const fs = await import('fs');
          const path = await import('path');
          const wasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
          if (fs.existsSync(wasmPath)) {
            const buffer = fs.readFileSync(wasmPath);
            cachedWasmBinary = buffer;
            config.wasmBinary = buffer;
          }
        } catch {
          // fallback to locateFile
          config.locateFile = () => 'node_modules/sql.js/dist/sql-wasm.wasm';
        }
      }

      const SQL = await initSqlJs(config);
      this.SQL = SQL;
      this.db = this.options.initialDbBytes
        ? new SQL.Database(this.options.initialDbBytes)
        : new SQL.Database();

      // Enforce SQLite Foreign Key constraints globally
      this.db.run('PRAGMA foreign_keys = ON;');
    } catch (err) {
      throw wrapSqliteError(err);
    }
  }

  private ensureOpen(): SqlJsDatabase {
    if (this.isClosed || !this.db) {
      throw new Error('SQLite database is not initialized or has been closed.');
    }
    return this.db;
  }

  public async exec(sql: string): Promise<void> {
    const db = this.ensureOpen();
    try {
      db.exec(sql);
    } catch (err) {
      throw wrapSqliteError(err);
    }
  }

  public async run(sql: string, params: unknown[] = []): Promise<ISqlRunResult> {
    const db = this.ensureOpen();
    try {
      const stmt = db.prepare(sql);
      try {
        // Normalize params for sql.js: convert undefined to null, boolean to 0/1
        const normalizedParams = params.map((p) => {
          if (p === undefined) return null;
          if (typeof p === 'boolean') return p ? 1 : 0;
          return p as number | string | Uint8Array | null;
        });

        stmt.run(normalizedParams);
        const rowsAffected = db.getRowsModified();
        
        // Retrieve last_insert_rowid if it was an insert
        let lastInsertRowId: number | undefined;
        try {
          const rowIdRes = db.exec('SELECT last_insert_rowid() AS id;');
          if (rowIdRes.length > 0 && rowIdRes[0].values.length > 0) {
            const val = rowIdRes[0].values[0][0];
            if (typeof val === 'number') {
              lastInsertRowId = val;
            }
          }
        } catch (error) {
          logger.warn('Could not read SQLite last_insert_rowid result', error);
        }

        return { rowsAffected, lastInsertRowId };
      } finally {
        stmt.free();
      }
    } catch (err) {
      throw wrapSqliteError(err);
    }
  }

  public async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = this.ensureOpen();
    try {
      const stmt = db.prepare(sql);
      try {
        const normalizedParams = params.map((p) => {
          if (p === undefined) return null;
          if (typeof p === 'boolean') return p ? 1 : 0;
          return p as number | string | Uint8Array | null;
        });

        stmt.bind(normalizedParams);
        const results: T[] = [];
        while (stmt.step()) {
          const row = stmt.getAsObject() as unknown as T;
          results.push(row);
        }
        return results;
      } finally {
        stmt.free();
      }
    } catch (err) {
      throw wrapSqliteError(err);
    }
  }

  public async queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public async exportBytes(): Promise<Uint8Array> {
    const db = this.ensureOpen();
    return db.export();
  }

  public async loadBytes(bytes: Uint8Array): Promise<void> {
    if (!this.SQL) {
      await this.init();
    }
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        logger.warn('Could not close previous SQLite WASM database', error);
      }
      this.db = null;
    }
    this.db = new this.SQL!.Database(bytes);
    this.isClosed = false;
    this.db.run('PRAGMA foreign_keys = ON;');
  }

  public async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isClosed = true;
  }
}
