import { errorMessage } from '../../../utils/errors';
/**
 * NASAQ POS — Tauri Desktop Native Filesystem Backup Storage (Phase 14)
 *
 * Persists binary SQLite backup files directly to:
 * %APPDATA%\NasaqPOS\backups\<filename>.db
 *
 * Provides native file dialog bridges via `@tauri-apps/plugin-dialog`:
 * - Export to external USB drives, Desktop, Documents
 * - Import from user-selected .db files
 */

import { IBackupStorage, StoredBackupRecord } from './BackupStorage';

export class TauriBackupStorage implements IBackupStorage {
  private static instance: TauriBackupStorage | null = null;
  private memoryCache: Map<string, StoredBackupRecord> = new Map();

  public static getInstance(): TauriBackupStorage {
    if (!TauriBackupStorage.instance) {
      TauriBackupStorage.instance = new TauriBackupStorage();
    }
    return TauriBackupStorage.instance;
  }

  public async saveBackupFile(id: string, filename: string, bytes: Uint8Array): Promise<string> {
    const record: StoredBackupRecord = {
      id,
      filename,
      bytes: new Uint8Array(bytes),
      sizeBytes: bytes.byteLength,
      createdAt: new Date().toISOString(),
    };

    this.memoryCache.set(id, record);
    this.memoryCache.set(filename, record);

    try {
      const { writeFile, BaseDirectory, mkdir } = await import('@tauri-apps/plugin-fs');
      // Ensure backups directory exists
      await mkdir('backups', { baseDir: BaseDirectory.AppData, recursive: true });
      await writeFile(`backups/${filename}`, bytes, { baseDir: BaseDirectory.AppData });
      return `appdata://backups/${filename}`;
    } catch {
      // Fallback path designation if running outside full Tauri container
      return `local://backups/${filename}`;
    }
  }

  public async getBackupBytes(idOrFilename: string): Promise<Uint8Array | null> {
    const cached = this.memoryCache.get(idOrFilename);
    if (cached) {
      return new Uint8Array(cached.bytes);
    }

    try {
      const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const filename = idOrFilename.endsWith('.db') ? idOrFilename : `${idOrFilename}.db`;
      const bytes = await readFile(`backups/${filename}`, { baseDir: BaseDirectory.AppData });
      return new Uint8Array(bytes);
    } catch {
      return null;
    }
  }

  public async deleteBackupFile(idOrFilename: string): Promise<boolean> {
    const existed = this.memoryCache.has(idOrFilename);
    this.memoryCache.delete(idOrFilename);

    try {
      const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const filename = idOrFilename.endsWith('.db') ? idOrFilename : `${idOrFilename}.db`;
      await remove(`backups/${filename}`, { baseDir: BaseDirectory.AppData });
      return true;
    } catch {
      return existed;
    }
  }

  public async listBackupFiles(): Promise<Array<Omit<StoredBackupRecord, 'bytes'>>> {
    const list: Array<Omit<StoredBackupRecord, 'bytes'>> = [];

    try {
      const { readDir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir('backups', { baseDir: BaseDirectory.AppData });

      for (const entry of entries) {
        if (entry.name && entry.name.endsWith('.db')) {
          list.push({
            id: entry.name.replace('.db', ''),
            filename: entry.name,
            sizeBytes: 0,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Return memory cache entries
      for (const [key, val] of this.memoryCache.entries()) {
        if (key === val.id) {
          list.push({
            id: val.id,
            filename: val.filename,
            sizeBytes: val.sizeBytes,
            createdAt: val.createdAt,
          });
        }
      }
    }

    return list;
  }

  public async clearAll(): Promise<void> {
    this.memoryCache.clear();
  }

  /**
   * Prompts user with native Windows save dialog to export backup to USB flash drive or custom directory.
   */
  public async promptExportToExternal(filename: string, bytes: Uint8Array): Promise<string | null> {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      const selectedPath = await save({
        defaultPath: filename,
        filters: [{ name: 'نسخة احتياطية لقاعدة البيانات (SQLite)', extensions: ['db'] }],
      });

      if (!selectedPath) {
        return null; // User cancelled
      }

      await writeFile(selectedPath, bytes);
      return selectedPath;
    } catch (err: unknown) {
      throw new Error(`فشل تصدير النسخة الاحتياطية إلى المسار المحدد: ${errorMessage(err, String(err))}`);
    }
  }

  /**
   * Prompts user with native Windows file picker to import an external .db backup file.
   */
  public async promptImportFromExternal(): Promise<{ filename: string; bytes: Uint8Array } | null> {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readFile } = await import('@tauri-apps/plugin-fs');

      const selectedPath = await open({
        multiple: false,
        filters: [{ name: 'نسخة احتياطية لقاعدة البيانات (SQLite)', extensions: ['db'] }],
      });

      if (!selectedPath || typeof selectedPath !== 'string') {
        return null;
      }

      const bytes = await readFile(selectedPath);
      const filename = selectedPath.split(/[/\\]/).pop() || 'imported_backup.db';

      return {
        filename,
        bytes: new Uint8Array(bytes),
      };
    } catch (err: unknown) {
      throw new Error(`فشل استيراد النسخة الاحتياطية من المسار المحدد: ${errorMessage(err, String(err))}`);
    }
  }
}
