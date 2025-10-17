import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuthContext } from '../contexts/AuthContext';

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

// ===== New: kiểu kết quả cho UI xử lý tiếp =====
type AuthResult =
  | { ok: true; token: string; return_to?: string | null }
  | { ok: false; code: string; fields?: string[] };

const DEBUG_AUTH = true;
const RETURN_TO_KEY = 'auth:return_to';

function currentRelativePath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export const useAuth = (
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void,
  onClose?: () => void
) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE as string;
  const TOKEN_KEY =
    (import.meta.env.VITE_TOKEN_STORAGE_KEY as string) || 'auratones_token';

  const navigate = useNavigate();
  const { loginWithToken, logout } = useAuthContext();

  /* ========= Helpers ========= */
  const getToken = useCallback(
    () => localStorage.getItem(TOKEN_KEY) || '',
    [TOKEN_KEY]
  );

  const decodeToken = useCallback((): JWTPayload | null => {
    const token = getToken();
    if (!token) return null;
    try {
      return jwtDecode<JWTPayload>(token);
    } catch {
      return null;
    }
  }, [getToken]);

  const isTokenExpired = useCallback((): boolean => {
    const payload = decodeToken();
    if (!payload?.exp) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec;
  }, [decodeToken]);

  const getUserFromToken = useCallback(() => decodeToken(), [decodeToken]);

  /** Điều hướng theo return_to (server) hoặc fallback (localStorage) */
  const navigateAfterAuth = useCallback((serverReturnTo?: string | null) => {
    const stored = localStorage.getItem(RETURN_TO_KEY) || '';
    const target = (serverReturnTo && serverReturnTo.trim()) || (stored && stored.trim()) || '/';

    if (DEBUG_AUTH) {
      console.log('[auth] navigateAfterAuth', { serverReturnTo, stored, chosen: target });
    }

    if (stored) localStorage.removeItem(RETURN_TO_KEY);
    navigate(target);
  }, [navigate]);

  const ensureReturnToStored = useCallback(() => {
    if (!localStorage.getItem(RETURN_TO_KEY)) {
      localStorage.setItem(RETURN_TO_KEY, currentRelativePath());
      if (DEBUG_AUTH) {
        console.debug('[auth] stored RETURN_TO', localStorage.getItem(RETURN_TO_KEY));
      }
    }
  }, []);

  /* ================= Username / Password ================= */

  const handleUsernameLogin = useCallback(
    async (username: string, password: string): Promise<AuthResult | void> => {
      if (!username || !password) {
        showToast?.('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
        return { ok: false, code: 'MISSING_FIELDS', fields: ['username', 'password'] };
      }

      ensureReturnToStored();
      const localReturnTo = localStorage.getItem(RETURN_TO_KEY) || '';
      const body = {
        username,
        password,
        returnTo: localReturnTo || undefined, // server sẽ sanitize
      };

      if (DEBUG_AUTH) {
        console.debug('[auth] /auth/login -> body', { ...body, password: '***' });
      }

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (DEBUG_AUTH) {
          console.debug('[auth] /auth/login <- response', { status: res.status, json: data });
        }

        if (!res.ok) {
          // === Quan trọng: 404 → chỉ mở modal, KHÔNG coi là success
          if (res.status === 404) {
            setShowUserSetupModal(true);
            return { ok: false, code: data?.code || 'USER_NOT_FOUND', fields: data?.fields };
          }
          if (res.status === 401) {
            showToast?.('Mật khẩu không đúng.', 'error');
            return { ok: false, code: data?.code || 'INCORRECT_PASSWORD', fields: data?.fields };
          }
          showToast?.(`Lỗi đăng nhập: ${data.message || 'Không xác định'}`, 'error');
          return { ok: false, code: data?.code || 'SERVER_ERROR', fields: data?.fields };
        }

        // === Thành công
        if (data.token) {
          await loginWithToken(data.token);
        }
        // KHÔNG toast success ở hook nữa → để UI quyết định
        onClose?.();
        navigateAfterAuth(data.return_to);

        return { ok: true, token: data.token, return_to: data.return_to ?? null };
      } catch (e: any) {
        showToast?.(`Lỗi kết nối: ${e.message}`, 'error');
        if (DEBUG_AUTH) console.error('[auth] /auth/login error', e);
        return { ok: false, code: 'NETWORK_ERROR' };
      }
    },
    [API_BASE, loginWithToken, navigateAfterAuth, onClose, showToast, ensureReturnToStored]
  );

  const handleUsernameRegister = useCallback(
    async (username: string, password: string, email?: string): Promise<AuthResult | void> => {
      if (!username || !password) {
        showToast?.('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
        return { ok: false, code: 'MISSING_FIELDS', fields: ['username', 'password'] };
      }

      ensureReturnToStored();
      const localReturnTo = localStorage.getItem(RETURN_TO_KEY) || '';
      const body = {
        username,
        password,
        email,
        returnTo: localReturnTo || undefined,
      };

      if (DEBUG_AUTH) {
        console.debug('[auth] /auth/register -> body', { ...body, password: '***' });
      }

      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (DEBUG_AUTH) {
          console.debug('[auth] /auth/register <- response', { status: res.status, json: data });
        }

        if (!res.ok) {
          // Giữ toast lỗi như hiện tại
          showToast?.(`Lỗi đăng ký: ${data.message || 'Không xác định'}`, 'error');
          return { ok: false, code: data?.code || 'REGISTER_FAILED', fields: data?.fields };
        }

        // Không toast success ở đây; UI sẽ hiển thị sau khi ok
        if (data.token) {
          await loginWithToken(data.token);
        }
        onClose?.();
        navigateAfterAuth(data.return_to);

        return { ok: true, token: data.token, return_to: data.return_to ?? null };
      } catch (e: any) {
        showToast?.(`Lỗi đăng ký: ${e.message}`, 'error');
        if (DEBUG_AUTH) console.error('[auth] /auth/register error', e);
        return { ok: false, code: 'NETWORK_ERROR' };
      }
    },
    [API_BASE, loginWithToken, navigateAfterAuth, onClose, showToast, ensureReturnToStored]
  );

  /* ================= Google OAuth (BE redirect) ================= */

  const handleGoogleAuth = useCallback(() => {
    ensureReturnToStored();
    const localReturnTo = localStorage.getItem(RETURN_TO_KEY) || '';

    const url = new URL(`${API_BASE}/auth/google`);
    if (localReturnTo) url.searchParams.set('return_to', localReturnTo);

    if (DEBUG_AUTH) console.debug('[auth] redirecting to Google OAuth', url.toString());
    window.location.href = url.toString();
  }, [API_BASE, ensureReturnToStored]);

  /* ================= Logout ================= */

  const handleLogout = useCallback(() => {
    logout();
    showToast?.('Đã đăng xuất', 'info');
    navigate('/');
  }, [logout, navigate, showToast]);

  return {
    // UI state cho form
    isLoginView,
    setIsLoginView,
    showUserSetupModal,
    setShowUserSetupModal,

    // Actions
    handleUsernameLogin,
    handleUsernameRegister,
    handleGoogleAuth,
    handleLogout,

    // Helpers
    getToken,
    getUserFromToken,
    isTokenExpired,
  };
};
