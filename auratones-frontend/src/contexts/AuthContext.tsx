// src/contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { jwtDecode } from 'jwt-decode';

// ==== Types ====
export type AuthUser = {
  uid: string;
  username?: string | null;
  email?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  role?: string;                 // 'user' | 'admin' | ...
  plan?: string;                 // 'free' | 'pro' | ...
  subscription?: {
    status?: string | null;
    renewAt?: string | null;
  } | null;
  entitlements?: Record<string, unknown> | null;
  storage?: { usedBytes?: number } | null;
  usage?: { lastActiveAt?: string | null; totalSessions?: number } | null;
  settings?: Record<string, unknown> | null;
  // mở rộng thoải mái về sau
  [k: string]: unknown;
};

type JWTPayload = {
  uid: string;
  username?: string;
  email?: string;
  role?: string;
  plan?: string;
  exp?: number;
  iat?: number;
  [k: string]: unknown;
};

type AuthContextType = {
  // state chính
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;

  // tiện ích hay dùng
  getToken: () => string;
  loginWithToken: (token: string) => Promise<void>; // set token + hydrate
  logout: () => void;
  refreshMe: () => Promise<void>; // gọi /auth/me lại

  // 🧯 giữ tương thích với code hiện tại
  setIsAuthenticated: (v: boolean) => void;

  // 🧯 giữ tương thích: userAvatar + setter
  userAvatar: string | null;
  setUserAvatar: (v: string | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ==== ENV (Vite) ====
const API_BASE = import.meta.env.VITE_API_BASE as string;
const TOKEN_KEY =
  (import.meta.env.VITE_TOKEN_STORAGE_KEY as string) || 'auratones_token';

// ==== Helpers (local) ====
const getStoredToken = () => localStorage.getItem(TOKEN_KEY) || '';

const isTokenExpired = (token: string) => {
  try {
    const payload = jwtDecode<JWTPayload>(token);
    if (!payload?.exp) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec;
  } catch {
    return true; // token hỏng coi như hết hạn
  }
};

// ==== Provider ====
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, _setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  // userAvatar được suy ra từ user; vẫn expose setUserAvatar để tương thích
  const userAvatar = user?.avatar ?? null;
  const setUserAvatar = (v: string | null) =>
    setUser((prev) => (prev ? { ...prev, avatar: v ?? null } : prev));

  // setter tương thích cũ (ưu tiên dùng loginWithToken/logout)
  const setIsAuthenticated = (v: boolean) => _setIsAuthenticated(v);

  // đọc token
  const getToken = () => getStoredToken();

  // gọi /auth/me để hydrate user
  const refreshMe = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      _setIsAuthenticated(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AuthUser = await res.json();
      setUser(data);
      _setIsAuthenticated(true);
    } catch (_) {
      // token hỏng/401 → đăng xuất an toàn
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      _setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // lưu token & hydrate
  const loginWithToken = async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    _setIsAuthenticated(true);
    await refreshMe();
  };

  // xoá token & clear state
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    _setIsAuthenticated(false);
  };

  // Bootstrap khi app mount: đọc token, check exp, hydrate nếu hợp lệ
  useEffect(() => {
    const token = getStoredToken();
    if (!token || isTokenExpired(token)) {
      // token không tồn tại / hết hạn → xoá cho sạch
      if (token) localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      _setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }
    // token còn hạn → hydrate
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextType = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      user,

      getToken,
      loginWithToken,
      logout,
      refreshMe,

      // tương thích
      setIsAuthenticated,
      userAvatar,
      setUserAvatar,
    }),
    [isAuthenticated, isLoading, user, userAvatar]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ==== Hook ====
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
