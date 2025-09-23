// src/contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { jwtDecode } from 'jwt-decode';

// ===================== Types =====================
export type AuthUser = {
  uid: string;
  username?: string | null;
  email?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  role?: string;                 // 'user' | 'admin' | ...
  plan?: string;                 // 'free' | 'pro' | ...
  subscription?: { status?: string | null; renewAt?: string | null } | null;
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
  exp?: number; // giây kể từ epoch
  iat?: number;
  [k: string]: unknown;
};

type AuthContextType = {
  // state chính
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;

  // helpers
  getToken: () => string;
  loginWithToken: (token: string) => Promise<void>; // lưu token + hydrate /me
  refreshMe: () => Promise<void>;                   // gọi lại /auth/me
  logout: () => void;                               // xoá token + clear state

  // 🧯 tương thích cũ
  setIsAuthenticated: (v: boolean) => void;

  // 🧯 tương thích cũ: avatar + setter
  userAvatar: string | null;
  setUserAvatar: (v: string | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===================== ENV (Vite) =====================
const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3001/api';
const TOKEN_KEY =
  (import.meta.env.VITE_TOKEN_STORAGE_KEY as string) || 'auratones_token';

// ===================== Token helpers =====================
const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
const setStoredToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
const clearStoredToken = () => localStorage.removeItem(TOKEN_KEY);

// Kiểm tra token hết hạn (dựa vào exp). Nếu token lỗi format → coi như hết hạn.
const isTokenExpired = (token: string | null) => {
  if (!token) return true;
  try {
    const payload = jwtDecode<JWTPayload>(token);
    if (!payload?.exp) return false; // không có exp thì coi như còn hạn
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec;
  } catch {
    return true;
  }
};

// ===================== Provider =====================
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(Boolean(getStoredToken()));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // userAvatar suy ra từ user; vẫn expose setter để tương thích với code hiện tại
  const userAvatar = user?.avatar ?? null;
  const setUserAvatar = useCallback((v: string | null) => {
    setUser((prev) => (prev ? { ...prev, avatar: v ?? null } : prev));
  }, []);

  // setter tương thích cũ (ưu tiên dùng loginWithToken/logout thay vì gọi trực tiếp)
  const setIsAuthenticated = useCallback((v: boolean) => {
    setIsAuthenticatedState(v);
  }, []);

  // Lấy token hiện tại (string rỗng nếu không có)
  const getToken = useCallback(() => getStoredToken() || '', []);

  // Gọi /auth/me để hydrate user (an toàn: tự xử lý 401 & clear token)
  const refreshMe = useCallback(async () => {
    const token = getStoredToken();
    if (isTokenExpired(token)) {
      clearStoredToken();
      setUser(null);
      setIsAuthenticatedState(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'omit',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AuthUser = await res.json();

      setUser(data);
      setIsAuthenticatedState(true);
    } catch {
      // token không hợp lệ / hết hạn / lỗi mạng → đăng xuất cục bộ
      clearStoredToken();
      setUser(null);
      setIsAuthenticatedState(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Lưu token & hydrate ngay
  const loginWithToken = useCallback(
    async (token: string) => {
      setStoredToken(token);
      await refreshMe(); // đọc /auth/me sau khi lưu token
    },
    [refreshMe]
  );

  // Xoá token & clear state (stateless JWT)
  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setIsAuthenticatedState(false);
  }, []);

  // Bootstrap khi app mount: nếu có token và chưa hết hạn → hydrate
  useEffect(() => {
    const token = getStoredToken();
    if (isTokenExpired(token)) {
      clearStoredToken();
      setUser(null);
      setIsAuthenticatedState(false);
      return;
    }
    // token còn hạn → load profile
    refreshMe();
  }, [refreshMe]);

  const value: AuthContextType = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      user,

      getToken,
      loginWithToken,
      refreshMe,
      logout,

      // tương thích
      setIsAuthenticated,
      userAvatar,
      setUserAvatar,
    }),
    [isAuthenticated, isLoading, user, getToken, loginWithToken, refreshMe, logout, setIsAuthenticated, userAvatar, setUserAvatar]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ===================== Hook =====================
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
