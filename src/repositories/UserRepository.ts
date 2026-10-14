import { BaseRepository } from './BaseRepository';
import { UserRow } from '../domain/dbModels';
import { ISqlExecutor } from '../database/contracts';

export interface IUserRepository {
  findById(id: string): Promise<UserRow | null>;
  findByUsername(username: string): Promise<UserRow | null>;
  findWithRole(id: string): Promise<(UserRow & { role_name: string; role_code: string }) | null>;
  listActive(): Promise<UserRow[]>;
  listAll(): Promise<UserRow[]>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  create(user: UserRow): Promise<UserRow>;
  update(id: string, updates: Partial<UserRow>): Promise<UserRow>;
  deactivate(id: string): Promise<boolean>;
  incrementFailedAttempts(id: string): Promise<number>;
  lockAccount(id: string, lockUntil: string): Promise<void>;
  resetFailedAttemptsAndSetLogin(id: string): Promise<void>;
  countUsers(): Promise<number>;
  countActiveAdmins(): Promise<number>;
}

export class UserRepository extends BaseRepository<UserRow> implements IUserRepository {
  constructor(executor?: ISqlExecutor) {
    super('users', executor);
  }

  public withTransaction(executor: ISqlExecutor): this {
    return new UserRepository(executor) as this;
  }

  public async findByUsername(username: string): Promise<UserRow | null> {
    return await this.executor.queryOne<UserRow>(
      'SELECT * FROM users WHERE username = ?;',
      [username]
    );
  }

  public async findWithRole(id: string): Promise<(UserRow & { role_name: string; role_code: string }) | null> {
    return await this.executor.queryOne<UserRow & { role_name: string; role_code: string }>(
      `SELECT u.*, r.name AS role_name, r.code AS role_code
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?;`,
      [id]
    );
  }

  public async listActive(): Promise<UserRow[]> {
    return await this.executor.query<UserRow>(
      'SELECT * FROM users WHERE is_active = 1 ORDER BY name ASC;'
    );
  }

  public async listAll(): Promise<UserRow[]> {
    return await this.executor.query<UserRow>('SELECT * FROM users ORDER BY name ASC;');
  }

  public async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.update(id, {
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    });
  }

  public async incrementFailedAttempts(id: string): Promise<number> {
    await this.executor.execute(
      `UPDATE users
       SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
           updated_at = ?
       WHERE id = ?;`,
      [new Date().toISOString(), id]
    );

    const row = await this.executor.queryOne<{ failed_login_attempts: number }>(
      'SELECT failed_login_attempts FROM users WHERE id = ?;',
      [id]
    );
    return row ? row.failed_login_attempts : 1;
  }

  public async lockAccount(id: string, lockUntil: string): Promise<void> {
    await this.executor.execute(
      `UPDATE users
       SET locked_until = ?,
           updated_at = ?
       WHERE id = ?;`,
      [lockUntil, new Date().toISOString(), id]
    );
  }

  public async resetFailedAttemptsAndSetLogin(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.executor.execute(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_login_at = ?,
           updated_at = ?
       WHERE id = ?;`,
      [now, now, id]
    );
  }

  public async countUsers(): Promise<number> {
    const row = await this.executor.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM users;'
    );
    return row ? row.cnt : 0;
  }

  public async countActiveAdmins(): Promise<number> {
    const row = await this.executor.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.is_active = 1 AND r.code = 'ADMIN';`
    );
    return row ? Number(row.cnt) : 0;
  }
}
