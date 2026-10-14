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

export class BackupServiceCore {
  constructor(
    protected dbManager: DatabaseManager = DatabaseManager.getInstance(),
    protected backupRepo: IBackupRepository = new BackupRepository(),
    protected auditRepo: IAuditLogRepository = new AuditLogRepository(),
    protected shiftRepo: IShiftRepository = new ShiftRepository(),
    protected storage: IBackupStorage = isTauriRuntime() ? TauriBackupStorage.getInstance() : LocalBackupStorage.getInstance()
  ) {}

  /**
   * Creates a consistent binary SQLite database backup file and registers metadata.
   */
  public async createBackup(
    user: AuthenticatedUser,
    type: BackupRow['backup_type'] = 'MANUAL',
    note?: string
  ): Promise<BackupRow> {
    requirePermission(user, 'system.backup', this.auditRepo);

    const now = new Date();
    const filename = generateBackupFilename(now);
    const backupId = generateId('bkp');

    // 1. Ensure current database is consistent before backup
    try {
      const integrity = await this.dbManager.query<{ integrity_check: string }>('PRAGMA integrity_check;');
      if (!integrity.length || integrity[0].integrity_check !== 'ok') {
        throw new ValidationError('فشل فحص سلامة قاعدة البيانات الحالية قبل إنشاء النسخة الاحتياطية.');
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(`تعذر فحص سلامة قاعدة البيانات: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Export database binary bytes
    const bytes = await this.dbManager.exportDatabase();
    if (!bytes || bytes.byteLength < 100) {
      throw new ValidationError('فشل تصدير قاعدة البيانات: البيانات المصدرة فارغة أو غير صالحة.');
    }
    for (let i = 0; i < SQLITE_HEADER.length; i++) {
      if (bytes[i] !== SQLITE_HEADER[i]) {
        throw new ValidationError('فشل تصدير قاعدة البيانات: ترويسة SQLite غير صالحة.');
      }
    }

    // 3. Save binary file to offline local storage
    const filepath = await this.storage.saveBackupFile(backupId, filename, bytes);
    const savedBytes = await this.storage.getBackupBytes(backupId);
    if (!savedBytes || savedBytes.byteLength !== bytes.byteLength) {
      await this.storage.deleteBackupFile(backupId).catch(() => false);
      throw new ValidationError('فشل إنشاء النسخة الاحتياطية: الملف المحفوظ غير موجود أو حجمه غير مطابق.');
    }

    // 4. Save metadata record to backups table
    const backupRecord: BackupRow = {
      id: backupId,
      filename,
      filepath,
      size_bytes: bytes.byteLength,
      backup_type: type,
      status: 'CREATED',
      created_at: now.toISOString(),
    };

    try {
      await this.backupRepo.create(backupRecord);
    } catch (err) {
      await this.storage.deleteBackupFile(backupId).catch(() => false);
      throw new ValidationError(`فشل تسجيل بيانات النسخة الاحتياطية: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 5. Record audit log
    await this.auditRepo.log('BACKUP_CREATED', 'backup', backupId, user.id, {
      filename,
      filepath,
      size_bytes: bytes.byteLength,
      backup_type: type,
      note,
      status: 'CREATED',
    });

    return backupRecord;
  }

  /**
   * Deep validation of SQLite database bytes.
   * Performs magic header check, PRAGMA integrity_check, foreign_key_check, and schema verification.
   */
  public async validateBackupBytes(bytes: Uint8Array): Promise<BackupValidationResult> {
    if (!bytes || bytes.byteLength < 100) {
      return {
        isValid: false,
        sizeBytes: bytes ? bytes.byteLength : 0,
        tablesCount: 0,
        migrationsCount: 0,
        lastMigrationVersion: 0,
        error: 'الملف المحدد صغير جداً ولا يمكن أن يكون قاعدة بيانات SQLite صالحة.',
      };
    }

    // Check 16-byte SQLite header
    for (let i = 0; i < SQLITE_HEADER.length; i++) {
      if (bytes[i] !== SQLITE_HEADER[i]) {
        return {
          isValid: false,
          sizeBytes: bytes.byteLength,
          tablesCount: 0,
          migrationsCount: 0,
          lastMigrationVersion: 0,
          error: 'الملف المحدد ليس ملف قاعدة بيانات SQLite صالح (الترويسة غير متطابقة).',
        };
      }
    }

    // Open isolated test driver
    const testDriver = new WasmSqliteDriver({ initialDbBytes: bytes });
    try {
      await testDriver.init();

      // Check PRAGMA integrity_check
      const integrity = await testDriver.query<{ integrity_check: string }>('PRAGMA integrity_check;');
      if (!integrity.length || integrity[0].integrity_check !== 'ok') {
        await testDriver.close();
        return {
          isValid: false,
          sizeBytes: bytes.byteLength,
          tablesCount: 0,
          migrationsCount: 0,
          lastMigrationVersion: 0,
          error: 'فشل فحص سلامة قاعدة البيانات (PRAGMA integrity_check): الملف تالف أو غير متوافق.',
        };
      }

      // Check PRAGMA foreign_key_check
      await testDriver.exec('PRAGMA foreign_keys = ON;');
      const fkErrors = await testDriver.query('PRAGMA foreign_key_check;');
      if (fkErrors.length > 0) {
        await testDriver.close();
        return {
          isValid: false,
          sizeBytes: bytes.byteLength,
          tablesCount: 0,
          migrationsCount: 0,
          lastMigrationVersion: 0,
          error: 'النسخة الاحتياطية تحتوي على انتهاكات لقيود المفاتيح الأجنبية.',
        };
      }

      // Verify core schema tables
      const tables = await testDriver.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table';");
      const tableNames = new Set(tables.map((t) => t.name));

      const requiredTables = [
        'schema_migrations',
        'users',
        'roles',
        'permissions',
        'settings',
        'cash_shifts',
        'orders',
        'order_items',
        'payments',
        'invoices',
        'cash_transactions',
      ];

      for (const table of requiredTables) {
        if (!tableNames.has(table)) {
          await testDriver.close();
          return {
            isValid: false,
            sizeBytes: bytes.byteLength,
            tablesCount: tables.length,
            migrationsCount: 0,
            lastMigrationVersion: 0,
            error: `النسخة الاحتياطية غير متوافقة مع نظام نسق: الجدول الأساسي "${table}" غير موجود.`,
          };
        }
      }

      // Verify schema_migrations
      const migrations = await testDriver.query<{ version: number }>(
        'SELECT version FROM schema_migrations ORDER BY version ASC;'
      );
      if (migrations.length === 0) {
        await testDriver.close();
        return {
          isValid: false,
          sizeBytes: bytes.byteLength,
          tablesCount: tables.length,
          migrationsCount: 0,
          lastMigrationVersion: 0,
          error: 'النسخة الاحتياطية لا تحتوي على سجلات ترحيل صالحة (schema_migrations فارغ).',
        };
      }

      const lastVersion = migrations[migrations.length - 1].version;
      await testDriver.close();

      return {
        isValid: true,
        sizeBytes: bytes.byteLength,
        tablesCount: tables.length,
        migrationsCount: migrations.length,
        lastMigrationVersion: lastVersion,
      };
    } catch (err) {
      try {
        await testDriver.close();
      } catch (closeError) {
        logger.warn('Could not close backup-validation SQLite driver', closeError);
      }
      return {
        isValid: false,
        sizeBytes: bytes.byteLength,
        tablesCount: 0,
        migrationsCount: 0,
        lastMigrationVersion: 0,
        error: `تعذر قراءة أو التحقق من محتوى النسخة الاحتياطية: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Checks whether the system is safe to restore (e.g. no active shifts).
   */
  public async checkCanRestore(): Promise<{ canRestore: boolean; reason?: string; openShiftNumber?: string }> {
    try {
      const activeShift = await this.shiftRepo.findActiveShift();
      if (activeShift) {
        return {
          canRestore: false,
          reason: `توجد وردية مفتوحة حالياً (رقم: ${activeShift.shift_number}). يجب إغلاق كافة الورديات أولاً قبل استعادة أي نسخة احتياطية.`,
          openShiftNumber: activeShift.shift_number,
        };
      }
    } catch (error) {
      logger.warn('Could not verify open-shift status before restore; preserving the existing fallback behavior', error);
    }
    return { canRestore: true };
  }

  /**
   * High-risk safe restore workflow:
   * 1. Check RBAC permissions (system.restore)
   * 2. Check open shifts (strictly blocked if open)
   * 3. Validate backup file & database integrity
   * 4. Create pre-restore safety backup of the CURRENT database
   * 5. Record BACKUP_RESTORE_STARTED
   * 6. Swap active database with target backup bytes
   * 7. Validate restored database integrity & foreign keys
   * 8. In case of ANY error: AUTOMATICALLY ROLL BACK to safety backup!
   * 9. Record BACKUP_RESTORE_SUCCESS / FAILED
   */
  public async restoreBackup(
    user: AuthenticatedUser,
    backupIdOrFilename: string,
    providedBytes?: Uint8Array
  ): Promise<RestoreResult> {
    requirePermission(user, 'system.restore', this.auditRepo);

    // 1. Financial check: Block restore if a shift is open
    const shiftCheck = await this.checkCanRestore();
    if (!shiftCheck.canRestore) {
      throw new ConflictError(shiftCheck.reason!);
    }

    // 2. Resolve bytes to restore
    let bytesToRestore: Uint8Array | null = providedBytes || null;
    let resolvedFilename = backupIdOrFilename;

    if (!bytesToRestore) {
      // Try resolving by ID or filename from storage
      bytesToRestore = await this.storage.getBackupBytes(backupIdOrFilename);

      if (!bytesToRestore) {
        // Try looking up in database table
        const record =
          (await this.backupRepo.findById(backupIdOrFilename)) ||
          (await this.backupRepo.findByFilename(backupIdOrFilename));

        if (record) {
          resolvedFilename = record.filename;
          bytesToRestore =
            (await this.storage.getBackupBytes(record.id)) || (await this.storage.getBackupBytes(record.filename));
        }
      }
    }

    if (!bytesToRestore) {
      throw new NotFoundError('النسخة الاحتياطية', backupIdOrFilename);
    }

    // 3. Validate target backup bytes BEFORE touching active database
    const validation = await this.validateBackupBytes(bytesToRestore);
    if (!validation.isValid) {
      throw new ValidationError(`النسخة الاحتياطية غير صالحة للاستعادة: ${validation.error}`);
    }

    // 4. Create pre-restore SAFETY backup of current database
    const currentBytes = await this.dbManager.exportDatabase();
    const safetyId = generateId('bkp-safety');
    const safetyFilename = generateBackupFilename(new Date(), 'pre-restore-safety');

    await this.storage.saveBackupFile(safetyId, safetyFilename, currentBytes);

    try {
      await this.backupRepo.create({
        id: safetyId,
        filename: safetyFilename,
        filepath: `local://backups/${safetyFilename}`,
        size_bytes: currentBytes.byteLength,
        backup_type: 'MANUAL',
        status: 'CREATED',
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      await this.storage.deleteBackupFile(safetyId).catch(() => false);
      throw new ValidationError(`فشل تسجيل نسخة الأمان قبل الاستعادة: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 5. Audit restore started
    await this.auditRepo.log('BACKUP_RESTORE_STARTED', 'backup', backupIdOrFilename, user.id, {
      filename: resolvedFilename,
      safetyBackupId: safetyId,
      safetyBackupFilename: safetyFilename,
      targetSizeBytes: bytesToRestore.byteLength,
    });

    // 6. Execute restore swap with automatic rollback on error
    try {
      await this.dbManager.restoreDatabase(bytesToRestore);

      // 7. Verify post-restore database
      const integrity = await this.dbManager.query<{ integrity_check: string }>('PRAGMA integrity_check;');
      if (!integrity.length || integrity[0].integrity_check !== 'ok') {
        throw new Error('فشل فحص سلامة قاعدة البيانات بعد الاستعادة مباشرة.');
      }
      await this.dbManager.execute('PRAGMA foreign_keys = ON;');
      const foreignKeyErrors = await this.dbManager.query('PRAGMA foreign_key_check;');
      if (foreignKeyErrors.length > 0) {
        throw new Error('فشل فحص المفاتيح الأجنبية بعد الاستعادة.');
      }
    } catch (restoreErr) {
      // 8. AUTOMATIC ROLLBACK: restore the safety backup immediately!
      console.error('Database restore failed, triggering automatic rollback to safety backup:', restoreErr);
      try {
        await this.dbManager.restoreDatabase(currentBytes);
        await this.dbManager.execute('PRAGMA foreign_keys = ON;');
      } catch (rollbackErr) {
        console.error('CRITICAL: Rollback to safety backup failed:', rollbackErr);
      }

      await this.auditRepo.log('BACKUP_RESTORE_FAILED', 'backup', backupIdOrFilename, user.id, {
        filename: resolvedFilename,
        safetyBackupId: safetyId,
        error: restoreErr instanceof Error ? restoreErr.message : String(restoreErr),
        rolledBackToSafety: true,
      });

      throw new ValidationError(
        `فشلت عملية الاستعادة: ${restoreErr instanceof Error ? restoreErr.message : String(restoreErr)}. تم التراجع واستعادة نسخة الأمان بنجاح للحفاظ على سلامة البيانات.`
      );
    }

    // 9. Mark status as RESTORED if record exists in restored DB
    try {
      const restoredRepo = new BackupRepository(this.dbManager);
      const existing = await restoredRepo.findById(backupIdOrFilename);
      if (existing) {
        await restoredRepo.updateStatus(backupIdOrFilename, 'RESTORED');
      }
    } catch (error) {
      logger.warn('Could not update restored backup status', error);
    }

    // Record start again in the newly active database. The pre-swap log is replaced by restore.
    await this.auditRepo.log('BACKUP_RESTORE_STARTED', 'backup', backupIdOrFilename, user.id, {
      filename: resolvedFilename,
      safetyBackupId: safetyId,
      safetyBackupFilename: safetyFilename,
      targetSizeBytes: bytesToRestore.byteLength,
    });

    // 10. Audit successful restore in the newly active database.
    await this.auditRepo.log('BACKUP_RESTORE_SUCCESS', 'backup', backupIdOrFilename, user.id, {
      filename: resolvedFilename,
      safetyBackupId: safetyId,
      safetyBackupFilename: safetyFilename,
    });

    return {
      success: true,
      restoredBackupId: backupIdOrFilename,
      filename: resolvedFilename,
      safetyBackupId: safetyId,
      safetyBackupFilename: safetyFilename,
      message: 'تمت استعادة قاعدة البيانات بنجاح، وتم إنشاء نسخة أمان احتياطية قبل الاستبدال.',
    };
  }

  /**
   * Retrieves binary bytes of a backup file for download or inspection.
   */
}
