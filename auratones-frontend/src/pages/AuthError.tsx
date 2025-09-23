// src/pages/AuthError.tsx
import { useNavigate } from 'react-router-dom';
import '../styles/auth-error.scss';

export default function AuthError() {
  const navigate = useNavigate();

  return (
    <div className="auth-error">
      <div className="card">
        <div className="icon-wrap" aria-hidden="true">
          <svg className="crossmark" viewBox="0 0 52 52">
            <circle className="crossmark__circle" cx="26" cy="26" r="25" fill="none" />
            <path className="crossmark__cross" d="M16 16 36 36 M36 16 16 36" />
          </svg>
        </div>

        <h1 className="title">Đăng nhập thất bại</h1>
        <p className="subtitle">
          Có sự cố khi đăng nhập bằng Google. Vui lòng thử lại sau.
        </p>

        <div className="actions">
          <button className="primary-btn" onClick={() => navigate('/auth')}>
            Thử lại
          </button>
          <button className="secondary-btn" onClick={() => navigate('/')}>
            Về trang chủ
          </button>
        </div>
      </div>

      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} style={{ ['--d' as any]: `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
}
