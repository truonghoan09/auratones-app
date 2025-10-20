// src/components/Auth.tsx
// NOTE: Chỉ validate khi submit. Chặn submit ẩn khi chuyển view/nhấn Enter ngoài input.
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import UserSetup from "./UserSetup";
import Toast from "./Toast";
import LoadingOverlay from "./LoadingOverlay";
import "../styles/auth.scss";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../contexts/I18nContext";

interface AuthProps {
  showToast: (message: string, type: "success" | "error" | "info") => void;
  isModal: boolean;
  onClose: () => void;
}

type ToastType = "success" | "error" | "info";

const Auth = ({ showToast, isModal, onClose }: AuthProps) => {
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [uErr, setUErr] = useState(false);
  const [pErr, setPErr] = useState(false);

  // validateOnlyOnSubmit
  const [validated, setValidated] = useState(false);

  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showToastLocal = useCallback(
    (message: string, type: ToastType = "info") => {
      setToast({ message, type });
      try { showToast?.(message, type); } catch {}
    },
    [showToast]
  );

  const {
    isLoginView,
    setIsLoginView,
    showUserSetupModal,
    setShowUserSetupModal,
    handleUsernameLogin,
    handleUsernameRegister,
    handleGoogleAuth,
  } = useAuth(showToastLocal, onClose);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    if (isModal) document.addEventListener("keydown", handleKeyDown);
    return () => { if (isModal) document.removeEventListener("keydown", handleKeyDown); };
  }, [isModal, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onClose) onClose();
  };

  const resetClientErrors = () => { setUErr(false); setPErr(false); setValidated(false); };

  const handleUserNotFoundConfirm = () => {
    setShowUserSetupModal(false);
    setIsLoginView(false);
    resetClientErrors();
  };
  const handleUserNotFoundCancel = () => {
    setShowUserSetupModal(false);
    setUsername("");
    setPassword("");
    resetClientErrors();
  };

  const applyServerError = useCallback((code?: string, fields?: string[]) => {
    if (!validated) return; // chỉ đánh dấu khi đã submit
    const fs = fields || [];
    if (fs.includes("username")) setUErr(true);
    if (fs.includes("password")) setPErr(true);

    const base = "header.auth.toast.";
    let key = "server_error_generic";
    switch (code) {
      case "MISSING_FIELDS": key = "missing_both"; break;
      case "USERNAME_REQUIRED": key = "missing_username"; break;
      case "PASSWORD_REQUIRED": key = "missing_password"; break;
      case "USER_NOT_FOUND": key = "user_not_found"; break;
      case "INCORRECT_PASSWORD": key = "incorrect_password"; break;
      case "NO_PASSWORD_ACCOUNT": key = "no_password_account"; break;
      case "USERNAME_TAKEN": key = "username_taken"; break;
      case "EMAIL_IN_USE": key = "email_in_use"; break;
      case "PASSWORD_TOO_SHORT": key = "password_too_short"; break;
      case "SERVER_ERROR": key = "server_error_generic"; break;
    }
    showToastLocal(t(base + key), "error");
  }, [showToastLocal, t, validated]);

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidated(true); // bật validate khi submit

    const u = username.trim();
    const p = password.trim();

    const missU = u.length === 0;
    const missP = p.length === 0;
    setUErr(missU);
    setPErr(missP);
    if (missU || missP) {
      const key = missU && missP ? "missing_both" : missU ? "missing_username" : "missing_password";
      showToastLocal(t("header.auth.toast." + key), "error");
      return;
    }

    setBusy(true);
    try {
      if (isLoginView) {
        const r = await handleUsernameLogin(u, p);
        if (!r || r.ok === false) {
          if (r && r.code) applyServerError(r.code, r.fields);
          return;
        }
        showToastLocal(t("header.auth.toast.login_success"), "success");
      } else {
        const r = await handleUsernameRegister(u, p);
        if (!r || r.ok === false) {
          if (r && r.code) applyServerError(r.code, r.fields);
          return;
        }
        showToastLocal(t("header.auth.toast.registered_success"), "success");
      }
    } catch (err: any) {
      const data = err?.response?.data || {};
      applyServerError(data.code, data.fields);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [
    username, password, isLoginView,
    handleUsernameLogin, handleUsernameRegister,
    showToastLocal, t, applyServerError
  ]);

  // Ngăn submit ẩn khi nhấn Enter ngoài input (vd: khi focus vào nút Switch)
  const onFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter") {
      const el = e.target as HTMLElement;
      const tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  // Switch view: không submit, không toast, reset lỗi/validated và ẩn toast đang mở
  const switchToRegister = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsLoginView(false);
    resetClientErrors();
    setToast(null);
  };
  const switchToLogin = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsLoginView(true);
    resetClientErrors();
    setToast(null);
  };

  return (
    <div className="auth-modal-overlay" onClick={handleOverlayClick}>
      {isModal && onClose && (
        <button className="close-btn" onClick={onClose} aria-label={t("auth.close")}>
          &times;
        </button>
      )}

      <form className="auth-form" onSubmit={onSubmit} onKeyDown={onFormKeyDown} onClick={(e) => e.stopPropagation()}>
        {isLoginView ? (
          <>
            <h2>{t("header.auth.login.title")}</h2>
            <input
              type="text"
              placeholder={t("header.auth.username_placeholder")}
              value={username}
              onChange={(e) => { setUsername(e.target.value); if (uErr) setUErr(false); }}
              aria-label={t("header.auth.username_label")}
              aria-invalid={uErr || undefined}
              className={uErr && validated ? "input-error" : undefined}
            />
            <input
              type="password"
              placeholder={t("header.auth.password_placeholder")}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (pErr) setPErr(false); }}
              aria-label={t("header.auth.password_label")}
              aria-invalid={pErr || undefined}
              className={pErr && validated ? "input-error" : undefined}
            />

            <div className="auth-extra">
              <Link to="/abc" className="forgot-link">{t("header.auth.forgot")}</Link>
            </div>

            <button type="submit">{t("header.auth.login.submit")}</button>
            <button type="button" onClick={switchToRegister}>
              {t("header.auth.login.to_register")}
            </button>

            <p className="auth-or">{t("header.auth.or")}</p>
            <button
              type="button"
              className="btn-google"
              onClick={() => { setBusy(true); handleGoogleAuth(); }}
              aria-label={t("header.auth.google_aria")}
            >
              <span className="google-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1565c0" d="M43.611,20.083L43.595,20L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571 c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
              </span>
              <span>Google</span>
            </button>
          </>
        ) : (
          <>
            <h2>{t("header.auth.register.title")}</h2>
            <input
              type="text"
              placeholder={t("header.auth.username_placeholder")}
              value={username}
              onChange={(e) => { setUsername(e.target.value); if (uErr) setUErr(false); }}
              aria-label={t("header.auth.username_label")}
              aria-invalid={uErr || undefined}
              className={uErr && validated ? "input-error" : undefined}
            />
            <input
              type="password"
              placeholder={t("header.auth.password_placeholder")}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (pErr) setPErr(false); }}
              aria-label={t("header.auth.password_label")}
              aria-invalid={pErr || undefined}
              className={pErr && validated ? "input-error" : undefined}
            />

            <button type="submit">{t("header.auth.register.submit")}</button>
            <button type="button" onClick={switchToLogin}>
              {t("header.auth.register.to_login")}
            </button>

            <p className="auth-or">{t("header.auth.or")}</p>
            <button
              type="button"
              className="btn-google"
              onClick={() => { setBusy(true); handleGoogleAuth(); }}
              aria-label={t("header.auth.google_aria")}
            >
              <span className="google-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#fbc02d" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#e53935" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4caf50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1565c0" d="M43.611,20.083L43.595,20L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571 c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
              </span>
              <span>Google</span>
            </button>
          </>
        )}
      </form>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showUserSetupModal && (
        <UserSetup
          username={username}
          onConfirm={handleUserNotFoundConfirm}
          onCancel={handleUserNotFoundCancel}
        />
      )}

      <LoadingOverlay
        open={busy}
        label={t("common.loading")}
        subLabel={t("common.please_wait")}
      />
    </div>
  );
};

export default Auth;
