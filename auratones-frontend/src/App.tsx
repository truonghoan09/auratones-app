// src/App.tsx
import { BrowserRouter as Router } from 'react-router-dom';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import './styles/main.scss';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import AppRoutes from './AppRoutes';
import { useAuth } from './hooks/useAuth';
import { useModal } from './hooks/useModal';
import Auth from './components/Auth';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import usePersistRoute from './hooks/usePersistRoute';
import { DialogProvider } from './contexts/DialogContext';
import { DisplayModeProvider } from './contexts/DisplayModeContext';
import LoadingOverlay from './components/LoadingOverlay';
import NoteIconSprite from './assets/noteIconSprite';
import NotePrimitivesSprite from './components/common/NotePrimitivesSprite';

const AppContent = () => {
  usePersistRoute();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { message, type, showToast, hideToast } = useToast();
  const { showModal, isClosing, handleOpenModal, handleCloseModal } = useModal();
  const { handleLogout } = useAuth(showToast);
  const { isLoading } = useAuthContext();

  return (
    <div className={`app-container ${theme}`}>
      {/* luôn render routes */}
      <AppRoutes onLoginClick={handleOpenModal} onLogout={handleLogout} />

      {/* Overlay loading toàn cục */}
      <LoadingOverlay
        open={isLoading}
        label={t("common.loading")}
        subLabel={t("common.please_wait")}
      />

      {showModal && (
        <div className={`auth-modal-overlay ${isClosing ? 'fade-out' : ''}`}>
          <Auth showToast={showToast} isModal={true} onClose={handleCloseModal} />
        </div>
      )}

      {message && <Toast message={message} type={type} onClose={hideToast} />}
      <NoteIconSprite />
      <NotePrimitivesSprite />
    </div>
  );
};

function App() {
  return (
    <Router>
      <DisplayModeProvider>
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <DialogProvider>
                <AppContent />
              </DialogProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </DisplayModeProvider>
    </Router>
  );
}

export default App;
