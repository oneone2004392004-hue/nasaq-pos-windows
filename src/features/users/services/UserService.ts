import { DatabaseManager } from '../../../database/DatabaseManager';
import { UserRepository, IUserRepository } from '../../../repositories/UserRepository';
import { RoleRepository } from '../../../repositories/RoleRepository';
import { AuditLogRepository, IAuditLogRepository } from '../../../repositories/AuditLogRepository';
import { AuthenticatedUser } from '../../auth/types';
import { requirePermission, requireAnyPermission } from '../../auth/utils/permissions';
import { UserRow } from '../../../domain/dbModels';
import { ValidationError, ConflictError, NotFoundError } from '../../../database/errors';
import { defaultPasswordHasher, IPasswordHasher } from '../../../security/PasswordHasher';
import { generateId } from '../../../utils/id';

export interface CreateUserDTO { username: string; name: string; roleId: string; password: string; }
export interface UpdateUserDTO { name?: string; roleId?: string; }

export class UserService {
  private userRepo: IUserRepository;
  private auditRepo: IAuditLogRepository;
  private hasher: IPasswordHasher;

  constructor(userRepo?: IUserRepository, auditRepo?: IAuditLogRepository, hasher?: IPasswordHasher) {
    this.userRepo = userRepo || new UserRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
    this.hasher = hasher || defaultPasswordHasher;
  }

  public async list(user: AuthenticatedUser): Promise<UserRow[]> {
    requirePermission(user, 'users.manage', this.auditRepo);
    return new UserRepository().listAll();
  }

  public async listRoles(user: AuthenticatedUser) {
    requirePermission(user, 'users.manage', this.auditRepo);
    return new RoleRepository().listAll();
  }

  public async create(user: AuthenticatedUser, input: CreateUserDTO): Promise<UserRow> {
    requirePermission(user, 'users.manage', this.auditRepo);
    const username = input.username.trim();
    const name = input.name.trim();
    if (!username || !name || input.password.length < 6) throw new ValidationError('اسم المستخدم والاسم وكلمة المرور (6 خانات على الأقل) مطلوبة.');
    const role = await new RoleRepository().findById(input.roleId);
    if (!role) throw new NotFoundError('الدور', input.roleId);
    if (await new UserRepository().findByUsername(username)) throw new ConflictError('اسم المستخدم مستخدم بالفعل.');
    const now = new Date().toISOString();
    const created = await new UserRepository().create({
      id: generateId('usr'), username, name, role_id: role.id,
      password_hash: await this.hasher.hash(input.password), is_active: 1,
      failed_login_attempts: 0, locked_until: null, last_login_at: null,
      created_at: now, updated_at: now,
    });
    await this.auditRepo.log('USER_CREATED', 'user', created.id, user.id, { username, role: role.code });
    return created;
  }

  public async update(user: AuthenticatedUser, id: string, input: UpdateUserDTO): Promise<UserRow> {
    requirePermission(user, 'users.manage', this.auditRepo);
    if (input.roleId) {
      const role = await new RoleRepository().findById(input.roleId);
      if (!role) throw new NotFoundError('الدور', input.roleId);
    }
    return DatabaseManager.getInstance().transaction(async (tx) => {
      const users = new UserRepository(tx);
      const roles = new RoleRepository(tx);
      const existing = await users.findById(id);
      if (!existing) throw new NotFoundError('المستخدم', id);
      const oldRole = await roles.findById(existing.role_id);
      const newRole = input.roleId ? await roles.findById(input.roleId) : oldRole;
      if (oldRole?.code === 'ADMIN' && newRole?.code !== 'ADMIN' && await users.countActiveAdmins() <= 1) {
        throw new ConflictError('لا يمكن إزالة دور آخر مسؤول نشط في النظام.');
      }
      const updated = await users.update(id, { name: input.name?.trim() || existing.name, role_id: input.roleId || existing.role_id, updated_at: new Date().toISOString() });
      await new AuditLogRepository(tx).log('USER_UPDATED', 'user', id, user.id, { old_role: oldRole?.code, new_role: newRole?.code, old_name: existing.name, new_name: updated.name });
      return updated;
    });
  }

  public async setActive(user: AuthenticatedUser, id: string, active: boolean): Promise<UserRow> {
    requirePermission(user, 'users.manage', this.auditRepo);
    if (id === user.id && !active) throw new ConflictError('لا يمكن للمستخدم تعطيل حسابه بنفسه.');
    return DatabaseManager.getInstance().transaction(async (tx) => {
      const users = new UserRepository(tx);
      const roles = new RoleRepository(tx);
      const existing = await users.findById(id);
      if (!existing) throw new NotFoundError('المستخدم', id);
      const role = await roles.findById(existing.role_id);
      if (!active && role?.code === 'ADMIN' && await users.countActiveAdmins() <= 1) {
        throw new ConflictError('لا يمكن تعطيل آخر مسؤول نشط في النظام.');
      }
      const updated = await users.update(id, { is_active: active ? 1 : 0, updated_at: new Date().toISOString() });
      await new AuditLogRepository(tx).log(active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'user', id, user.id, { username: existing.username });
      return updated;
    });
  }

  public async resetPassword(user: AuthenticatedUser, id: string, password: string): Promise<void> {
    requireAnyPermission(user, ['users.reset_password', 'users.manage'], this.auditRepo);
    if (password.length < 6) throw new ValidationError('كلمة المرور يجب ألا تقل عن 6 خانات.');
    const target = await new UserRepository().findById(id);
    if (!target) throw new NotFoundError('المستخدم', id);
    await new UserRepository().updatePassword(id, await this.hasher.hash(password));
    await this.auditRepo.log('USER_PASSWORD_RESET_BY_ADMIN', 'user', id, user.id, { username: target.username });
  }
}
