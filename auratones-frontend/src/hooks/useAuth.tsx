// src/hooks/useAuth.tsx
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuthContext } from '../contexts/AuthContext';

// (tuỳ chọn) kiểu payload nếu bạn muốn đọc nhanh thông tin trong JWT
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

/**
 * Hook xác thực FE (KHÔNG còn setState khi mount):
 * - Username/password login & register (gọi loginWithToken của AuthContext)
 * - Google OAuth (BE redirect)
 * - Logout (gọi logout của AuthContext)
 * - Một vài helper đọc JWT (không có side-effect)
 */
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

  /* ================= Username / Password ================= */

  const handleUsernameLogin = useCallback(
    async (username: string, password: string) => {
      if (!username || !password) {
        showToast?.('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

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

        // ✅ giao cho AuthContext lưu token + hydrate user
        await loginWithToken(data.token);

        showToast?.('Đăng nhập thành công!', 'success');
        onClose?.();
        navigate('/');
      } catch (e: any) {
        showToast?.(`Lỗi kết nối: ${e.message}`, 'error');
      }
    },
    [API_BASE, loginWithToken, navigate, onClose, showToast]
  );

  const handleUsernameRegister = useCallback(
    async (username: string, password: string) => {
      if (!username || !password) {
        showToast?.('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || 'Lỗi đăng ký.');
        }

        showToast?.('Đăng ký thành công! Đang đăng nhập...', 'success');

        if (data.token) {
          await loginWithToken(data.token);
        }

        onClose?.();
        navigate('/');
      } catch (e: any) {
        showToast?.(`Lỗi đăng ký: ${e.message}`, 'error');
      }
    },
    [API_BASE, loginWithToken, navigate, onClose, showToast]
  );

  /* ================= Google OAuth (BE redirect) ================= */

  const handleGoogleAuth = useCallback(() => {
    window.location.href = `${API_BASE}/auth/google`;
  }, [API_BASE]);

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
