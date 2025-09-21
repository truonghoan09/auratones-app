// src/hooks/useUserProfile.tsx
import { useState, useEffect } from 'react';

export const useUserProfile = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuthStatus = async () => {
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    // Gọi API backend để lấy thông tin user
                    const response = await fetch('http://localhost:3001/api/auth/profile', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    });

                    if (response.ok) {
                        const userData = await response.json();
                        setIsLoggedIn(true);
                        setUserAvatar(userData.photoURL || null);
                    } else {
                        // Token không hợp lệ, xóa token và đăng xuất
                        localStorage.removeItem('authToken');
                        setIsLoggedIn(false);
                        setUserAvatar(null);
                    }
                } catch (error) {
                    // Lỗi mạng hoặc lỗi khác, xóa token và đăng xuất
                    localStorage.removeItem('authToken');
                    setIsLoggedIn(false);
                    setUserAvatar(null);
                }
            } else {
                setIsLoggedIn(false);
                setUserAvatar(null);
            }
            setIsLoading(false);
        };

        checkAuthStatus();
    }, []);

    // Loại bỏ useEffect thứ hai vì nó không cần thiết,
    // Giá trị userAvatar sẽ được cập nhật đúng sau khi fetch thành công

    return {
        isLoggedIn,
        userAvatar,
        isLoading,
    };
};