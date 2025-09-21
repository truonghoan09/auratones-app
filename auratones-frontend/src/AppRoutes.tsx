// src/AppRoutes.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';

interface AppRoutesProps {
  onLoginClick: () => void;
  onLogout: () => void;
}

const AppRoutes: React.FC<AppRoutesProps> = ({ onLoginClick, onLogout }) => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage
            onLoginClick={onLoginClick}
            onLogout={onLogout}
          />
        }
      />
      {/* Thêm các route khác của bạn ở đây */}
    </Routes>
  );
};

export default AppRoutes;