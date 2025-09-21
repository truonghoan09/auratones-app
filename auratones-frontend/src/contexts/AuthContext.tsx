//src/contexts/AuthContext.tsx

import { createContext, useContext, useState} from 'react';
import type { ReactNode } from 'react';

type AuthContextType = {
  isAuthenticated: boolean;
  setIsAuthenticated: (v: boolean) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  userAvatar: string | null;
  setUserAvatar: (v: string | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem('authToken'))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  return (
    <AuthContext.Provider
      value={{ 
        isAuthenticated,
        setIsAuthenticated,
        isLoading,
        setIsLoading,
        userAvatar,
        setUserAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}