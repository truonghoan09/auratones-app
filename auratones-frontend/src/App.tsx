// src/App.tsx
import { BrowserRouter as Router } from 'react-router-dom';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import './styles/main.scss';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import AppRoutes from './AppRoutes';
import { useAuth } from './hooks/useAuth';
import { useModal } from './hooks/useModal';
import { useUserProfile } from './hooks/useUserProfile';
import LoadingModal from './components/LoadingModal';
import Auth from './components/Auth';

const AppContent = () => {
    const { theme } = useTheme();
    const { message, type, showToast, hideToast } = useToast();
    const { showModal, isClosing, handleOpenModal, handleCloseModal } = useModal();
    const { handleLogout } = useAuth(showToast);
    const { isLoggedIn, userAvatar, isLoading } = useUserProfile();

    return (
        <div className={`app-container ${theme}`}>
            {isLoading ? (
                <LoadingModal isOpen={true} />
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