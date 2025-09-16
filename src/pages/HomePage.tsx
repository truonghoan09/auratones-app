// src/pages/HomePage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/main.scss'; // Đảm bảo import file CSS gốc
import '../styles/homepage.scss';
import ThemeSwitcher from '../components/ThemeSwitcher';
import Header from '../components/Header';

// Định nghĩa các props mà HomePage sẽ nhận
interface HomePageProps {
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ isLoggedIn, onLoginClick, onLogout }) => {
  const navigate = useNavigate();

  return (
    <div className="homepage-container">
      <Header 
        isLoggedIn={isLoggedIn} 
        onLoginClick={onLoginClick} 
        onLogout={onLogout} 
      />
      <div className='homepage-content'>
        <div className="homepage-card">
          {/* Câu lệnh điều kiện để render nội dung */}
          {isLoggedIn ? (
            // Nội dung cho người dùng đã đăng nhập
            <>
              <h1>Chào mừng bạn trở lại!</h1>
              <p>Đây là nội dung tùy chỉnh dành riêng cho bạn.</p>
              <div className="button-group">
                <button 
                  className="btn-primary" 
                  onClick={onLogout}
                >
                  Đăng xuất
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={() => navigate('/settings')} // Ví dụ: chuyển đến trang cài đặt
                >
                  Cài đặt
                </button>
                <ThemeSwitcher />
              </div>
            </>
          ) : (
            // Nội dung công khai cho người chưa đăng nhập
            <>
              <h1>Chào mừng đến với trang chủ!</h1>
              <p>Đây là nội dung công khai, bạn có thể xem mà không cần đăng nhập.</p>
              <div className="button-group">
                <button className="btn-primary" onClick={onLoginClick}>
                  Đăng nhập / Đăng ký
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={() => navigate('/about')}
                >
                  Tìm hiểu thêm
                </button>
                <ThemeSwitcher />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;