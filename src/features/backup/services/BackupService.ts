import { logger } from '../../../utils/logger';
/**
 * NASAQ POS — Offline Local Backup & Recovery Service
 *
 * Implements full database backup creation, validation, and safe restore pipeline:
 * 1. Consistent SQLite binary export
 * 2. Deterministic readable naming (nasaq-backup-YYYY-MM-DD-HH-mm-ss.db)
 * 3. Pre-restore validation: header, PRAGMA integrity_check, foreign keys, schema migrations, core tables
 * 4. Open-shift safety check (strictly blocks restore while a cash shift is open)
 * 5. Automatic pre-restore safety backup creation
 * 6. Atomic database swap with automatic rollback on failure
 * 7. RBAC security enforcement (system.backup, system.restore)
 * 8. Comprehensive audit logging (BACKUP_CREATED, BACKUP_RESTORE_STARTED, BACKUP_RESTORE_SUCCESS, BACKUP_RESTORE_FAILED, BACKUP_DELETED)
 * 9. Financial calculation neutrality (zero changes to financial formulas or records)
 */

import { DatabaseManager } from '../../../database/DatabaseManager';
import { IBackupRepository, BackupRepository } from '../../../repositories/BackupRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { IShiftRepository, ShiftRepository } from '../../../repositories/ShiftRepository';
import { IBackupStorage, LocalBackupStorage } from './BackupStorage';
import { TauriBackupStorage } from './TauriBackupStorage';
import { isTauriRuntime } from '../../../database/drivers/DriverFactory';
import { AuthenticatedUser } from '../../auth/types';
import { requirePermission } from '../../auth/utils/permissions';
import { BackupRow } from '../../../domain/dbModels';
import { ConflictError, NotFoundError, ValidationError } from '../../../database/errors';
import { generateId } from '../../../utils/id';
import { WasmSqliteDriver } from '../../../database/drivers/WasmSqliteDriver';

export interface BackupValidationResult {
  isValid: boolean;
  sizeBytes: number;
  tablesCount: number;
  migrationsCount: number;
  lastMigrationVersion: number;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredBackupId: string;
  filename: string;
  safetyBackupId: string;
  safetyBackupFilename: string;
  message: string;
}

export function generateBackupFilename(date = new Date(), suffix = ''): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const base = `nasaq-backup-${yyyy}-${MM}-${dd}-${hh}-${mm}-${ss}`;
  return suffix ? `${base}-${suffix}.db` : `${base}.db`;
}

// 16-byte SQLite 3 magic header: "SQLite format 3\0"
const SQLITE_HEADER = new Uint8Array([
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
]);


import { BackupServiceCore } from './BackupServiceCore';

export class BackupService extends BackupServiceCore {
  public async getBackupBytes(user: AuthenticatedUser, backupIdOrFilename: string): Promise<Uint8Array> {
    requirePermission(user, 'system.backup', this.auditRepo);

    let bytes = await this.storage.getBackupBytes(backupIdOrFilename);
    if (!bytes) {
      const record =
        (await this.backupRepo.findById(backupIdOrFilename)) ||
        (await this.backupRepo.findByFilename(backupIdOrFilename));
      if (record) {
        bytes = (await this.storage.getBackupBytes(record.id)) || (await this.storage.getBackupBytes(record.filename));
      }
    }

    if (!bytes) {
      throw new NotFoundError('ملف النسخة الاحتياطية', backupIdOrFilename);
    }

    return bytes;
  }

  /**
   * Lists all available backups, merging database records and physical offline storage.
   */
  public async listBackups(user: AuthenticatedUser): Promise<BackupRow[]> {
    requirePermission(user, 'system.backup', this.auditRepo);

    const dbBackups = await this.backupRepo.listRecent(50);
    const storedFiles = await this.storage.listBackupFiles();

    const seenIds = new Set<string>();
    const seenFilenames = new Set<string>();
    const combined: BackupRow[] = [];

    for (const b of dbBackups) {
      seenIds.add(b.id);
      seenFilenames.add(b.filename);
      combined.push(b);
    }

    // Include all physical files stored locally that might not be in the current database table
    for (const file of storedFiles) {
      if (!seenIds.has(file.id) && !seenFilenames.has(file.filename)) {
        combined.push({
          id: file.id,
          filename: file.filename,
          filepath: `local://backups/${file.filename}`,
          size_bytes: file.sizeBytes,
          backup_type: file.filename.includes('safety') ? 'MANUAL' : 'MANUAL',
          status: 'CREATED',
          created_at: file.createdAt,
        });
      }
    }

    // Sort by created_at DESC
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return combined;
  }

  /**
   * Deletes an old backup file and removes its metadata.
   * Requires system.restore permission.
   */
  public async deleteBackup(user: AuthenticatedUser, backupIdOrFilename: string): Promise<void> {
    requirePermission(user, 'system.restore', this.auditRepo);

    const record =
      (await this.backupRepo.findById(backupIdOrFilename)) ||
      (await this.backupRepo.findByFilename(backupIdOrFilename));

    const id = record ? record.id : backupIdOrFilename;
    const filename = record ? record.filename : backupIdOrFilename;

    // Remove from physical storage
    await this.storage.deleteBackupFile(id);
    await this.storage.deleteBackupFile(filename);

    // Remove from database table if present
    if (record) {
      await this.backupRepo.delete(record.id);
    }

    // Record audit log
    await this.auditRepo.log('BACKUP_DELETED', 'backup', id, user.id, {
      filename,
    });
  }

  /**
   * Exports an existing backup to an external location (e.g., USB drive, Desktop) via native save dialog.
   */
  public async exportBackupToExternal(
    user: AuthenticatedUser,
    backupIdOrFilename: string
  ): Promise<string | null> {
    requirePermission(user, 'system.backup', this.auditRepo);
    const bytes = await this.getBackupBytes(user, backupIdOrFilename);
    if (!bytes) {
      throw new NotFoundError('ملف النسخة الاحتياطية غير موجود للتصدير.');
    }

    const record =
      (await this.backupRepo.findById(backupIdOrFilename)) ||
      (await this.backupRepo.findByFilename(backupIdOrFilename));
    const filename = record
      ? record.filename
      : backupIdOrFilename.endsWith('.db')
      ? backupIdOrFilename
      : `${backupIdOrFilename}.db`;

    if (this.storage instanceof TauriBackupStorage) {
      const savedPath = await this.storage.promptExportToExternal(filename, bytes);
      if (savedPath) {
        await this.auditRepo.log('BACKUP_EXPORTED_EXTERNAL', 'backup', backupIdOrFilename, user.id, {
          targetPath: savedPath,
        });
      }
      return savedPath;
    }

    return null;
  }

  /**
   * Imports an external backup file (.db) via native file picker dialog and stores it locally.
   */
  public async importBackupFromExternal(user: AuthenticatedUser): Promise<BackupRow | null> {
    requirePermission(user, 'system.restore', this.auditRepo);

    if (this.storage instanceof TauriBackupStorage) {
      const imported = await this.storage.promptImportFromExternal();
      if (!imported) return null;

      // Validate the imported file
      const validation = await this.validateBackupBytes(imported.bytes);
      if (!validation.isValid) {
        throw new ValidationError(`ملف النسخة الاحتياطية المحدد غير صالح: ${validation.error}`);
      }

      const backupId = generateId('bkp');
      const filepath = await this.storage.saveBackupFile(backupId, imported.filename, imported.bytes);

      const record: BackupRow = {
        id: backupId,
        filename: imported.filename,
        filepath,
        size_bytes: imported.bytes.byteLength,
        backup_type: 'MANUAL',
        status: 'CREATED',
        created_at: new Date().toISOString(),
      };

      await this.backupRepo.create(record);
      await this.auditRepo.log('BACKUP_IMPORTED_EXTERNAL', 'backup', backupId, user.id, {
        filename: imported.filename,
        sizeBytes: imported.bytes.byteLength,
      });

      return record;
    }

    return null;
  }
}
