// src/App.tsx
import { BrowserRouter as Router } from 'react-router-dom';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import './styles/main.scss';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import AppRoutes from './AppRoutes';
import { useAuth } from './hooks/useAuth';
import { useModal } from './hooks/useModal';
import LoadingModal from './components/LoadingModal';
import Auth from './components/Auth';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { useUserProfile } from './hooks/useUserProfile';
import { I18nProvider } from './contexts/I18nContext';

const AppContent = () => {
    useUserProfile();
    const { theme } = useTheme();
    const { message, type, showToast, hideToast } = useToast();
    const { showModal, isClosing, handleOpenModal, handleCloseModal } = useModal();
    const { handleLogout } = useAuth(showToast);
    const { isLoading } = useAuthContext();

    return (
        <div className={`app-container ${theme}`}>
            {isLoading ? (
                <LoadingModal isOpen={true} />
            ) : (
                <AppRoutes
                    onLoginClick={handleOpenModal}
                    onLogout={handleLogout}
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
            <I18nProvider>
                <ThemeProvider>
                    <AuthProvider>
                        <AppContent />
                    </AuthProvider>
                </ThemeProvider>
            </I18nProvider>
        </Router>
    );
}

export default App;