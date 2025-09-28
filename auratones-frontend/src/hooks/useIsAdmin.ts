// src/hooks/useIsAdmin.ts
import { useAuthContext } from '../contexts/AuthContext';

export default function useIsAdmin() {
  const { user } = useAuthContext();
  return user?.role === 'admin';
}
