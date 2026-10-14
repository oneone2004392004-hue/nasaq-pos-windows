import { BaseRepository } from './BaseRepository';
import { RoleRow, PermissionRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IRoleRepository {
  findById(id: string): Promise<RoleRow | null>;
  findByCode(code: string): Promise<RoleRow | null>;
  listAll(): Promise<RoleRow[]>;
  getRoleWithPermissions(roleId: string): Promise<{ role: RoleRow; permissions: PermissionRow[] } | null>;
  assignPermissions(roleId: string, permissionIds: string[]): Promise<void>;
  create(role: RoleRow): Promise<RoleRow>;
  update(id: string, updates: Partial<RoleRow>): Promise<RoleRow>;
}

export class RoleRepository extends BaseRepository<RoleRow> implements IRoleRepository {
  constructor(executor?: ISqlExecutor) {
    super('roles', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new RoleRepository(executor) as this;
  }

  public async findByCode(code: string): Promise<RoleRow | null> {
    return await this.executor.queryOne<RoleRow>(
      'SELECT * FROM roles WHERE code = ?;',
      [code]
    );
  }

  public async listAll(): Promise<RoleRow[]> {
    return await this.executor.query<RoleRow>('SELECT * FROM roles ORDER BY name ASC;');
  }

  public async getRoleWithPermissions(roleId: string): Promise<{ role: RoleRow; permissions: PermissionRow[] } | null> {
    const role = await this.findById(roleId);
    if (!role) return null;

    const permissions = await this.executor.query<PermissionRow>(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.module, p.code;`,
      [roleId]
    );

    return { role, permissions };
  }

  public async assignPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.executor.execute('DELETE FROM role_permissions WHERE role_id = ?;', [roleId]);
    for (const permId of permissionIds) {
      await this.executor.execute(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?);',
        [roleId, permId]
      );
    }
  }
}
