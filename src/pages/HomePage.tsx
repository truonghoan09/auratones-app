// src/pages/HomePage.tsx
import { useNavigate } from 'react-router-dom';
import '../styles/main.scss'; // Đảm bảo import file CSS gốc
import '../styles/homepage.scss';
import ThemeSwitcher from '../components/ThemeSwitcher';

const HomePage = ({ onLoginClick }: { onLoginClick: () => void }) => {
  const navigate = useNavigate();

  return (
    <div className="homepage-container">
      <div className="homepage-card">
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
      </div>
    </div>
  );
};

export default HomePage;