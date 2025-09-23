// src/hooks/useAuth.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import type { JWTPayload } from '../types/auth';
import { useAuthContext } from '../contexts/AuthContext';

/**
 * Hook xác thực cho FE:
 * - Username/password login & register
 * - Google OAuth (BE redirect flow)
 * - Tiện ích đọc JWT (decode, check expired) bằng jwt-decode
 * - Quản lý isAuthenticated qua AuthContext
 */
export const useAuth = (
  showToast: (message: string, type: 'success' | 'error' | 'info') => void,
  onClose?: () => void
) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);

  // Biến môi trường (Vite)
  const API_BASE = import.meta.env.VITE_API_BASE;
  const TOKEN_KEY = import.meta.env.VITE_TOKEN_STORAGE_KEY || 'auratones_token';

  const navigate = useNavigate();
  const { setIsAuthenticated } = useAuthContext();

  /* =========================
   * JWT helpers (client-side)
   * ========================= */

  /** Lấy token đang lưu (localStorage) */
  const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

  /** Decode payload từ JWT (không xác thực chữ ký, chỉ để UI đọc nhanh) */
  const decodeToken = (): JWTPayload | null => {
    const token = getToken();
    if (!token) return null;
    try {
      return jwtDecode<JWTPayload>(token);
    } catch {
      return null;
    }
  };

  /** Kiểm tra token hết hạn dựa vào exp (giây từ epoch) */
  const isTokenExpired = (): boolean => {
    const payload = decodeToken();
    if (!payload?.exp) return false; // nếu không có exp thì coi như chưa biết
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec;
  };

  /** Public API: lấy user từ token payload (uid, email, role, plan, ...) */
  const getUserFromToken = () => decodeToken();

  // Khởi tạo trạng thái đăng nhập khi hook mount
  useEffect(() => {
    const hasToken = Boolean(getToken());
    setIsAuthenticated(hasToken && !isTokenExpired());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // chỉ chạy 1 lần khi mount

  /* =========================
   * Username / Password
   * ========================= */

  /** Đăng nhập username/password */
  const handleUsernameLogin = async (username: string, password: string) => {
    if (!username || !password) {
      showToast('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          // Không tìm thấy user → gợi ý tạo mới
          setShowUserSetupModal(true);
        } else if (response.status === 401) {
          showToast('Mật khẩu không đúng.', 'error');
        } else {
          showToast(`Lỗi đăng nhập: ${data.message || 'Không xác định'}`, 'error');
        }
        return;
      }

      // Lưu JWT & cập nhật trạng thái
      localStorage.setItem(TOKEN_KEY, data.token);
      setIsAuthenticated(true);

      showToast('Đăng nhập thành công!', 'success');
      onClose?.();                // đóng modal nếu có
      navigate('/');              // về trang chủ
    } catch (error: any) {
      showToast(`Lỗi kết nối: ${error.message}`, 'error');
    }
  };

  /** Đăng ký username/password (BE trả token ngay) */
  const handleUsernameRegister = async (username: string, password: string) => {
    if (!username || !password) {
      showToast('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Lỗi đăng ký.');
      }

      showToast('Đăng ký thành công! Đang đăng nhập...', 'success');

      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setIsAuthenticated(true);
      }

      onClose?.();
      navigate('/');
    } catch (error: any) {
      showToast(`Lỗi đăng ký: ${error.message}`, 'error');
    }
  };

  /* =========================
   * Google OAuth (BE redirect)
   * ========================= */

  /**
   * Với flow BE redirect:
   * - FE chỉ cần chuyển hướng tới /auth/google
   * - BE xử lý OAuth & callback, sau đó redirect về FE /auth/success?token=...
   * - FE (AuthSuccess page) lưu token vào localStorage.
   */
  const handleGoogleAuth = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  /* =========================
   * Logout
   * ========================= */

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
    showToast('Đã đăng xuất', 'info');
    navigate('/');
  };

  /* =========================
   * Public API
   * ========================= */
  return {
    // UI state
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
