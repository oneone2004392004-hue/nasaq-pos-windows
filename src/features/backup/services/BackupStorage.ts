/**
 * NASAQ POS — Offline Local Backup Storage
 * Provides persistent local storage for SQLite database backup binary blobs (.db files).
 * Uses IndexedDB in modern browser environments, with an in-memory fallback for Node.js test runners.
 */

export interface StoredBackupRecord {
  id: string;
  filename: string;
  bytes: Uint8Array;
  sizeBytes: number;
  createdAt: string;
}

export interface IBackupStorage {
  saveBackupFile(id: string, filename: string, bytes: Uint8Array): Promise<string>;
  getBackupBytes(idOrFilename: string): Promise<Uint8Array | null>;
  deleteBackupFile(idOrFilename: string): Promise<boolean>;
  listBackupFiles(): Promise<Array<Omit<StoredBackupRecord, 'bytes'>>>;
  clearAll(): Promise<void>;
}

const DB_NAME = 'nasaq_pos_storage';
const STORE_NAME = 'backups';
const DB_VERSION = 1;

export class LocalBackupStorage implements IBackupStorage {
  private static instance: LocalBackupStorage | null = null;
  private memoryStore: Map<string, StoredBackupRecord> = new Map();
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  public static getInstance(): LocalBackupStorage {
    if (!LocalBackupStorage.instance) {
      LocalBackupStorage.instance = new LocalBackupStorage();
    }
    return LocalBackupStorage.instance;
  }

  private isIndexedDBAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  private async getIDB(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDBAvailable()) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('filename', 'filename', { unique: true });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('IndexedDB failed to open, falling back to memory store:', request.error);
          resolve(null);
        };
      } catch (err) {
        console.warn('Error opening IndexedDB:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public async saveBackupFile(id: string, filename: string, bytes: Uint8Array): Promise<string> {
    const record: StoredBackupRecord = {
      id,
      filename,
      bytes: new Uint8Array(bytes),
      sizeBytes: bytes.byteLength,
      createdAt: new Date().toISOString(),
    };

    // Always keep in memory store as fast cache / fallback
    this.memoryStore.set(id, record);
    this.memoryStore.set(filename, record);

    const idb = await this.getIDB();
    if (idb) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = idb.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        } catch (e) {
          reject(e);
        }
      });
    }

    return `local://backups/${filename}`;
  }

  public async getBackupBytes(idOrFilename: string): Promise<Uint8Array | null> {
    // 1. Check memory store
    const memRecord = this.memoryStore.get(idOrFilename);
    if (memRecord) {
      return new Uint8Array(memRecord.bytes);
    }

    // 2. Check IndexedDB
    const idb = await this.getIDB();
    if (idb) {
      const record = await new Promise<StoredBackupRecord | null>((resolve) => {
        try {
          const tx = idb.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);

          // Try get by id
          const idReq = store.get(idOrFilename);
          idReq.onsuccess = () => {
            if (idReq.result) {
              resolve(idReq.result);
            } else {
              // Try get by filename index
              try {
                const idx = store.index('filename');
                const fnReq = idx.get(idOrFilename);
                fnReq.onsuccess = () => resolve(fnReq.result || null);
                fnReq.onerror = () => resolve(null);
              } catch {
                resolve(null);
              }
            }
          };
          idReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (record) {
        this.memoryStore.set(record.id, record);
        this.memoryStore.set(record.filename, record);
        return new Uint8Array(record.bytes);
      }
    }

    return null;
  }

  public async deleteBackupFile(idOrFilename: string): Promise<boolean> {
    let deleted = false;

    // Remove from memory
    const existing = this.memoryStore.get(idOrFilename);
    if (existing) {
      this.memoryStore.delete(existing.id);
      this.memoryStore.delete(existing.filename);
      deleted = true;
    }

    // Remove from IndexedDB
    const idb = await this.getIDB();
    if (idb) {
      deleted = await new Promise<boolean>((resolve) => {
        try {
          const tx = idb.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);

          if (existing) {
            store.delete(existing.id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } else {
            // Find by filename index first
            const idx = store.index('filename');
            const req = idx.get(idOrFilename);
            req.onsuccess = () => {
              if (req.result) {
                store.delete(req.result.id);
                tx.oncomplete = () => resolve(true);
              } else {
                store.delete(idOrFilename);
                tx.oncomplete = () => resolve(true);
              }
            };
            req.onerror = () => resolve(false);
          }
        } catch {
          resolve(false);
        }
      });
    }

    return deleted;
  }

  public async listBackupFiles(): Promise<Array<Omit<StoredBackupRecord, 'bytes'>>> {
    const idb = await this.getIDB();
    if (idb) {
      return await new Promise((resolve) => {
        try {
          const tx = idb.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => {
            const records: StoredBackupRecord[] = req.result || [];
            resolve(
              records.map((r) => ({
                id: r.id,
                filename: r.filename,
                sizeBytes: r.sizeBytes,
                createdAt: r.createdAt,
              }))
            );
          };
          req.onerror = () => resolve(this.listFromMemory());
        } catch {
          resolve(this.listFromMemory());
        }
      });
    }

    return this.listFromMemory();
  }

  private listFromMemory(): Array<Omit<StoredBackupRecord, 'bytes'>> {
    const seen = new Set<string>();
    const list: Array<Omit<StoredBackupRecord, 'bytes'>> = [];
    for (const record of this.memoryStore.values()) {
      if (!seen.has(record.id)) {
        seen.add(record.id);
        list.push({
          id: record.id,
          filename: record.filename,
          sizeBytes: record.sizeBytes,
          createdAt: record.createdAt,
        });
      }
    }
    return list;
  }

  public async clearAll(): Promise<void> {
    this.memoryStore.clear();
    const idb = await this.getIDB();
    if (idb) {
      await new Promise<void>((resolve) => {
        try {
          const tx = idb.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  }
}
