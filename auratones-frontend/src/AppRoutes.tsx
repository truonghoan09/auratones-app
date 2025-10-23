// src/AppRoutes.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AuthSuccess from './pages/AuthSuccess';
import AuthError from './pages/AuthError';
import ChordPage from './pages/ChordPage';
import AdminGuard from './components/guards/AdminGuard';
import AdminPage from './pages/AdminPage';
import NotFound from './pages/NotFound';
import UnderConstruction from './pages/UnderConstruction';
import PracticeApp from './pages/PracticeApp';

interface AppRoutesProps {
  onLoginClick: () => void;
  onLogout: () => void;
}

const AppRoutes: React.FC<AppRoutesProps> = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage/>
        }
      />
      <Route path="/chords" element={<ChordPage />} />
      <Route path="/auth/success" element={<AuthSuccess />} />
      <Route path="/auth/error" element={<AuthError />} />
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminPage />
          </AdminGuard>}
      />
      <Route path="/songs" element={<UnderConstruction />} />
      <Route path="/practice" element={<PracticeApp />} />
      <Route path="/courses" element={<UnderConstruction />} />
      <Route path="/theory" element={<UnderConstruction />} />
      {/* Thêm các route khác của bạn ở đây */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;