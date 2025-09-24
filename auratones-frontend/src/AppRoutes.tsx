// src/AppRoutes.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AuthSuccess from './pages/AuthSuccess';
import AuthError from './pages/AuthError';
import ChordPage from './pages/ChordPage';

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
      <Route path="/chords" element={<ChordPage />} />
      <Route path="/auth/success" element={<AuthSuccess />} />
      <Route path="/auth/error" element={<AuthError />} />
      {/* Thêm các route khác của bạn ở đây */}
    </Routes>
  );
};

export default AppRoutes;