import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthenticatedUser, AuthSession, LoginCredentials, InitialAdminInput } from '../types';
import { IAuthService, defaultAuthService } from '../services/AuthService';
import { hasPermission as checkPermission, hasAnyPermission as checkAnyPermission, hasAllPermissions as checkAllPermission } from '../utils/permissions';
import { DatabaseManager } from '../../../database/DatabaseManager';

interface AuthContextType {
  user: AuthenticatedUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  databaseError: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  lock: () => void;
  unlock: (password: string) => Promise<boolean>;
  changePassword: (currentPass: string, newPass: string, confirmPass: string) => Promise<void>;
  resetPasswordWithActivation: (username: string, newPass: string, confirmPass: string) => Promise<void>;
  setupInitialAdmin: (data: InitialAdminInput) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  authService?: IAuthService;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  authService = defaultAuthService,
}) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [needsSetup, setNeedsSetup] = useState<boolean>(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  const syncState = useCallback(() => {
    const currentSession = authService.getSession();
    setSession(currentSession ? { ...currentSession } : null);
    setUser(currentSession?.user ? { ...currentSession.user } : null);
    setIsLocked(authService.isLocked());
  }, [authService]);

  const initAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      setDatabaseError(null);
      // Ensure database is initialized
      const db = DatabaseManager.getInstance();
      await db.initialize();

      // Check if first-run setup is required
      const setupRequired = await authService.needsFirstRunSetup();
      setNeedsSetup(setupRequired);

      if (!setupRequired) {
        // Restore existing offline session
        const restored = await authService.restoreSession();
        if (restored) {
          syncState();
        }
      }
    } catch (err) {
      console.error('Failed to initialize authentication:', err);
      setDatabaseError(err instanceof Error ? err.message : 'تعذر تشغيل قاعدة البيانات المحلية.');
    } finally {
      setIsLoading(false);
    }
  }, [authService, syncState]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    await authService.login(credentials);
    syncState();
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    syncState();
  };

  const lock = (): void => {
    authService.lock();
    syncState();
  };

  const unlock = async (password: string): Promise<boolean> => {
    const success = await authService.unlock(password);
    if (success) {
      syncState();
    }
    return success;
  };

  const changePassword = async (
    currentPass: string,
    newPass: string,
    confirmPass: string
  ): Promise<void> => {
    if (!user) throw new Error('لا يوجد مستخدم مسجل حالياً.');
    await authService.changePassword(user.id, currentPass, newPass, confirmPass);
  };

  const resetPasswordWithActivation = async (
    username: string,
    newPass: string,
    confirmPass: string
  ): Promise<void> => {
    await authService.resetPasswordWithActivation(username, newPass, confirmPass);
  };

  const setupInitialAdmin = async (data: InitialAdminInput): Promise<void> => {
    await authService.setupInitialAdmin(data);
    setNeedsSetup(false);
    syncState();
  };

  const hasPermission = useCallback(
    (perm: string): boolean => {
      return checkPermission(user, perm);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (...perms: string[]): boolean => {
      return checkAnyPermission(user, ...perms);
    },
    [user]
  );

  const hasAllPermissions = useCallback(
    (...perms: string[]): boolean => {
      return checkAllPermission(user, ...perms);
    },
    [user]
  );

  const refreshSession = async (): Promise<void> => {
    await authService.restoreSession();
    syncState();
  };

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated: !!user,
    isLocked,
    isLoading,
    needsSetup,
    databaseError,
    login,
    logout,
    lock,
    unlock,
    changePassword,
    resetPasswordWithActivation,
    setupInitialAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
