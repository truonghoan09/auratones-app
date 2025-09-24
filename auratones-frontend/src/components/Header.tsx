// src/components/Header.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeSwitcher from './ThemeSwitcher';
import '../styles/header.scss';
import { useAuthContext } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

interface HeaderProps {
  onLoginClick: () => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLoginClick, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, user, userAvatar, isLoading } = useAuthContext();
  const userProfileRef = useRef<HTMLDivElement>(null);

  const handleToggleMenu = () => setIsMenuOpen((v) => !v);

  // close khi click ra ngoài
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (userProfileRef.current && !userProfileRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  // close khi nhấn Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    if (isMenuOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  // --------- helpers hiển thị ----------
  const displayName = useMemo(() => {
    if (user?.displayName) return user.displayName;
    if (user?.username) return user.username;
    if (user?.email) return user.email.split('@')[0];
    return 'Người dùng';
  }, [user]);

  const emailText = user?.email ?? '';

  const initials = useMemo(() => {
    const base = (user?.displayName || user?.username || user?.email || 'A U').trim();
    const parts = base.replace(/@.*/, '').split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || '').join('');
  }, [user]);

  const plan = (user?.plan || 'free').toLowerCase();
  const planLabel = plan === 'pro' ? 'Pro' : plan === 'enterprise' ? 'Enterprise' : 'Free';

  return (
    <header className="main-header">
      <div className="header-left">
        <Link to="/" className="header-logo">auratones</Link>
        <nav className="header-nav">
          <Link to="/chords" className="nav-link">Kho hợp âm</Link>
          <Link to="/songs" className="nav-link">Kho bài hát</Link>
          <Link to="/practice" className="nav-link">Ứng dụng học bài</Link>
          <Link to="/courses" className="nav-link">Khóa học</Link>
          <Link to="/theory" className="nav-link">Music theory</Link>
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
              title="Tài khoản"
            >
              {isLoading ? (
                // skeleton nhỏ khi đang hydrate
                <span className="avatar-skeleton" aria-hidden="true" />
              ) : userAvatar ? (
                <img className='avatar-onheader' src={userAvatar} alt="User Avatar" />
              ) : (
                <span className="avatar-fallback" aria-hidden="true">{initials}</span>
              )}
            </button>

            {isMenuOpen && (
              <div className="dropdown-menu" role="menu">
                {/* Header info trong dropdown */}
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
                    <div className={`plan-badge plan-${plan}`} title={`Gói: ${planLabel}`}>
                      {planLabel}
                    </div>
                  </div>
                </div>

                <div className="dropdown-sep" />

                <Link to="/profile" className="dropdown-item" onClick={handleToggleMenu}>
                  Hồ sơ
                </Link>
                <Link to="/dashboard" className="dropdown-item" onClick={handleToggleMenu}>
                  Dashboard
                </Link>

                <div className="dropdown-sep" />

                <button
                  className="dropdown-item danger"
                  onClick={() => {
                    onLogout();
                    setIsMenuOpen(false);
                  }}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="auth-buttons">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <button className="btn-primary" onClick={onLoginClick}>
              Đăng nhập / Đăng ký
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
