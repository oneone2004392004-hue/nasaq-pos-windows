import { BaseRepository } from './BaseRepository';
import { BackupRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IBackupRepository {
  findById(id: string): Promise<BackupRow | null>;
  findByFilename(filename: string): Promise<BackupRow | null>;
  listRecent(limit?: number): Promise<BackupRow[]>;
  create(backup: BackupRow): Promise<BackupRow>;
  updateStatus(id: string, status: BackupRow['status']): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export class BackupRepository extends BaseRepository<BackupRow> implements IBackupRepository {
  constructor(executor?: ISqlExecutor) {
    super('backups', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new BackupRepository(executor) as this;
  }

  public async findByFilename(filename: string): Promise<BackupRow | null> {
    return await this.executor.queryOne<BackupRow>(
      'SELECT * FROM backups WHERE filename = ? LIMIT 1;',
      [filename]
    );
  }

  public async listRecent(limit: number = 20): Promise<BackupRow[]> {
    return await this.executor.query<BackupRow>(
      'SELECT * FROM backups ORDER BY created_at DESC LIMIT ?;',
      [limit]
    );
  }

  public async updateStatus(id: string, status: BackupRow['status']): Promise<void> {
    await this.executor.execute(
      'UPDATE backups SET status = ? WHERE id = ?;',
      [status, id]
    );
  }

  public override async delete(id: string): Promise<boolean> {
    return await super.delete(id);
  }
}
