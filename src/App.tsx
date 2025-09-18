// src/App.tsx
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Auth from './components/Auth';
import Dashboard from './pages/Dashboard';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import './styles/main.scss';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import HomePage from './pages/HomePage';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase-config';
import AppRoutes from './AppRoutes';
import { useAuth } from './hooks/useAuth';
import { useModal } from './hooks/useModal';
import { useUserProfile } from './hooks/useUserProfile';
import LoadingModal from './components/LoadingModal';

const AppContent = () => {

  const { theme } = useTheme();
  const { message, type, showToast, hideToast } = useToast();
  const { showModal, isClosing, handleOpenModal, handleCloseModal } = useModal();
  const { 
    isLoginView, 
    setIsLoginView, 
    showUserSetupModal, 
    setShowUserSetupModal, 
    handleUsernameLogin, 
    handleUsernameRegister, 
    handleGoogleAuth, 
    handleLogout 
  } = useAuth(showToast, handleCloseModal);

  const { isLoggedIn, userAvatar, isLoading } = useUserProfile();

  return (
    <div className={`app-container ${theme}`}>
      { isLoading ? (
        <LoadingModal isOpen={true}/>
      ) : (
        <AppRoutes
        isLoggedIn={isLoggedIn}
        onLoginClick={handleOpenModal}
        onLogout={handleLogout}
        userAvatar={userAvatar}
      />
      )}
      


      {showModal && (
        <div 
          className={`auth-modal-overlay ${isClosing ? 'fade-out' : ''}`} 
        >
          <Auth 
            showToast={showToast} 
            isModal={true} 
            onClose={handleCloseModal} 
            isLoginView={isLoginView}
            setIsLoginView={setIsLoginView}
            showUserSetupModal={showUserSetupModal}
            setShowUserSetupModal={setShowUserSetupModal}
            handleUsernameLogin={handleUsernameLogin}
            handleUsernameRegister={handleUsernameRegister}
            handleGoogleAuth={handleGoogleAuth}
          />
        </div>  
      )}

      {message && <Toast message={message} type={type} onClose={hideToast} />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </Router>
  );
}

export default App;