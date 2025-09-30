import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import ThemeSwitcher from "./ThemeSwitcher";
import "../styles/header.scss";
import { useAuthContext } from "../contexts/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";
import Auth from "./Auth";

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const { isAuthenticated, user, userAvatar, isLoading, logout } = useAuthContext();
  const location = useLocation();
  const userProfileRef = useRef<HTMLDivElement>(null);

  const handleToggleMenu = useCallback(() => {
    if (!isLoading) setIsMenuOpen((v) => !v);
  }, [isLoading]);

  // đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (userProfileRef.current && !userProfileRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isMenuOpen]);

  // đóng dropdown khi nhấn Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsMenuOpen(false);
    if (isMenuOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

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
    return "Người dùng";
  }, [user]);

  const emailText = user?.email ?? "";
  const initials = useMemo(() => {
    const base = (user?.displayName || user?.username || user?.email || "A U").trim();
    const parts: string[] = base.replace(/@.*/, "").split(/\s+/).slice(0, 2);
    return parts.map((p: string) => p?.[0]?.toUpperCase() ?? "").join("");
  }, [user]);

  const plan = (user?.plan || "free") as "free" | "pro" | "enterprise" | "admin";

  const planLabel =
    plan === "pro"
      ? "Pro"
      : plan === "enterprise"
      ? "Enterprise"
      : plan === "admin"
      ? "Admin"
      : "Free";

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

  return (
    <>
      <header className="main-header">
        <div className="header-left">
          <Link to="/" className="header-logo">auratones</Link>

          <nav className="header-nav">
            <Link
              to="/chords"
              className={navClass("/chords")}
              aria-current={isActive("/chords") ? "page" : undefined}
            >
              Kho hợp âm
            </Link>
            <Link
              to="/songs"
              className={navClass("/songs")}
              aria-current={isActive("/songs") ? "page" : undefined}
            >
              Kho bài hát
            </Link>
            <Link
              to="/practice"
              className={navClass("/practice")}
              aria-current={isActive("/practice") ? "page" : undefined}
            >
              Ứng dụng học bài
            </Link>
            <Link
              to="/courses"
              className={navClass("/courses")}
              aria-current={isActive("/courses") ? "page" : undefined}
            >
              Khóa học
            </Link>
            <Link
              to="/theory"
              className={navClass("/theory")}
              aria-current={isActive("/theory") ? "page" : undefined}
            >
              Music theory
            </Link>
          </nav>
        </div>

        <div className="header-right">
          {isAuthenticated ? (
            <div className="user-profile" ref={userProfileRef}>
              <ThemeSwitcher />

              <button
                className="user-avatar"
                onClick={handleToggleMenu}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-busy={isLoading}
                title="Tài khoản"
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
                      <div className={`plan-badge plan-${plan}`} title={`Gói: ${planLabel}`}>{planLabel}</div>
                    </div>
                  </div>

                  <div className="dropdown-sep" />

                  <Link to="/profile" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>Hồ sơ</Link>
                  <Link to="/dashboard" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>Dashboard</Link>

                  {/* 👇 thêm option Admin nếu user là admin */}
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="dropdown-item"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Admin Page
                    </Link>
                  )}

                  <div className="dropdown-sep" />

                  <button className="dropdown-item danger" onClick={handleLogout}>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <ThemeSwitcher />
              <LanguageSwitcher />
              <button
                className="btn-primary"
                onClick={openAuth}
                disabled={isLoading}
                aria-busy={isLoading}
              >
                Đăng nhập / Đăng ký
              </button>
            </div>
          )}
        </div>
      </header>

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
