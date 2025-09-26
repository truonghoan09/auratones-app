// src/hooks/useAuth.tsx
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

// Bật/tắt log nhanh tại đây
const DEBUG_AUTH = true;
const RETURN_TO_KEY = 'auth:return_to';

// Helper: build relative path (path + search + hash)
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

  /* ========= Helpers (không có side-effect) ========= */
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
      // eslint-disable-next-line no-console
      console.log('[auth] navigateAfterAuth', {
        serverReturnTo,
        stored,
        chosen: target,
      });
    }

    if (stored) localStorage.removeItem(RETURN_TO_KEY);
    navigate(target);
  }, [navigate]);

  // Gợi ý: trước khi mở modal login, bạn có thể set RETURN_TO_KEY = currentRelativePath()
  // để luôn quay về trang hiện tại sau khi đăng nhập.
  const ensureReturnToStored = useCallback(() => {
    if (!localStorage.getItem(RETURN_TO_KEY)) {
      localStorage.setItem(RETURN_TO_KEY, currentRelativePath());
      if (DEBUG_AUTH) {
        // eslint-disable-next-line no-console
        console.debug('[auth] stored RETURN_TO', localStorage.getItem(RETURN_TO_KEY));
      }
    }
  }, []);

  /* ================= Username / Password ================= */

  const handleUsernameLogin = useCallback(
    async (username: string, password: string) => {
      if (!username || !password) {
        showToast?.('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
        return;
      }

      ensureReturnToStored();
      const localReturnTo = localStorage.getItem(RETURN_TO_KEY) || '';
      const body = {
        username,
        password,
        // Truyền relative path (string). Server sẽ sanitize lại.
        returnTo: localReturnTo || undefined,
      };

      if (DEBUG_AUTH) {
        // eslint-disable-next-line no-console
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
          // eslint-disable-next-line no-console
          console.debug('[auth] /auth/login <- response', {
            status: res.status,
            json: data,
          });
        }

        if (!res.ok) {
          if (res.status === 404) {
            setShowUserSetupModal(true);
          } else if (res.status === 401) {
            showToast?.('Mật khẩu không đúng.', 'error');
          } else {
            showToast?.(`Lỗi đăng nhập: ${data.message || 'Không xác định'}`, 'error');
          }
          return;
        }

        await loginWithToken(data.token);

        showToast?.('Đăng nhập thành công!', 'success');
        onClose?.();

        // Điều hướng theo return_to (server) hoặc fallback local
        navigateAfterAuth(data.return_to);
      } catch (e: any) {
        showToast?.(`Lỗi kết nối: ${e.message}`, 'error');
        if (DEBUG_AUTH) {
          // eslint-disable-next-line no-console
          console.error('[auth] /auth/login error', e);
        }
      }
    },
    [API_BASE, loginWithToken, navigateAfterAuth, onClose, showToast, ensureReturnToStored]
  );

  const handleUsernameRegister = useCallback(
    async (username: string, password: string, email?: string) => {
      if (!username || !password) {
        showToast?.('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
        return;
      }

      ensureReturnToStored();
      const localReturnTo = localStorage.getItem(RETURN_TO_KEY) || '';
      const body = {
        username,
        password,
        email,
        // relative path string
        returnTo: localReturnTo || undefined,
      };

      if (DEBUG_AUTH) {
        // eslint-disable-next-line no-console
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
          // eslint-disable-next-line no-console
          console.debug('[auth] /auth/register <- response', {
            status: res.status,
            json: data,
          });
        }

        if (!res.ok) {
          throw new Error(data.message || 'Lỗi đăng ký.');
        }

        showToast?.('Đăng ký thành công! Đang đăng nhập...', 'success');

        if (data.token) {
          await loginWithToken(data.token);
        }

        onClose?.();

        // Điều hướng theo return_to (server) hoặc fallback local
        navigateAfterAuth(data.return_to);
      } catch (e: any) {
        showToast?.(`Lỗi đăng ký: ${e.message}`, 'error');
        if (DEBUG_AUTH) {
          // eslint-disable-next-line no-console
          console.error('[auth] /auth/register error', e);
        }
      }
    },
    [API_BASE, loginWithToken, navigateAfterAuth, onClose, showToast, ensureReturnToStored]
  );

  /* ================= Google OAuth (BE redirect) ================= */

  const handleGoogleAuth = useCallback(() => {
    // đảm bảo đã lưu trang hiện tại để quay lại
    ensureReturnToStored();
    const localReturnTo = localStorage.getItem(RETURN_TO_KEY) || '';

    // Gửi kèm return_to dưới dạng query để server echo lại khi redirect về /auth-success
    const url = new URL(`${API_BASE}/auth/google`);
    if (localReturnTo) url.searchParams.set('return_to', localReturnTo);

    if (DEBUG_AUTH) {
      // eslint-disable-next-line no-console
      console.debug('[auth] redirecting to Google OAuth', url.toString());
    }
    window.location.href = url.toString();
  }, [API_BASE, ensureReturnToStored]);

  /* ================= Logout ================= */

  const handleLogout = useCallback(() => {
    logout(); // xoá token + clear state đã gói trong AuthContext
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

    // Helpers (nếu cần dùng ở UI)
    getToken,
    getUserFromToken,
    isTokenExpired,
  };
};
