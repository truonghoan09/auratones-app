// src/pages/HomePage.tsx
import React from 'react';
import Header from '../components/Header';
import '../styles/homepage.scss';
import { useAuthContext } from '../contexts/AuthContext';

interface HomePageProps {
  onLoginClick: () => void;
  onLogout: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onLoginClick, onLogout }) => {
  const {isAuthenticated} = useAuthContext()
  return (
    <>
      <Header
        onLoginClick={onLoginClick}
        onLogout={onLogout}
      />
      <div className='homepage-container'>
        <div className="homepage-content">
          <div className='homepage-card'>
            <section className="hero-section">
              <h1>Chào mừng đến với Auratones</h1>
              <p>Nền tảng học nhạc cụ tốt nhất dành cho bạn.</p>
              {isAuthenticated ? (
                <div className="logged-in-message">
                  <p>Bạn đã đăng nhập thành công. Hãy bắt đầu hành trình âm nhạc của mình!</p>
                  {/* Thêm các nút hoặc link dành cho người dùng đã đăng nhập */}
                  <a href="/dashboard" className="cta-button primary">Đi đến Dashboard</a>
                </div>
              ) : (
                <div className="guest-cta">
                  <p>Đăng ký ngay để truy cập kho tài liệu và các khóa học độc quyền.</p>
                  <button className="cta-button primary" onClick={onLoginClick}>
                    Đăng ký ngay!
                  </button>
                </div>
              )}
            </section>
            {/* Thêm các phần nội dung khác của trang chủ */}
            <section className="features-section">
              <h2>Các tính năng nổi bật</h2>
              <div className="features-grid">
                <div className="feature-item">
                  <h3>Kho hợp âm khổng lồ</h3>
                  <p>Tìm kiếm và luyện tập hàng ngàn hợp âm cho mọi loại nhạc cụ.</p>
                </div>
                <div className="feature-item">
                  <h3>Thư viện bài hát</h3>
                  <p>Hàng trăm bài hát được phân tích hợp âm, giúp bạn dễ dàng luyện tập.</p>
                </div>
                <div className="feature-item">
                  <h3>Khóa học chuyên sâu</h3>
                  <p>Học từ các chuyên gia với lộ trình rõ ràng, từ cơ bản đến nâng cao.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;