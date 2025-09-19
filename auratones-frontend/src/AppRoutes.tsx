// src/AppRoutes.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';

interface AppRoutesProps {
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  userAvatar: string | null;
}

const AppRoutes: React.FC<AppRoutesProps> = ({ isLoggedIn, onLoginClick, onLogout, userAvatar }) => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage
            isLoggedIn={isLoggedIn}
            onLoginClick={onLoginClick}
            onLogout={onLogout}
            userAvatar={userAvatar}
          />
        }
      />
      {/* Thêm các route khác của bạn ở đây */}
    </Routes>
  );
};

export default AppRoutes;