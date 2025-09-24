import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
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
  role?: string;
  plan?: string;
  subscription?: { status?: string | null; renewAt?: string | null } | null;
  entitlements?: Record<string, unknown> | null;
  storage?: { usedBytes?: number } | null;
  usage?: { lastActiveAt?: string | null; totalSessions?: number } | null;
  settings?: Record<string, unknown> | null;
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
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;

  getToken: () => string;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;

  // giữ tương thích
  setIsAuthenticated: (v: boolean) => void;
  userAvatar: string | null;
  setUserAvatar: (v: string | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ==== ENV (Vite) ====
const API_BASE = import.meta.env.VITE_API_BASE as string;
const TOKEN_KEY =
  (import.meta.env.VITE_TOKEN_STORAGE_KEY as string) || 'auratones_token';

// ==== Helpers ====
const getStoredToken = () => localStorage.getItem(TOKEN_KEY) || '';

const isTokenExpired = (token: string) => {
  try {
    const payload = jwtDecode<JWTPayload>(token);
    if (!payload?.exp) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec;
  } catch {
    return true;
  }
};

// ==== Provider ====
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticatedState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  // avatar suy từ user (giữ setter để tương thích)
  const userAvatar = user?.avatar ?? null;
  const setUserAvatar = useCallback((v: string | null) => {
    setUser((prev) => (prev ? { ...prev, avatar: v ?? null } : prev));
  }, []);

  // setter tương thích (ưu tiên dùng loginWithToken/logout)
  const setIsAuthenticated = useCallback(
    (v: boolean) => setIsAuthenticatedState(v),
    []
  );

  // token reader ổn định
  const getToken = useCallback(() => getStoredToken(), []);

  // dedupe / throttle cho /auth/me
  const meInFlight = useRef<Promise<void> | null>(null);
  const lastMeAt = useRef(0);

const refreshMe = useCallback(async () => {
  const token = getToken();
  if (!token) {
    console.debug('[auth] refreshMe: no token → clear state');
    setUser(null);
    setIsAuthenticated(false);
    return;
  }

  const now = Date.now();

  // ⏱️ throttle 2s: nếu vừa gọi xong và vẫn còn promise đang bay → reuse
  if (now - lastMeAt.current < 2000 && meInFlight.current) {
    console.debug('[auth] refreshMe: throttled → awaiting inflight');
    await meInFlight.current;
    return;
  }

  // 🔁 dedupe: đã có request đang bay → reuse
  if (meInFlight.current) {
    console.debug('[auth] refreshMe: inflight exists → awaiting');
    await meInFlight.current;
    return;
  }

  lastMeAt.current = now;
  setIsLoading(true);

  // 🛟 safety timer: nếu vì lý do gì finally không chạy, vẫn tắt loading
  let safetyId: number | undefined;
  const t0 = performance.now();

  const job = (async () => {
    try {
      safetyId = window.setTimeout(() => {
        console.warn('[auth] refreshMe: safety timeout fired (10s) → clearing loading');
        setIsLoading(false);
        meInFlight.current = null;
      }, 10_000);

      console.debug('[auth] refreshMe: GET /auth/me start');
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.debug(
        `[auth] refreshMe: /auth/me status=${res.status} in ${(performance.now() - t0).toFixed(0)}ms`
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: AuthUser = await res.json();
      setUser(data);
      setIsAuthenticated(true);
      console.debug('[auth] refreshMe: success → user hydrated');
    } catch (e) {
      console.warn('[auth] refreshMe: failed → clearing token', e);
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      if (safetyId) clearTimeout(safetyId);
      setIsLoading(false);
      meInFlight.current = null;
      console.debug('[auth] refreshMe: cleanup done');
    }
  })();

  meInFlight.current = job;
  await job; // cho ai gọi trực tiếp có thể await
}, [getToken, setIsAuthenticated]);

  const loginWithToken = useCallback(
    async (token: string) => {
      localStorage.setItem(TOKEN_KEY, token);
      setIsAuthenticated(true);
      await refreshMe();
    },
    [refreshMe, setIsAuthenticated]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setIsAuthenticated(false);
  }, [setIsAuthenticated]);

  // Bootstrap (chạy đúng 1 lần trong StrictMode)
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const token = getStoredToken();
    if (!token || isTokenExpired(token)) {
      if (token) localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setIsAuthenticatedState(false);
      setIsLoading(false);
      return;
    }
    refreshMe();
  }, [refreshMe]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      user,

      getToken,
      loginWithToken,
      logout,
      refreshMe,

      setIsAuthenticated,
      userAvatar,
      setUserAvatar,
    }),
    [
      isAuthenticated,
      isLoading,
      user,
      getToken,
      loginWithToken,
      logout,
      refreshMe,
      setIsAuthenticated,
      userAvatar,
      setUserAvatar,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ==== Hook ====
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
