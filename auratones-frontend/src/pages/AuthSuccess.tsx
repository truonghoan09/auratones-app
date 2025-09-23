// src/pages/AuthSuccess.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import '../styles/auth-success.scss';

export default function AuthSuccess() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuthContext();

  // progress bar state
  const [progress, setProgress] = useState(0);

  // refs để chống chạy lặp (StrictMode) & quản lý timer
  const ranRef = useRef(false);
  const tickRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const returnTo = params.get('returnTo'); // tuỳ chọn: trang cần quay về

    // dọn sạch query (?token=...&returnTo=...)
    const cleanUrl = () =>
      window.history.replaceState({}, document.title, window.location.pathname);

    if (!token) {
      cleanUrl();
      navigate('/auth/error?reason=missing_token', { replace: true });
      return;
    }

    // tăng progress dần tới 90% trong lúc hydrate
    let done = false;
    tickRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (done) return p;
        const next = p + 2;
        return next >= 90 ? 90 : next;
      });
    }, 40);

    (async () => {
      try {
        await loginWithToken(token); // Lưu token + gọi /auth/me
        done = true;
        setProgress(100);
        cleanUrl();

        // chờ nhẹ để người dùng thấy 100%, sau đó điều hướng
        const target = returnTo && returnTo.startsWith('/') ? returnTo : '/';
        timeoutRef.current = window.setTimeout(
          () => navigate(target, { replace: true }),
          220
        );
      } catch {
        cleanUrl();
        navigate('/auth/error?reason=hydrate_failed', { replace: true });
      } finally {
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
      }
    })();

    // cleanup timers khi unmount
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [loginWithToken, navigate]);

  return (
    <div className="auth-success">
      <div className="card">
        <div className="icon-wrap" aria-hidden="true">
          <svg className="checkmark" viewBox="0 0 52 52">
            <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
            <path className="checkmark__check" fill="none" d="M14 27l7 7 17-17" />
          </svg>
        </div>

        <h1 className="title">Đăng nhập thành công</h1>
        <p className="subtitle">Đang chuẩn bị đưa bạn về Auratones 🎵</p>

        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.max(0, Math.min(100, progress))}
        >
          <div className="bar" style={{ width: `${progress}%` }} />
        </div>

        <button className="primary-btn" onClick={() => navigate('/', { replace: true })}>
          Về trang chủ ngay
        </button>
      </div>

      {/* confetti nhẹ nhàng */}
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ ['--d' as any]: `${i * 0.12}s` }} />
        ))}
      </div>
    </div>
  );
}
