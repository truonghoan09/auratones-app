// src/components/Header.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeSwitcher from './ThemeSwitcher';
import '../styles/header.scss';

interface HeaderProps {
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  userAvatar: string | null;
}

const Header: React.FC<HeaderProps> = ({ isLoggedIn, onLoginClick, onLogout, userAvatar }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const userProfileRef = useRef<HTMLDivElement>(null);

  const handleToggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (userProfileRef.current && !userProfileRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isMenuOpen]);

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
        {isLoggedIn ? (
          <div className="user-profile" ref={userProfileRef}>
            <ThemeSwitcher />
            <button className="user-avatar" onClick={handleToggleMenu}>
              {userAvatar  ? (
                <img src={userAvatar} alt="User Avatar" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-person-circle" viewBox="0 0 16 16">
                  <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0"/>
                  <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1"/>
                </svg>
              )}
            </button>
            {isMenuOpen && (
              <div className="dropdown-menu">
                <Link to="/profile" className="dropdown-item" onClick={handleToggleMenu}>Hồ sơ</Link>
                <Link to="/dashboard" className="dropdown-item" onClick={handleToggleMenu}>Dashboard</Link>
                <button className="dropdown-item" onClick={() => {
                  onLogout();
                  handleToggleMenu();
                }}>Đăng xuất</button>
              </div>
            )}
          </div>
        ) : (
          <div className="auth-buttons">
            <ThemeSwitcher />
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