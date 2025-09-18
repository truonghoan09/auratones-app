// src/hooks/useAuth.tsx
import { useState, useEffect } from 'react';
import {
  auth,
  db
} from '../firebase-config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';


export const useAuth = (showToast: (message: string, type: 'success' | 'error' | 'info') => void, onClose?: () => void) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [showUserSetupModal, setShowUserSetupModal] = useState(false);
  const navigate = useNavigate()

  const isUsernameTaken = async (username: string): Promise<boolean> => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (onClose) {
          onClose();
        }
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, [onClose]);

  const handleUsernameLogin = async (username: string, password: string) => {
    if (!username || !password) {
      showToast('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
      return;
    }
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      setShowUserSetupModal(true);
      showToast('Tên người dùng không tồn tại!', 'error');
    } else {
      const fakeEmail = `${username}@auratones.com`;
      try {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
        showToast('Đăng nhập thành công!', 'success');
      } catch (error: any) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          showToast('Mật khẩu không đúng. Vui lòng thử lại.', 'error');
        } else {
          showToast(`Lỗi đăng nhập: ${error.message}`, 'error');
        }
      }
    }
  };

  const handleUsernameRegister = async (username: string, password: string) => {
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
        photoURL: null,
      });
      showToast('Đăng ký thành công!', 'success');
    } catch (registerError: any) {
      showToast(`Lỗi đăng ký: ${registerError.message}`, 'error');
    }
  };

  const handleGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: result.user.email,
          username: null,
          photoURL: result.user.photoURL,
        });
      } else {
        await setDoc(userDocRef, { photoURL: result.user.photoURL }, { merge: true });
      }
      showToast('Đăng nhập bằng Google thành công!', 'success');
      
    } catch (error: any) {
      showToast(`Lỗi đăng nhập Google!`, 'error');
    }
  };


  const handleLogout = async () => {
    try {
      await signOut(auth);
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