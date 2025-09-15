// src/pages/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase-config';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface DashboardProps {
    onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [userDisplayName, setUserDisplayName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Lấy thông tin user từ Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Nếu có username, hiển thị username
          if (userData.username) {
            setUserDisplayName(userData.username);
          } else if (currentUser.email) {
            // Nếu không có username (đăng nhập Google), hiển thị email
            setUserDisplayName(currentUser.email);
          }
        } else {
          // Trường hợp lỗi, hiển thị email
          setUserDisplayName(currentUser.email || '');
        }
      } else {
        navigate('/'); // Nếu chưa đăng nhập, chuyển về trang Auth
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Chào mừng đến với AuraTones!</h1>
      <p>Bạn đã đăng nhập thành công với: {userDisplayName}</p>
      <button onClick={handleLogout}>Đăng xuất</button>
    </div>
  );
};

export default Dashboard;