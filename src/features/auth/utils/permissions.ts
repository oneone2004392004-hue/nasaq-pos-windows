import { logger } from '../../../utils/logger';
import { AuthenticatedUser } from '../types';
import { RoleCode } from '../../../domain/enums';
import { UnauthorizedError } from '../errors';
import { IAuditLogRepository } from '../../../repositories/AuditLogRepository';

/**
 * Checks if the authenticated user has a specific permission code.
 * ADMIN role bypasses permission checks (super-admin access).
 */
export function hasPermission(user: AuthenticatedUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.roleCode === RoleCode.ADMIN) return true;
  return Array.isArray(user.permissions) ? user.permissions.includes(permission) : false;
}

/**
 * Checks if user has at least one of the provided permissions.
 */
export function hasAnyPermission(user: AuthenticatedUser | null | undefined, ...permissions: string[]): boolean {
  if (!user) return false;
  if (user.roleCode === RoleCode.ADMIN) return true;
  if (!Array.isArray(user.permissions)) return false;
  return permissions.some((perm) => user.permissions.includes(perm));
}

/**
 * Checks if user has all of the provided permissions.
 */
export function hasAllPermissions(user: AuthenticatedUser | null | undefined, ...permissions: string[]): boolean {
  if (!user) return false;
  if (user.roleCode === RoleCode.ADMIN) return true;
  if (!Array.isArray(user.permissions)) return false;
  return permissions.every((perm) => user.permissions.includes(perm));
}

/**
 * Enforces permission check in the Application/Service Layer.
 * Throws UnauthorizedError if unauthorized and optionally logs security event.
 */
export function requirePermission(
  user: AuthenticatedUser | null | undefined,
  permission: string,
  auditRepo?: IAuditLogRepository
): void {
  if (!user) {
    throw new UnauthorizedError('يجب تسجيل الدخول أولاً لتنفيذ هذه العملية.');
  }

  if (!hasPermission(user, permission)) {
    if (auditRepo) {
      // Fire-and-forget security audit log
      auditRepo
        .log(
          'UNAUTHORIZED_ACTION',
          'security',
          permission,
          user.id,
          {
            user: user.username,
            attempted_permission: permission,
            role: user.roleCode,
          }
        )
        .catch((error: unknown) => { logger.error('Non-blocking asynchronous operation failed', error); });
    }
    throw new UnauthorizedError(
      `غير مصرح لك بتنفيذ هذا الإجراء. يتطلب صلاحية: [${permission}]`,
      permission
    );
  }
}

/**
 * Enforces that user has at least one of the provided permissions.
 */
export function requireAnyPermission(
  user: AuthenticatedUser | null | undefined,
  permissions: string[],
  auditRepo?: IAuditLogRepository
): void {
  if (!user) {
    throw new UnauthorizedError('يجب تسجيل الدخول أولاً لتنفيذ هذه العملية.');
  }

  if (!hasAnyPermission(user, ...permissions)) {
    if (auditRepo) {
      auditRepo
        .log(
          'UNAUTHORIZED_ACTION',
          'security',
          permissions.join(','),
          user.id,
          {
            user: user.username,
            attempted_permissions: permissions,
            role: user.roleCode,
          }
        )
        .catch((error: unknown) => { logger.error('Non-blocking asynchronous operation failed', error); });
    }
    throw new UnauthorizedError(
      `غير مصرح لك بتنفيذ هذا الإجراء. يتطلب إحدى الصلاحيات: [${permissions.join(', ')}]`
    );
  }
}

/**
 * Enforces role check in Application/Service Layer.
 */
export function requireRole(
  user: AuthenticatedUser | null | undefined,
  role: RoleCode | string
): void {
  if (!user) {
    throw new UnauthorizedError('يجب تسجيل الدخول أولاً لتنفيذ هذه العملية.');
  }

  if (user.roleCode !== role && user.roleCode !== RoleCode.ADMIN) {
    throw new UnauthorizedError(`يتطلب هذا الإجراء دور [${role}] على الأقل.`);
  }
}
