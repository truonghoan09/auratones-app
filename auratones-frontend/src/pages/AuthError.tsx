// src/pages/AuthError.tsx
import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/auth-intents.scss';

export default function AuthError() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const reason = useMemo(() => new URLSearchParams(search).get('reason') || 'unknown', [search]);

  const message = useMemo(() => {
    switch (reason) {
      case 'missing_token':
        return 'Thiếu mã đăng nhập. Vui lòng thử lại.';
      case 'hydrate_failed':
        return 'Xác thực thất bại khi tải hồ sơ. Vui lòng thử lại.';
      case 'oauth_denied':
        return 'Bạn đã huỷ đăng nhập Google.';
      default:
        return 'Đã xảy ra lỗi không xác định.';
    }
  }, [reason]);

  return (
    <div className="auth-error">
      <div className="card">
        <div className="icon-wrap" aria-hidden="true">
          <svg className="cross" viewBox="0 0 52 52">
            <circle className="cross__circle" cx="26" cy="26" r="25" fill="none" />
            <path className="cross__path cross__path--left" d="M16 16 36 36" />
            <path className="cross__path cross__path--right" d="M36 16 16 36" />
          </svg>
        </div>

        <h1 className="title">Đăng nhập không thành công</h1>
        <p className="subtitle">{message}</p>

        <div className="actions">
          <button className="secondary-btn" onClick={() => navigate('/', { replace: true })}>
            Về trang chủ
          </button>
          <button className="primary-btn" onClick={() => (window.location.href = '/api/auth/google')}>
            Thử đăng nhập lại
          </button>
        </div>
      </div>
    </div>
  );
}
