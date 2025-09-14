// src/components/Auth.tsx
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase-config';
import type { User } from 'firebase/auth';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import UserSetup from './UserSetup';
import '../styles/auth.scss';

// Hàm kiểm tra username đã tồn tại chưa
const isUsernameTaken = async (username: string): Promise<boolean> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', username));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
};

interface AuthProps {
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    isModal: boolean;
    onClose: () => void;
    onLoginSuccess: () => void; // Thêm prop này
}

const Auth = ({ showToast, isModal, onClose, onLoginSuccess }: AuthProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                onLoginSuccess(); // Chỉ gọi hàm này khi đăng nhập
            }
        });

    if (isModal) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (isModal) {
        document.removeEventListener('keydown', handleKeyDown);
      }
      unsubscribeAuth();
    };
  }, [navigate, isModal, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const handleUsernameLogin = async () => {
    if (!username || !password) {
      showToast('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
      return;
    }
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      setShowUserSetupModal(true);
    } else {
      const fakeEmail = `${username}@auratones.com`;
      try {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
        showToast('Đăng nhập thành công!', 'success');
        if (isModal) {
          onClose?.();
        } else {
          onLoginSuccess()
        }
      } catch (error: any) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          showToast('Mật khẩu không đúng. Vui lòng thử lại.', 'error');
        } else {
          showToast(`Lỗi đăng nhập: ${error.message}`, 'error');
        }
      }
    }
  };

  const handleUsernameRegister = async () => {
    if (!username || !password) {
      showToast('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
      return;
    }
    if (await isUsernameTaken(username)) {
      showToast('Tên người dùng đã tồn tại. Vui lòng chọn tên khác.', 'error');
      return;
    }
    const fakeEmail = `${username}@auratones.com`;
    try {
      await createUserWithEmailAndPassword(auth, fakeEmail, password);
      await setDoc(doc(db, 'users', auth.currentUser!.uid), {
        username: username,
        email: null,
      });
      showToast('Đăng ký thành công!', 'success');
      if (isModal) {
        onClose?.();
      } else {
        onLoginSuccess(); 
      }
    } catch (registerError: any) {
      showToast(`Lỗi đăng ký: ${registerError.message}`, 'error');
    }
  };

  const handleGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      const userDocRef = doc(db, 'users', auth.currentUser!.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: auth.currentUser!.email,
          username: null,
        });
      }
      showToast('Đăng nhập bằng Google thành công!', 'success');
      onLoginSuccess(); 
      if (isModal) {
        onClose?.();
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      showToast(`Lỗi đăng nhập Google!`, 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('Bạn đã đăng xuất thành công.', 'info');
      navigate('/');
    } catch (error: any) {
      showToast(`Lỗi đăng xuất: ${error.message}`, 'error');
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

  return (
    <div className="auth-modal-overlay" onClick={handleOverlayClick}>
      {isModal && onClose && (
        <span className="close-btn" onClick={onClose}>&times;</span>
      )}
      <div className="auth-form" onClick={(e) => e.stopPropagation()}>
        {isLoginView ? (
          <>
            <h2>Đăng nhập</h2>
            <input type="text" placeholder="Tên người dùng" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button onClick={handleUsernameLogin}>Đăng nhập</button>
            <button onClick={() => setIsLoginView(false)}>Chuyển sang đăng ký</button>
            <p>hoặc</p>
            <button onClick={handleGoogleAuth}>
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 48 48">
                <path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12	s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20	s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                <path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039	l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                <path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36	c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                <path fill="#1565c0" d="M43.611,20.083L43.595,20L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571	c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
              </svg>
              <span>Google</span>
            </button>
          </>
        ) : (
          <>
            <h2>Đăng ký</h2>
            <input type="text" placeholder="Tên người dùng" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button onClick={handleUsernameRegister}>Đăng ký</button>
            <button onClick={() => setIsLoginView(true)}>Chuyển sang đăng nhập</button>
            <p>hoặc</p>
            <button onClick={handleGoogleAuth}>
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 48 48">
                <path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12	s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20	s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                <path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039	l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                <path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36	c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                <path fill="#1565c0" d="M43.611,20.083L43.595,20L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571	c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
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

