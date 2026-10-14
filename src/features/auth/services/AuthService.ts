import { AuthenticatedUser, AuthSession, LoginCredentials, InitialAdminInput } from '../types';
import { ValidationError } from '../errors';
import { RoleCode } from '../../../domain/enums';
import { generateId } from '../../../utils/id';
import { getDeviceId, getStoredActivationKey, verifyActivationKey } from '../../activation/ActivationService';
import { AuthServiceCore, SESSION_DURATION_MS } from './AuthServiceCore';

export interface IAuthService {
  login(credentials: LoginCredentials): Promise<AuthenticatedUser>;
  logout(): Promise<void>;
  lock(): void;
  unlock(password: string): Promise<boolean>;
  changePassword(userId: string, currentPass: string, newPass: string, confirmPass: string): Promise<void>;
  resetPasswordWithActivation(username: string, newPass: string, confirmPass: string, resetActivationKey?: string): Promise<void>;
  setupInitialAdmin(data: InitialAdminInput): Promise<AuthenticatedUser>;
  getCurrentUser(): AuthenticatedUser | null;
  getSession(): AuthSession | null;
  isAuthenticated(): boolean;
  isLocked(): boolean;
  needsFirstRunSetup(): Promise<boolean>;
  restoreSession(): Promise<AuthSession | null>;
}

export class AuthService extends AuthServiceCore implements IAuthService {
  public async setupInitialAdmin(data: InitialAdminInput): Promise<AuthenticatedUser> {
    const username = data.username.trim();
    const name = data.name.trim();
    const password = data.password;
    const confirmPassword = data.confirmPassword;

    if (!username || !name || !password) {
      throw new ValidationError('يرجى إدخال اسم المدير واسم المستخدم وكلمة المرور.');
    }

    if (password.length < 6) {
      throw new ValidationError('يجب ألا تقل كلمة مرور المدير عن 6 خانات.');
    }

    if (password !== confirmPassword) {
      throw new ValidationError('تأكيد كلمة المرور غير متطابق.');
    }

    // Check if admin already exists
    const userCount = await this.userRepo.countUsers();
    if (userCount > 0) {
      const setupSetting = await this.settingsRepo.get('setup_completed');
      if (setupSetting === '1') {
        throw new ValidationError('تم إعداد مسؤول النظام مسبقاً.');
      }
    }

    // Get ADMIN Role
    let adminRole = await this.roleRepo.findByCode('ADMIN');
    if (!adminRole) {
      adminRole = await this.roleRepo.create({
        id: 'role-admin',
        code: 'ADMIN',
        name: 'مدير النظام',
        description: 'صلاحيات كاملة',
        is_system: 1,
        created_at: new Date().toISOString(),
      });
    }

    const passwordHash = await this.hasher.hash(password);
    const now = new Date().toISOString();
    const adminUser = await this.userRepo.create({
      id: generateId('user-admin'),
      username,
      name,
      password_hash: passwordHash,
      role_id: adminRole.id,
      is_active: 1,
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: now,
      created_at: now,
      updated_at: now,
    });

    // Mark setup as completed in settings
    await this.settingsRepo.set('setup_completed', '1', 'اكتمال تهيئة مسؤول النظام');

    // Audit log
    await this.auditRepo.log(
      'FIRST_RUN_ADMIN_SETUP',
      'system',
      adminUser.id,
      adminUser.id,
      { username: adminUser.username, name: adminUser.name }
    );

    // Auto login
    const permissions = await this.permRepo.getForRole(adminRole.id);
    const authUser: AuthenticatedUser = {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      roleId: adminRole.id,
      roleCode: RoleCode.ADMIN,
      roleName: adminRole.name,
      permissions: permissions.map((p) => p.code),
    };

    const session: AuthSession = {
      token: generateId('sess'),
      user: authUser,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION_MS,
      isLocked: false,
    };

    this.saveSessionToStorage(session);
    await this.persistSessionProof(session);
    return authUser;
  }

  public getCurrentUser(): AuthenticatedUser | null {
    return this.currentSession?.user || null;
  }

  public getSession(): AuthSession | null {
    return this.currentSession;
  }

  public isAuthenticated(): boolean {
    return !!this.currentSession && !!this.currentSession.user && Date.now() < (this.currentSession.expiresAt || this.currentSession.createdAt + SESSION_DURATION_MS);
  }

  public isLocked(): boolean {
    return !!this.currentSession && this.currentSession.isLocked;
  }
}

export const defaultAuthService = new AuthService();
