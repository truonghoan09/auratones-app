import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import '../styles/auth-intents.scss';

export default function AuthSuccess() {
  const { loginWithToken } = useAuthContext();
  const navigate = useNavigate();

  const [progress, setProgress] = useState(0);

  // chống rerun + setState sau unmount
  const startedRef = useRef(false);
  const aliveRef = useRef(true);

  // giữ bản ổn định cho effect []
  const loginRef = useRef(loginWithToken);
  useEffect(() => { loginRef.current = loginWithToken; }, [loginWithToken]);

  const navRef = useRef(navigate);
  useEffect(() => { navRef.current = navigate; }, [navigate]);

  // tiện: gom tất cả cách quay về home
  const goHome = useRef(() => {
    try { navRef.current('/', { replace: true }); } catch {}
    // 3 lớp fallback cứng
    setTimeout(() => { try { window.location.assign('/'); } catch {} }, 180);
    setTimeout(() => { try { window.location.replace('/'); } catch {} }, 700);
    setTimeout(() => { (window.location as any).href = '/'; }, 1400);
  }).current;

  useEffect(() => () => { aliveRef.current = false; }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    const cleanUrl = () => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, document.title, url.pathname + (url.search || ''));
      } catch {}
    };

    if (!token) {
      cleanUrl();
      goHome(); // hoặc đẩy về /auth/error nếu bạn thích
      return;
    }

    // progress animation ~0→90% khi hydrate
    let startTs: number | null = null;
    let rafId = 0;
    const step = (t: number) => {
      if (!aliveRef.current) return;
      if (startTs == null) startTs = t;
      const elapsed = t - startTs;
      const pct = Math.min(0.9, 1 - Math.pow(1 - Math.min(elapsed / 1000, 1), 3));
      setProgress(Math.floor(pct * 100));
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    (async () => {
      try {
        await loginRef.current(token);       // lưu token + /auth/me
        if (!aliveRef.current) return;

        setProgress(100);
        cleanUrl();

        // cho user kịp thấy 100% rồi rời trang
        setTimeout(() => aliveRef.current && goHome(), 420);
      } catch {
        cleanUrl();
        goHome(); // hoặc window.location.replace('/auth/error?reason=hydrate_failed')
      } finally {
        if (rafId) cancelAnimationFrame(rafId);
      }
    })();

    // watchdog: nếu vì lý do gì vẫn chưa rời trang thì ép rời
    const watchdog = setTimeout(() => goHome(), 3000);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(watchdog);
    };
  }, [goHome]);

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
        <p className="subtitle">Đang chuyển bạn về trang chủ Auratones 🎵</p>

        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.max(0, Math.min(100, progress))}
        >
          <div className="bar" style={{ width: `${progress}%` }} />
        </div>

        <button className="primary-btn" onClick={goHome}>
          Về trang chủ ngay
        </button>
      </div>

      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ ['--d' as any]: `${i * 0.12}s` }} />
        ))}
      </div>
    </div>
  );
}
