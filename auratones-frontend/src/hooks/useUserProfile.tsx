// src/hooks/useUserProfile.tsx
import { useEffect, useRef } from 'react';
import { useAuthContext } from '../contexts/AuthContext';

/**
 * Hook đọc hồ sơ người dùng từ AuthContext.
 * - Tự gọi refreshMe() một lần khi mount nếu có token.
 * - Không đụng localStorage & không hardcode URL.
 * - Trả về state gọn: isAuthenticated, isLoading, user, userAvatar.
 */
export const useUserProfile = () => {
  const {
    isAuthenticated,
    isLoading,
    user,
    userAvatar,
    getToken,
    refreshMe,
  } = useAuthContext();

  const didHydrate = useRef(false);

  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;

    // Nếu đã có token trong storage → hydrate /auth/me
    const token = getToken();
    if (token) {
      // refreshMe tự xử lý set user + isAuthenticated trong AuthProvider
      refreshMe().catch(() => {
        // nuốt lỗi lặt vặt, AuthProvider sẽ tự reset state khi lỗi
      });
    }
  }, [getToken, refreshMe]);

  return {
    isAuthenticated,
    isLoading,
    user,
    userAvatar,
  };
};
