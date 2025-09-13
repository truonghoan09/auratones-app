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
import UserSetup from './UserSetup'; // Import lại UserSetup

// Hàm kiểm tra username đã tồn tại chưa
const isUsernameTaken = async (username: string): Promise<boolean> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', username));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
};

const Auth = ({ showToast }: { showToast: (msg: string, type: 'success' | 'error' | 'info') => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  const navigate = useNavigate();

  // Theo dõi trạng thái đăng nhập
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        navigate('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Xử lý đăng nhập bằng username
 const handleUsernameLogin = async () => {
    if (!username || !password) {
      showToast('Vui lòng nhập đầy đủ tên người dùng và mật khẩu.', 'error');
      return;
    }

    // Bước 1: Kiểm tra username có tồn tại trong Firestore không
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // Nếu không tồn tại, hiển thị modal hỏi đăng ký
      setShowUserNotFoundModal(true);
    } else {
      // Nếu username tồn tại, lấy email giả để đăng nhập
      const fakeEmail = `${username}@auratones.com`;
      try {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
        showToast('Đăng nhập thành công!', 'success');
        navigate('/dashboard');
      } catch (error: any) {
        // Xử lý cả hai lỗi: sai mật khẩu hoặc thông tin không hợp lệ
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          showToast('Mật khẩu không đúng. Vui lòng thử lại.', 'error');
        } else {
          showToast(`Lỗi đăng nhập: ${error.message}`, 'error');
        }
      }
    }
  };

  // Xử lý đăng ký bằng username
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
      navigate('/dashboard');
    } catch (registerError: any) {
      showToast(`Lỗi đăng ký: ${registerError.message}`, 'error');
    }
  };

  // Xử lý đăng nhập bằng Google
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
      navigate('/dashboard');
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
    setShowUserNotFoundModal(false);
    setIsLoginView(false);
  };

  const handleUserNotFoundCancel = () => {
    setShowUserNotFoundModal(false);
    setUsername('');
    setPassword('');
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
      {user ? (
        <div>
          <h2>Xin chào, {user.email || 'Người dùng'}!</h2>
          <button onClick={handleLogout}>Đăng xuất</button>
        </div>
      ) : (
        <>
          {isLoginView ? (
            <div>
              <h2>Đăng nhập</h2>
              <input type="text" placeholder="Tên người dùng" value={username} onChange={(e) => setUsername(e.target.value)} />
              <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button onClick={handleUsernameLogin}>Đăng nhập</button>
              <button onClick={() => setIsLoginView(false)}>Chuyển sang đăng ký</button>
              <p>hoặc</p>
              <button onClick={handleGoogleAuth}>Đăng nhập bằng Google</button>
            </div>
          ) : (
            <div>
              <h2>Đăng ký</h2>
              <input type="text" placeholder="Tên người dùng" value={username} onChange={(e) => setUsername(e.target.value)} />
              <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button onClick={handleUsernameRegister}>Đăng ký</button>
              <button onClick={() => setIsLoginView(true)}>Chuyển sang đăng nhập</button>
              <p>hoặc</p>
              <button onClick={handleGoogleAuth}>Đăng nhập bằng Google</button>
            </div>
          )}
          {showUserNotFoundModal && (
            <UserSetup
              username={username}
              onConfirm={handleUserNotFoundConfirm}
              onCancel={handleUserNotFoundCancel}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Auth;