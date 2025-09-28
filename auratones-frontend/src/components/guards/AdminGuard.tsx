// src/components/guards/AdminGuard.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuthContext();
  const loc = useLocation();

  if (isLoading) return null; // hoặc spinner riêng

  const isAdmin = isAuthenticated && user?.role === 'admin';
  return isAdmin ? <>{children}</> : <Navigate to="/" replace state={{ from: loc }} />;
}
