import React from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleCode } from '../../../domain/enums';

interface CanProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ permission, fallback = null, children }) => {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};

interface CanAnyProps {
  permissions: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const CanAny: React.FC<CanAnyProps> = ({ permissions, fallback = null, children }) => {
  const { hasAnyPermission } = useAuth();
  if (!hasAnyPermission(...permissions)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};

interface RoleGuardProps {
  role: RoleCode | string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ role, fallback = null, children }) => {
  const { user } = useAuth();
  if (!user) return <>{fallback}</>;
  if (user.roleCode === RoleCode.ADMIN || user.roleCode === role) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
};
