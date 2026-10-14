import { BaseRepository } from './BaseRepository';
import { AuditLogRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';
import { generateId } from '../utils/id';

export interface IAuditLogRepository {
  findById(id: string): Promise<AuditLogRow | null>;
  findByEntity(entityType: string, entityId: string): Promise<AuditLogRow[]>;
  listRecent(limit?: number): Promise<AuditLogRow[]>;
  log(
    action: string,
    entityType: string,
    entityId: string,
    userId?: string | null,
    details?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void>;
}

export class AuditLogRepository extends BaseRepository<AuditLogRow> implements IAuditLogRepository {
  constructor(executor?: ISqlExecutor) {
    super('audit_logs', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new AuditLogRepository(executor) as this;
  }

  public async listRecent(limit: number = 100): Promise<AuditLogRow[]> {
    return await this.executor.query<AuditLogRow>(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?;',
      [limit]
    );
  }

  public async findByEntity(entityType: string, entityId: string): Promise<AuditLogRow[]> {
    return await this.executor.query<AuditLogRow>(
      'SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC;',
      [entityType, entityId]
    );
  }

  public async log(
    action: string,
    entityType: string,
    entityId: string,
    userId?: string | null,
    details?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    const id = generateId('audit');
    const now = new Date().toISOString();
    const detailsJson = details ? JSON.stringify(details) : null;

    await this.executor.execute(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details_json, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [id, userId || null, action, entityType, entityId, detailsJson, ipAddress || null, now]
    );
  }
}
