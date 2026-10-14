import { logger } from '../../../utils/logger';
import {
  AuthenticatedUser,
  LoginCredentials,
  AuthSession,
  InitialAdminInput,
} from '../types';
import {
  InvalidCredentialsError,
  AccountLockedError,
  AccountInactiveError,
  UnauthorizedError,
  ValidationError,
} from '../errors';
import { IUserRepository, UserRepository } from '../../../repositories/UserRepository';
import { IRoleRepository, RoleRepository } from '../../../repositories/RoleRepository';
import { IPermissionRepository, PermissionRepository } from '../../../repositories/PermissionRepository';
import { IAuditLogRepository, AuditLogRepository } from '../../../repositories/AuditLogRepository';
import { ISettingsRepository, SettingsRepository } from '../../../repositories/SettingsRepository';
import { IPasswordHasher, defaultPasswordHasher } from '../../../security/PasswordHasher';
import { RoleCode } from '../../../domain/enums';
import { generateId } from '../../../utils/id';
import { getDeviceId, getStoredActivationKey, verifyActivationKey } from '../../activation/ActivationService';


const SESSION_STORAGE_KEY = 'nasaq_pos_auth_session';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function parseActivationResetName(keyName: string | null, username: string): boolean {
  return keyName === `reset:${username}`;
}

export class AuthServiceCore {
  protected userRepo: IUserRepository;
  protected roleRepo: IRoleRepository;
  protected permRepo: IPermissionRepository;
  protected auditRepo: IAuditLogRepository;
  protected settingsRepo: ISettingsRepository;
  protected hasher: IPasswordHasher;

  protected currentSession: AuthSession | null = null;
  protected unlockFailedAttempts = 0;
  protected unlockLockedUntil = 0;

  constructor(
    userRepo?: IUserRepository,
    roleRepo?: IRoleRepository,
    permRepo?: IPermissionRepository,
    auditRepo?: IAuditLogRepository,
    settingsRepo?: ISettingsRepository,
    hasher?: IPasswordHasher
  ) {
    this.userRepo = userRepo || new UserRepository();
    this.roleRepo = roleRepo || new RoleRepository();
    this.permRepo = permRepo || new PermissionRepository();
    this.auditRepo = auditRepo || new AuditLogRepository();
    this.settingsRepo = settingsRepo || new SettingsRepository();
    this.hasher = hasher || defaultPasswordHasher;

    // Attempt restoring memory session from local storage in browser environment
    this.loadSessionFromStorage();
  }

  protected loadSessionFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          this.currentSession = JSON.parse(stored);
        }
      }
    } catch {
      this.currentSession = null;
    }
  }

  protected saveSessionToStorage(session: AuthSession | null): void {
    this.currentSession = session;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (session) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch (error) {
      logger.warn('Could not persist authentication session in local storage', error);
    }
  }

  private async hashSessionToken(token: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  protected async persistSessionProof(session: AuthSession): Promise<void> {
    const hash = await this.hashSessionToken(session.token);
    await this.settingsRepo.set(`auth_session_token_hash:${session.user.id}`, hash, 'إثبات جلسة المصادقة');
    await this.settingsRepo.set(`auth_session_expires:${session.user.id}`, String(session.expiresAt), 'انتهاء جلسة المصادقة');
  }

  public async restoreSession(): Promise<AuthSession | null> {
    this.loadSessionFromStorage();
    if (!this.currentSession) return null;
    const storedHash = await this.settingsRepo.get(`auth_session_token_hash:${this.currentSession.user.id}`);
    const storedExpiry = await this.settingsRepo.get(`auth_session_expires:${this.currentSession.user.id}`);
    const sessionExpiry = this.currentSession.expiresAt || this.currentSession.createdAt + SESSION_DURATION_MS;
    if (!storedHash || storedHash !== await this.hashSessionToken(this.currentSession.token) || storedExpiry !== String(sessionExpiry)) {
      this.saveSessionToStorage(null);
      return null;
    }
    if (Date.now() >= sessionExpiry) {
      await this.settingsRepo.set(`auth_session_token_hash:${this.currentSession.user.id}`, '', 'إبطال جلسة المصادقة');
      await this.settingsRepo.set(`auth_session_expires:${this.currentSession.user.id}`, '', 'إبطال جلسة المصادقة');
      this.saveSessionToStorage(null);
      return null;
    }

    // Verify user is still valid and active in database
    try {
      const dbUser = await this.userRepo.findById(this.currentSession.user.id);
      if (!dbUser || dbUser.is_active !== 1) {
        this.saveSessionToStorage(null);
        return null;
      }

      // Re-fetch role & permissions to reflect changes
      const role = await this.roleRepo.findById(dbUser.role_id);
      const perms = await this.permRepo.getForRole(dbUser.role_id);
      const persistedLockState = await this.settingsRepo.get(`auth_session_locked:${dbUser.id}`);

      this.currentSession = {
        token: this.currentSession.token,
        createdAt: this.currentSession.createdAt,
        expiresAt: this.currentSession.expiresAt,
        isLocked: persistedLockState === '1',
        user: {
        id: dbUser.id,
        username: dbUser.username,
        name: dbUser.name,
        roleId: dbUser.role_id,
        roleCode: (role?.code as RoleCode) || RoleCode.CASHIER,
        roleName: role?.name || 'مستخدم',
        permissions: perms.map((p) => p.code),
        },
      };

      this.saveSessionToStorage(this.currentSession);
      return this.currentSession;
    } catch {
      // Never fail open on a client-controlled session when database verification fails.
      this.saveSessionToStorage(null);
      return null;
    }
  }

  public async needsFirstRunSetup(): Promise<boolean> {
    const userCount = await this.userRepo.countUsers();
    if (userCount === 0) return true;

    const setupSetting = await this.settingsRepo.get('setup_completed');
    return setupSetting === '0' || setupSetting === null;
  }

  public async login(credentials: LoginCredentials): Promise<AuthenticatedUser> {
    const username = credentials.username.trim();
    const password = credentials.password;

    if (!username || !password) {
      throw new ValidationError('يرجى إدخال اسم المستخدم وكلمة المرور');
    }

    const user = await this.userRepo.findByUsername(username);

    if (!user) {
      // Security: never log the attempted password
      await this.auditRepo.log(
        'LOGIN_FAILED',
        'auth',
        username,
        null,
        { reason: 'USER_NOT_FOUND', username }
      );
      throw new InvalidCredentialsError();
    }

    if (user.is_active !== 1) {
      await this.auditRepo.log(
        'LOGIN_FAILED',
        'auth',
        user.id,
        user.id,
        { reason: 'ACCOUNT_INACTIVE', username }
      );
      throw new AccountInactiveError();
    }

    // Check account lockout
    if (user.locked_until) {
      const lockUntilDate = new Date(user.locked_until);
      if (lockUntilDate > new Date()) {
        await this.auditRepo.log(
          'LOGIN_FAILED',
          'auth',
          user.id,
          user.id,
          { reason: 'ACCOUNT_LOCKED', locked_until: user.locked_until }
        );
        throw new AccountLockedError(
          `تم قفل هذا الحساب مؤقتاً لتكرار محاولات الدخول الخاطئة حتى ${lockUntilDate.toLocaleTimeString('ar-EG')}.`,
          user.locked_until
        );
      }
    }

    // Verify Password Hash
    const isValid = await this.hasher.verify(password, user.password_hash);

    if (!isValid) {
      const attempts = await this.userRepo.incrementFailedAttempts(user.id);
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
        await this.userRepo.lockAccount(user.id, lockUntil);

        await this.auditRepo.log(
          'ACCOUNT_LOCK',
          'security',
          user.id,
          user.id,
          { reason: 'EXCEEDED_MAX_FAILED_ATTEMPTS', attempts, locked_until: lockUntil }
        );

        throw new AccountLockedError(
          `تم قفل هذا الحساب مؤقتاً لمدة 15 دقيقة لتجاوز الحد الأقصى للمحاولات الخاطئة.`,
          lockUntil
        );
      }

      await this.auditRepo.log(
        'LOGIN_FAILED',
        'auth',
        user.id,
        user.id,
        { reason: 'INVALID_PASSWORD', attempt: attempts }
      );

      throw new InvalidCredentialsError();
    }

    // Reset failed attempts & update last_login_at
    await this.userRepo.resetFailedAttemptsAndSetLogin(user.id);

    // Fetch Role & Permissions
    const role = await this.roleRepo.findById(user.role_id);
    const permissions = await this.permRepo.getForRole(user.role_id);

    const authUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      roleId: user.role_id,
      roleCode: (role?.code as RoleCode) || RoleCode.CASHIER,
      roleName: role?.name || 'كاشير',
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
    await this.settingsRepo.set(`auth_session_locked:${user.id}`, '0', 'حالة قفل جلسة التطبيق');

    // Record Login Success in Audit Log
    await this.auditRepo.log(
      'LOGIN_SUCCESS',
      'auth',
      user.id,
      user.id,
      { username: user.username, role: authUser.roleCode }
    );

    return authUser;
  }

  public async logout(): Promise<void> {
    if (this.currentSession?.user) {
      await this.auditRepo.log(
        'LOGOUT',
        'auth',
        this.currentSession.user.id,
        this.currentSession.user.id,
        { username: this.currentSession.user.username }
      );
    }
    if (this.currentSession?.user) {
      await this.settingsRepo.set(`auth_session_token_hash:${this.currentSession.user.id}`, '', 'إبطال جلسة المصادقة');
      await this.settingsRepo.set(`auth_session_expires:${this.currentSession.user.id}`, '', 'إبطال جلسة المصادقة');
    }
    this.saveSessionToStorage(null);
  }

  public lock(): void {
    if (!this.currentSession) return;
    this.currentSession.isLocked = true;
    this.saveSessionToStorage(this.currentSession);
    void this.settingsRepo.set(`auth_session_locked:${this.currentSession.user.id}`, '1', 'حالة قفل جلسة التطبيق').catch((error: unknown) => { logger.error('Non-blocking asynchronous operation failed', error); });

    // Audit log
    this.auditRepo.log(
      'ACCOUNT_LOCK',
      'auth',
      this.currentSession.user.id,
      this.currentSession.user.id,
      { action: 'MANUAL_APP_LOCK', username: this.currentSession.user.username }
    ).catch((error: unknown) => { logger.error('Non-blocking asynchronous operation failed', error); });
  }

  public async unlock(password: string): Promise<boolean> {
    if (!this.currentSession) {
      throw new UnauthorizedError('لا توجد جلسة نشطة لفك قفلها');
    }

    const userId = this.currentSession.user.id;
    const storedAttempts = Number(await this.settingsRepo.get(`unlock_failed_attempts:${userId}`) || 0);
    const storedLockedUntil = Date.parse(await this.settingsRepo.get(`unlock_locked_until:${userId}`) || '');
    this.unlockFailedAttempts = Number.isFinite(storedAttempts) ? storedAttempts : 0;
    this.unlockLockedUntil = Number.isFinite(storedLockedUntil) ? storedLockedUntil : 0;
    if (Date.now() < this.unlockLockedUntil) {
      throw new AccountLockedError('تم قفل فك القفل مؤقتاً لكثرة المحاولات الخاطئة.', new Date(this.unlockLockedUntil).toISOString());
    }

    const user = await this.userRepo.findById(this.currentSession.user.id);
    if (!user) {
      this.saveSessionToStorage(null);
      throw new UnauthorizedError('المستخدم لم يعد موجوداً');
    }

    const isValid = await this.hasher.verify(password, user.password_hash);
    if (!isValid) {
      this.unlockFailedAttempts++;
      if (this.unlockFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        this.unlockLockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      }
      await this.settingsRepo.set(`unlock_failed_attempts:${user.id}`, String(this.unlockFailedAttempts), 'محاولات فك القفل الفاشلة');
      if (this.unlockLockedUntil) await this.settingsRepo.set(`unlock_locked_until:${user.id}`, new Date(this.unlockLockedUntil).toISOString(), 'وقت انتهاء حظر فك القفل');
      await this.auditRepo.log(
        'LOGIN_FAILED',
        'auth',
        user.id,
        user.id,
        { reason: 'UNLOCK_FAILED_INVALID_PASSWORD' }
      );
      throw new InvalidCredentialsError('كلمة المرور غير صحيحة');
    }

    this.currentSession.isLocked = false;
    this.unlockFailedAttempts = 0;
    this.unlockLockedUntil = 0;
    await this.settingsRepo.set(`unlock_failed_attempts:${user.id}`, '0', 'محاولات فك القفل الفاشلة');
    await this.settingsRepo.set(`unlock_locked_until:${user.id}`, '', 'وقت انتهاء حظر فك القفل');
    await this.settingsRepo.set(`auth_session_locked:${user.id}`, '0', 'حالة قفل جلسة التطبيق');
    this.saveSessionToStorage(this.currentSession);

    await this.auditRepo.log(
      'ACCOUNT_UNLOCK',
      'auth',
      user.id,
      user.id,
      { username: user.username }
    );

    return true;
  }

  public async changePassword(
    userId: string,
    currentPass: string,
    newPass: string,
    confirmPass: string
  ): Promise<void> {
    if (!currentPass || !newPass || !confirmPass) {
      throw new ValidationError('يرجى تعبئة كافة حقول كلمة المرور.');
    }

    if (newPass.length < 6) {
      throw new ValidationError('يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف أو أرقام.');
    }

    if (newPass !== confirmPass) {
      throw new ValidationError('تأكيد كلمة المرور الجديدة غير متطابق.');
    }

    if (newPass === currentPass) {
      throw new ValidationError('كلمة المرور الجديدة مطابقة لكلمة المرور الحالية. يرجى اختيار كلمة مرور جديدة.');
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedError('المستخدم غير موجود.');
    }

    const isCurrentValid = await this.hasher.verify(currentPass, user.password_hash);
    if (!isCurrentValid) {
      throw new InvalidCredentialsError('كلمة المرور الحالية غير صحيحة.');
    }

    const newHash = await this.hasher.hash(newPass);
    await this.userRepo.updatePassword(userId, newHash);

    await this.auditRepo.log(
      'PASSWORD_CHANGED',
      'user',
      userId,
      userId,
      { username: user.username }
    );
  }

  public async resetPasswordWithActivation(
    username: string,
    newPass: string,
    confirmPass: string,
    resetActivationKey?: string
  ): Promise<void> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !newPass || !confirmPass) {
      throw new ValidationError('يرجى إدخال اسم المستخدم وكلمة المرور الجديدة.');
    }
    if (newPass.length < 6) {
      throw new ValidationError('يجب ألا تقل كلمة المرور الجديدة عن 6 خانات.');
    }
    if (newPass !== confirmPass) {
      throw new ValidationError('تأكيد كلمة المرور الجديدة غير متطابق.');
    }

    const user = await this.userRepo.findByUsername(normalizedUsername);
    if (!user || user.is_active !== 1) {
      throw new InvalidCredentialsError('اسم المستخدم غير موجود.');
    }

    const isCurrentAdmin = this.currentSession?.user.roleCode === RoleCode.ADMIN && !this.currentSession.isLocked;
    const activationKey = resetActivationKey || getStoredActivationKey();
    const activation = activationKey ? await verifyActivationKey(activationKey, getDeviceId()) : null;
    if (!isCurrentAdmin && !(activation?.active && parseActivationResetName(activation.keyName, normalizedUsername))) {
      throw new UnauthorizedError('إثبات استعادة كلمة المرور غير صالح. استخدم مفتاح reset موقّع أو سجّل دخول مسؤول النظام.');
    }

    const passwordHash = await this.hasher.hash(newPass);
    await this.userRepo.updatePassword(user.id, passwordHash);
    await this.userRepo.resetFailedAttemptsAndSetLogin(user.id);
    await this.auditRepo.log(
      'PASSWORD_RESET_WITH_ACTIVATION',
      'user',
      user.id,
      user.id,
      { username: user.username, device_id: activation.deviceId }
    );
  }

}
