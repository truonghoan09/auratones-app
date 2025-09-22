import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

export const useAuth = (
    showToast: (message: string, type: 'success' | 'error' | 'info') => void,
    onClose?: () => void   // 👈 thêm callback đóng modal (không bắt buộc)
) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [showUserSetupModal, setShowUserSetupModal] = useState(false);
    const navigate = useNavigate();
    const {setIsAuthenticated} = useAuthContext()
        setIsAuthenticated(Boolean(localStorage.getItem('authToken')));


    const handleUsernameLogin = async (username: string, password: string) => {
        if (!username || !password) {
            showToast('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            if (!response.ok) {
                if (response.status === 404) {
                    setShowUserSetupModal(true);
                } else if (response.status === 401) {
                    showToast('Mật khẩu không đúng.', 'error');
                } else {
                    showToast(`Lỗi đăng nhập: ${data.message || 'Không xác định'}`, 'error');
                }
                return;
            }

            // Lưu token hoặc thông tin người dùng từ backend vào localStorage
            localStorage.setItem('authToken', data.token);
            setIsAuthenticated(true);       // 👈 cập nhật state

            showToast('Đăng nhập thành công!', 'success');
            onClose?.();       // 👈 đóng modal nếu được truyền
            navigate('/');
        } catch (error: any) {
                // Lỗi mạng hoặc lỗi không xác định
                showToast(`Lỗi kết nối: ${error.message}`, 'error');
        }
    };

    const handleUsernameRegister = async (username: string, password: string) => {
        if (!username || !password) {
            showToast('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Lỗi đăng ký.');
            }

            showToast('Đăng ký thành công! Đang đăng nhập...', 'success');
             // ✅ Lưu token ngay khi đăng ký
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                setIsAuthenticated(true);
            }
            onClose?.();
            navigate('/');

        } catch (error: any) {
            showToast(`Lỗi đăng ký: ${error.message}`, 'error');
        }
    };

    const handleGoogleAuth = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/auth/google-auth', {
                method: 'GET'
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Lỗi đăng nhập Google.');
            }

            window.location.href = data.authUrl;
        } catch (error: any) {
            showToast(`Lỗi đăng nhập Google!`, 'error');
        }
    };

    const handleLogout = async () => {
        try {
            localStorage.removeItem('authToken');
            setIsAuthenticated(false);      // 👈 cập nhật state
            showToast('Đã đăng xuất', 'info');
            navigate('/');
        } catch (error) {
            console.error("Lỗi đăng xuất:", error);
            showToast('Đăng xuất thất bại', 'error');
        }
    };

    return {
        isLoginView,
        setIsLoginView,
        showUserSetupModal,
        setShowUserSetupModal,
        handleUsernameLogin,
        handleUsernameRegister,
        handleGoogleAuth,
        handleLogout,
    };
};
