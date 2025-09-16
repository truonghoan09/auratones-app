// src/components/Header.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeSwitcher from './ThemeSwitcher';
import '../styles/header.scss';

interface HeaderProps {
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ isLoggedIn, onLoginClick, onLogout }) => {
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

    // Dọn dẹp event listener khi component unmount
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
          // Giao diện khi đã đăng nhập
          <div className="user-profile">
            <ThemeSwitcher />
            <button className="user-avatar" onClick={handleToggleMenu}>
              <img src="https://via.placeholder.com/40" alt="User Avatar" />
            </button>
            {isMenuOpen && (
              <div className="dropdown-menu" ref={userProfileRef}>
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
          // Giao diện khi chưa đăng nhập
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