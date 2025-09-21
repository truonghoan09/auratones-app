// src/hooks/useUserProfile.tsx
import { useEffect, useRef } from 'react';
import { useAuthContext } from '../contexts/AuthContext';

export const useUserProfile = () => {
    const { setIsAuthenticated, setIsLoading, setUserAvatar } = useAuthContext();
    const isInitialCheckDone = useRef(false); 

    useEffect(() => {
        if (isInitialCheckDone.current) {
            return;
        }
        const checkAuthStatus = async () => {
            setIsLoading(true);
            
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    // Gọi API backend để lấy thông tin user
                    const response = await fetch('http://localhost:3001/api/auth/me', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    });

                    if (response.ok) {
                        const userData = await response.json();
                        setIsAuthenticated(true);
                        setUserAvatar(userData.photoURL || null);
                    } else {
                        // Token không hợp lệ, xóa token và đăng xuất
                        localStorage.removeItem('authToken');
                        setIsAuthenticated(false);
                        setUserAvatar(null);
                    }
                } catch (error) {
                    // Lỗi mạng hoặc lỗi khác, xóa token và đăng xuất
                    localStorage.removeItem('authToken');
                    setIsAuthenticated(false);
                    setUserAvatar(null);
                }
            } else {
                setIsAuthenticated(false);
                setUserAvatar(null);
            }
            setIsLoading(false);
        };

        checkAuthStatus();
        isInitialCheckDone.current = true;
    }, [setIsAuthenticated, setIsLoading, setUserAvatar]);

};