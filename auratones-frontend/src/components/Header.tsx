import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import ThemeSwitcher from "./ThemeSwitcher";
import "../styles/header.scss";
import { useAuthContext } from "../contexts/AuthContext";
import Auth from "./Auth";

// Context quản lý chế độ hiển thị hợp âm (symbol/text)
import { useDisplayMode } from "../contexts/DisplayModeContext";
import { useI18n } from "../contexts/I18nContext";

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);   // user dropdown (desktop)
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);   // mobile drawer

  const { t, lang, setLang } = useI18n();
  const { mode, toggle } = useDisplayMode(); // "symbol" | "text"
  const isSymbol = mode === "symbol";

  const { isAuthenticated, user, userAvatar, isLoading, logout } = useAuthContext();
  const location = useLocation();
  const userProfileRef = useRef<HTMLDivElement>(null);

  // Desktop user dropdown toggle
  const handleToggleMenu = useCallback(() => {
    if (!isLoading) setIsMenuOpen((v) => !v);
  }, [isLoading]);

  // Mobile drawer controls
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // đóng dropdown khi click ra ngoài (desktop dropdown)
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (userProfileRef.current && !userProfileRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMenuOpen]);

  // ESC đóng dropdown & mobile nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        setMobileOpen(false);
      }
    };
    if (isMenuOpen || mobileOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMenuOpen, mobileOpen]);

  // Đóng mobile nav khi đổi route
  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
    // eslint-disable-next-line
  }, [location.pathname]);

  // ===== Active helpers =====
  const isActive = useCallback(
    (to: string) => {
      const cur = location.pathname.replace(/\/+$/, "");
      const base = to.replace(/\/+$/, "");
      return cur === base || cur.startsWith(base + "/");
    },
    [location.pathname]
  );
  const navClass = useCallback(
    (to: string) => `nav-link${isActive(to) ? " active" : ""}`,
    [isActive]
  );

  // helpers hiển thị
  const displayName = useMemo(() => {
    if (user?.displayName) return user.displayName;
    if (user?.username) return user.username;
    if (user?.email) return user.email.split("@")[0];
    return t("header.user_fallback");
  }, [user, t]);

  const emailText = user?.email ?? "";
  const initials = useMemo(() => {
    const base = (user?.displayName || user?.username || user?.email || "A U").trim();
    const parts: string[] = base.replace(/@.*/, "").split(/\s+/).slice(0, 2);
    return parts.map((p: string) => p?.[0]?.toUpperCase() ?? "").join("");
  }, [user]);

  const plan = (user?.plan || "free") as "free" | "pro" | "enterprise" | "admin";
  const planLabel =
    plan === "pro"
      ? t("header.plan.pro")
      : plan === "enterprise"
      ? t("header.plan.enterprise")
      : plan === "admin"
      ? t("header.plan.admin")
      : t("header.plan.free");

  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);
  const showToast = useCallback((message: string, type: "success" | "error" | "info") => {
    (window as any).__toast?.(message, type);
    if (type === "error") console.error(message);
    else if (type === "success") console.log(message);
    else console.info(message);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setIsMenuOpen(false);
  }, [logout]);

  // Language smart toggle
  const toggleLang = useCallback(() => {
    const next = lang === "vi" ? "en" : "vi";
    setLang?.(next);
  }, [lang, setLang]);
  const langLabel = (lang || "vi").toUpperCase();
  const langAria = lang === "vi" ? "Switch language to English" : "Chuyển ngôn ngữ sang Tiếng Việt";

  return (
    <>
      <header className="main-header">
        <div className="header-left">
          <Link to="/" className="header-logo">auratones</Link>

          {/* DESKTOP/TABLET NAV (ẩn trên <=900px) */}
          <nav className="header-nav" aria-label="primary">
            <Link to="/chords" className={navClass("/chords")} aria-current={isActive("/chords") ? "page" : undefined}>
              {t("header.nav.chords")}
            </Link>
            <Link to="/songs" className={navClass("/songs")} aria-current={isActive("/songs") ? "page" : undefined}>
              {t("header.nav.songs")}
            </Link>
            <Link to="/practice" className={navClass("/practice")} aria-current={isActive("/practice") ? "page" : undefined}>
              {t("header.nav.practice")}
            </Link>
            <Link to="/courses" className={navClass("/courses")} aria-current={isActive("/courses") ? "page" : undefined}>
              {t("header.nav.courses")}
            </Link>
            <Link to="/theory" className={navClass("/theory")} aria-current={isActive("/theory") ? "page" : undefined}>
              {t("header.nav.theory")}
            </Link>
          </nav>
        </div>

        <div className="header-right">
          {/* HAMBURGER: hiện ở <=900px, ẩn ở desktop */}
          <button
            className={`nav-toggle${mobileOpen ? " is-open" : ""}`}
            aria-label="Open navigation"
            aria-controls="mobile-nav"
            aria-expanded={mobileOpen}
            onClick={toggleMobile}
          >
            <span className="bar" /><span className="bar" /><span className="bar" />
          </button>

          {/* DESKTOP controls (ẩn ở <=900px) */}
          {isAuthenticated ? (
            <div className="user-profile" ref={userProfileRef}>
              <button type="button" className="chip chip-theme" title="Theme" aria-label="Theme">
                <ThemeSwitcher />
              </button>

              <button
                type="button"
                className="chip chip-lang"
                onClick={toggleLang}
                aria-label={langAria}
                title={langAria}
              >
                <span className="chip-icon" aria-hidden="true">🌐</span>
                <span className="chip-label">{langLabel}</span>
              </button>

              <button
                className="user-avatar"
                onClick={handleToggleMenu}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-busy={isLoading}
                title={t("header.account")}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="avatar-skeleton" aria-hidden="true" />
                ) : userAvatar ? (
                  <img className="avatar-onheader" src={userAvatar} alt="User Avatar" />
                ) : (
                  <span className="avatar-fallback" aria-hidden="true">{initials}</span>
                )}
              </button>

              {isMenuOpen && (
                <div className="dropdown-menu" role="menu">
                  <div className="dropdown-header">
                    <div className="dropdown-header-left">
                      {userAvatar ? (
                        <img className="dropdown-avatar" src={userAvatar} alt="User Avatar" />
                      ) : (
                        <div className="dropdown-avatar fallback" aria-hidden="true">{initials}</div>
                      )}
                    </div>
                    <div className="dropdown-header-right">
                      <div className="dropdown-name">{displayName}</div>
                      {emailText && <div className="dropdown-email">{emailText}</div>}
                      <div className={`plan-badge plan-${plan}`} title={t("header.plan_badge_title", { plan: planLabel })}>
                        {planLabel}
                      </div>
                    </div>
                  </div>

                  <div className="dropdown-sep" />

                  <button
                    type="button"
                    className={`dropdown-item icon-toggle${isSymbol ? " is-on" : ""}`}
                    role="switch"
                    aria-checked={isSymbol}
                    onClick={toggle}
                    title={isSymbol ? t("header.chord_display.title_on") : t("header.chord_display.title_off")}
                  >
                    <span className="icon-toggle__left">
                      {isSymbol ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                          <path fill="currentColor" d="M5 3a5 5 0 0 0 0 10h6a5 5 0 0 0 0-10zm6 9a4 4 0 1 1 0-8 4 4 0 0 1 0 8"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                          <path fill="currentColor" d="M11 4a4 4 0 0 1 0 8H8a5 5 0 0 0 2-4 5 5 0 0 0-2-4zm-6 8a4 4 0 1 1 0-8 4 4 0 0 1 0 8M0 8a5 5 0 0 0 5 5h6a5 5 0 0 0 0-10H5a5 5 0 0 0-5 5"/>
                        </svg>
                      )}
                    </span>
                    <span className="icon-toggle__label">
                      {t("header.chord_display.label")}
                      <span className="icon-toggle__value">
                        {isSymbol ? t("header.chord_display.symbol") : t("header.chord_display.text")}
                      </span>
                    </span>
                  </button>

                  <Link to="/profile" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>{t("header.profile")}</Link>
                  <Link to="/dashboard" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>{t("header.dashboard")}</Link>

                  {user?.role === 'admin' && (
                    <Link to="/admin" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>{t("header.admin")}</Link>
                  )}

                  <div className="dropdown-sep" />

                  <button className="dropdown-item danger" onClick={handleLogout}>{t("header.signout")}</button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <button type="button" className="chip chip-theme" title="Theme" aria-label="Theme">
                <ThemeSwitcher />
              </button>
              <button
                type="button"
                className="chip chip-lang"
                onClick={toggleLang}
                aria-label={langAria}
                title={langAria}
              >
                <span className="chip-icon" aria-hidden="true">🌐</span>
                <span className="chip-label">{langLabel}</span>
              </button>
              <button
                className="btn-primary"
                onClick={openAuth}
                disabled={isLoading}
                aria-busy={isLoading}
              >
                {t("header.login_cta")}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ===== MOBILE / TABLET DRAWER ===== */}
      <div id="mobile-nav" className={`mobile-nav${mobileOpen ? " open" : ""}`} aria-hidden={!mobileOpen}>
        <div className="mobile-nav__inner" role="dialog" aria-label="Navigation drawer">
          <div className="mobile-head">
            <Link to="/" className="mobile-logo" onClick={closeMobile}>auratones</Link>
            <button className="mobile-close" aria-label="Close" onClick={closeMobile}>✕</button>
          </div>

          <div className="mobile-controls">
            <button type="button" className="chip chip-theme" title="Theme" aria-label="Theme"><ThemeSwitcher /></button>
            <button type="button" className="chip chip-lang" onClick={toggleLang} aria-label={langAria} title={langAria}>
              <span className="chip-icon" aria-hidden="true">🌐</span>
              <span className="chip-label">{langLabel}</span>
            </button>
          </div>

          <nav className="mobile-links" role="navigation" aria-label="mobile">
            <Link to="/chords" onClick={closeMobile} className={isActive("/chords") ? "active" : ""}>{t("header.nav.chords")}</Link>
            <Link to="/songs" onClick={closeMobile} className={isActive("/songs") ? "active" : ""}>{t("header.nav.songs")}</Link>
            <Link to="/practice" onClick={closeMobile} className={isActive("/practice") ? "active" : ""}>{t("header.nav.practice")}</Link>
            <Link to="/courses" onClick={closeMobile} className={isActive("/courses") ? "active" : ""}>{t("header.nav.courses")}</Link>
            <Link to="/theory" onClick={closeMobile} className={isActive("/theory") ? "active" : ""}>{t("header.nav.theory")}</Link>
          </nav>

          {isAuthenticated ? (
            <div className="mobile-user">
              <div className="mu-row">
                {userAvatar ? (
                  <img className="mu-avatar" src={userAvatar} alt="User Avatar" />
                ) : (
                  <div className="mu-avatar fallback" aria-hidden="true">{initials}</div>
                )}
                <div className="mu-meta">
                  <div className="mu-name">{displayName}</div>
                  {emailText && <div className="mu-email">{emailText}</div>}
                  <div className={`mu-plan plan-${plan}`}>{planLabel}</div>
                </div>
              </div>

              <div className="mobile-user-links">
                <Link to="/profile" onClick={closeMobile}>{t("header.profile")}</Link>
                <Link to="/dashboard" onClick={closeMobile}>{t("header.dashboard")}</Link>
                {user?.role === 'admin' && <Link to="/admin" onClick={closeMobile}>{t("header.admin")}</Link>}
                <button className="danger" onClick={() => { closeMobile(); handleLogout(); }}>{t("header.signout")}</button>
              </div>
            </div>
          ) : (
            <div className="mobile-auth">
              <button className="btn-primary" onClick={() => { closeMobile(); openAuth(); }}>
                {t("header.login_cta")}
              </button>
            </div>
          )}
        </div>

        {/* SCRIM */}
        <button className="mobile-scrim" aria-label="Close navigation" onClick={closeMobile} />
      </div>

      {authOpen && (
        <Auth
          showToast={showToast}
          isModal={true}
          onClose={closeAuth}
        />
      )}
    </>
  );
};

export default Header;
