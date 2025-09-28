// src/pages/AdminPage.tsx
import React from 'react';
import { useAuthContext } from '../contexts/AuthContext';

const AdminPage: React.FC = () => {
  const { user } = useAuthContext();

  return (
    <div className="admin-page">
      <h1>👋 Xin chào Admin</h1>
      <p>Chúc mừng, bạn đã đăng nhập với quyền <strong>{user?.role}</strong>.</p>
      <p>Tài khoản: {user?.username || user?.email}</p>
    </div>
  );
};

export default AdminPage;
