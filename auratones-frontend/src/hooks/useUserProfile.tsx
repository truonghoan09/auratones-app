import { useState, useEffect } from 'react';

export const useUserProfile = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setIsLoggedIn(false);
        setUserAvatar(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:3001/api/auth/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setIsLoggedIn(true);
          // Tùy thuộc API trả gì, ví dụ avatar có thể là userData.avatar hoặc userData.photoURL
          setUserAvatar(userData.avatar || userData.photoURL || null);
        } else {
          // Token không hợp lệ hoặc đã hết hạn
          localStorage.removeItem('authToken');
          setIsLoggedIn(false);
          setUserAvatar(null);
        }
      } catch (err) {
        console.error('Lỗi khi gọi /api/me:', err);
        localStorage.removeItem('authToken');
        setIsLoggedIn(false);
        setUserAvatar(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  return {
    isLoggedIn,
    userAvatar,
    isLoading,
  };
};
