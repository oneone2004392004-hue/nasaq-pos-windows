import { RoleCode } from '../../domain/enums';

/**
 * Authenticated user details passed to UI and application services.
 * Crucial Security Rule: Never contains password_hash!
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  name: string;
  roleId: string;
  roleCode: RoleCode;
  roleName: string;
  permissions: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthSession {
  token: string;
  user: AuthenticatedUser;
  createdAt: number;
  expiresAt: number;
  isLocked: boolean;
}

export interface InitialAdminInput {
  username: string;
  name: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
