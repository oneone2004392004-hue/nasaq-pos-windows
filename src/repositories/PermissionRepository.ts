import { BaseRepository } from './BaseRepository';
import { PermissionRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IPermissionRepository {
  findById(id: string): Promise<PermissionRow | null>;
  findByCode(code: string): Promise<PermissionRow | null>;
  listAll(): Promise<PermissionRow[]>;
  getByModule(module: string): Promise<PermissionRow[]>;
  getForRole(roleId: string): Promise<PermissionRow[]>;
}

export class PermissionRepository extends BaseRepository<PermissionRow> implements IPermissionRepository {
  constructor(executor?: ISqlExecutor) {
    super('permissions', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new PermissionRepository(executor) as this;
  }

  public async findByCode(code: string): Promise<PermissionRow | null> {
    return await this.executor.queryOne<PermissionRow>(
      'SELECT * FROM permissions WHERE code = ?;',
      [code]
    );
  }

  public async listAll(): Promise<PermissionRow[]> {
    return await this.executor.query<PermissionRow>(
      'SELECT * FROM permissions ORDER BY module, code ASC;'
    );
  }

  public async getByModule(module: string): Promise<PermissionRow[]> {
    return await this.executor.query<PermissionRow>(
      'SELECT * FROM permissions WHERE module = ? ORDER BY code ASC;',
      [module]
    );
  }

  public async getForRole(roleId: string): Promise<PermissionRow[]> {
    return await this.executor.query<PermissionRow>(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.module, p.code;`,
      [roleId]
    );
  }
}
