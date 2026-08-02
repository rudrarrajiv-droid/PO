import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface RoleGuardProps {
  children: React.ReactNode;
  requireRole: 'ADMIN' | 'LIMITED';
  fallback?: React.ReactNode;
}

export default function RoleGuard({ children, requireRole, fallback = null }: RoleGuardProps) {
  const { hasRole } = useAuth();

  if (!hasRole(requireRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
