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

const AppContent = () => {
  const { theme } = useTheme();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const { message, type, showToast, hideToast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  const handleCloseModal = () => {
    setIsClosing(true);
  };

  const onAnimationEnd = () => {
    if (isClosing) {
      setShowLoginModal(false);
      setIsClosing(false);
    }
  };

  const handleLoginSuccess = () => {
        setIsLoggedIn(true);
        setShowLoginModal(false);
        showToast('Đăng nhập thành công!', 'success');
    };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('Đã đăng xuất', 'info');
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
      showToast('Đăng xuất thất bại', 'error');
    }
  };

  useEffect(() => {
        if (isLoggedIn) {
            navigate('/dashboard');
        } else {
            navigate('/');
        }
    }, [isLoggedIn, navigate]);

  return (
    <div className={`app-container ${theme}`}>
      <Routes>
        <Route path="/" element={<HomePage onLoginClick={() => setShowLoginModal(true)} />} />
        <Route path="/dashboard" element={isLoggedIn ? <Dashboard onLogout={handleLogout} /> : <HomePage onLoginClick={() => setShowLoginModal(true)} />} />
      </Routes>
      
      {showLoginModal && (
        <div 
          className={`auth-modal-overlay ${isClosing ? 'fade-out' : ''}`} 
          onAnimationEnd={onAnimationEnd}
        >
          <Auth 
            showToast={showToast} 
            isModal={true} 
            onClose={handleCloseModal} 
            onLoginSuccess={handleLoginSuccess}
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