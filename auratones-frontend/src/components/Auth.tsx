// src/components/Auth.tsx
import { useState, useEffect } from 'react';
import UserSetup from './UserSetup';
import '../styles/auth.scss';
import { useAuth } from '../hooks/useAuth';

interface AuthProps {
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    isModal: boolean;
    onClose: () => void;
}

const Auth = ({
    showToast,
    isModal,
    onClose,
}: AuthProps) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // Gọi hook useAuth để sử dụng các hàm
    const { 
        isLoginView, 
        setIsLoginView, 
        showUserSetupModal, 
        setShowUserSetupModal, 
        handleUsernameLogin, 
        handleUsernameRegister, 
        handleGoogleAuth 
    } = useAuth(showToast, onClose);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose?.();
            }
        };
        if (isModal) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            if (isModal) {
                document.removeEventListener('keydown', handleKeyDown);
            }
        }
    }, [isModal, onClose]);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && onClose) {
            onClose();
        }
    };
    
    const handleUserNotFoundConfirm = () => {
        setShowUserSetupModal(false);
        setIsLoginView(false);
    };

    const handleUserNotFoundCancel = () => {
        setShowUserSetupModal(false);
        setUsername('');
        setPassword('');
    };
    
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (isLoginView) {
                handleUsernameLogin(username, password);
            } else {
                handleUsernameRegister(username, password);
            }
        }
    };

    return (
        <div className="auth-modal-overlay" onClick={handleOverlayClick}>
            {isModal && onClose && (
                <span className="close-btn" onClick={onClose}>&times;</span>
            )}
            <div className="auth-form" onClick={(e) => e.stopPropagation()}>
                {isLoginView ? (
                    <>
                        <h2>Đăng nhập</h2>
                        <input type="text" placeholder="Tên người dùng" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={handleKeyDown} />
                        <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} />
                        <button onClick={() => handleUsernameLogin(username, password)}>Đăng nhập</button>
                        <button onClick={() => setIsLoginView(false)}>Chuyển sang đăng ký</button>
                        <p>hoặc</p>
                        <button onClick={handleGoogleAuth}>
                            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 48 48">
                                <path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20 s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                                <path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                                <path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                                <path fill="#1565c0" d="M43.611,20.083L43.595,20L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571 c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                            </svg>
                            <span>Google</span>
                        </button>
                    </>
                ) : (
                    <>
                        <h2>Đăng ký</h2>
                        <input type="text" placeholder="Tên người dùng" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={handleKeyDown} />
                        <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} />
                        <button onClick={() => handleUsernameRegister(username, password)}>Đăng ký</button>
                        <button onClick={() => setIsLoginView(true)}>Chuyển sang đăng nhập</button>
                        <p>hoặc</p>
                        <button onClick={handleGoogleAuth}>
                            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 48 48">
                                <path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20 s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                                <path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                                <path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                                <path fill="#1565c0" d="M43.611,20.083L43.595,20L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571 c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                            </svg>
                            <span>Google</span>
                        </button>
                    </>
                )}
            </div>
            {showUserSetupModal && (
                <UserSetup
                    username={username}
                    onConfirm={handleUserNotFoundConfirm}
                    onCancel={handleUserNotFoundCancel}
                />
            )}
        </div>
    );
};

export default Auth;