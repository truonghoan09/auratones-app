// src/pages/AuthSuccess.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import '../styles/auth-intents.scss';

export default function AuthSuccess() {
  const { loginWithToken } = useAuthContext();
  const [progress, setProgress] = useState(0);

  const startedRef = useRef(false);
  const aliveRef = useRef(true);

  // confetti random: vị trí, delay, duration, xoay, scale
  const confetti = useMemo(
    () =>
      Array.from({ length: 18 }).map(() => ({
        left: 5 + Math.random() * 90,       // 5% → 95%
        delay: Math.random() * 0.9,         // 0s → 0.9s
        dur: 1.5 + Math.random() * 1.6,     // 1.5s → 3.1s
        rot: Math.floor(Math.random() * 360),
        scale: 0.8 + Math.random() * 0.6,   // 0.8 → 1.4
      })),
    []
  );

  useEffect(() => {
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    console.log('[auth-success] init', window.location.href);

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    };

    if (!token) {
      console.warn('[auth-success] missing token');
      cleanUrl();
      window.location.replace('/auth/error?reason=missing_token');
      return;
    }

    console.log('[auth-success] got token → start progress');
    // chạy progress tới 95% trong lúc hydrate
    let raf = 0;
    const tick = () => {
      if (!aliveRef.current) return;
      setProgress((p) => (p < 95 ? p + 1.8 : 95));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Fallback an toàn: 5s vẫn chưa xong thì cứ về home (đã có overlay loading ở Home)
    const fallback = window.setTimeout(() => {
      if (!aliveRef.current) return;
      console.warn('[auth-success] fallback redirect after 5s');
      cleanUrl();
      window.location.replace('/');
    }, 5000);

    let redirectTimer: number | undefined;

    (async () => {
      try {
        console.log('[auth-success] loginWithToken → begin');
        await loginWithToken(token);
        console.log('[auth-success] loginWithToken → done (token saved & /me hydrated)');

        // if (!aliveRef.current) return;
        setProgress(100);
        cleanUrl();

        redirectTimer = window.setTimeout(() => {
          console.log('[auth-success] redirect → /');
          window.location.replace('/');
        }, 2000); // để người dùng kịp thấy 100%
      } catch (e) {
        console.log('[auth-success] loginWithToken failed', e);
        cleanUrl();
        window.location.replace('/auth/error?reason=hydrate_failed');
      } finally {
        if (raf) cancelAnimationFrame(raf);
      }
    })();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (redirectTimer) clearTimeout(redirectTimer);
      clearTimeout(fallback);
      console.log('[auth-success] cleanup');
    };
  }, [loginWithToken]);

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
        <p className="subtitle">Đang chuẩn bị đưa bạn về trang chủ Auratones 🎵</p>

        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.max(0, Math.min(100, progress))}
        >
          <div className="bar" style={{ width: `${progress}%` }} />
        </div>

        <button className="primary-btn" onClick={() => window.location.replace('/')}>
          Về trang chủ ngay
        </button>
      </div>

      {/* confetti random (không dồn cục) */}
      <div className="confetti" aria-hidden="true">
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              left: `${c.left}%`,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
              transform: `rotate(${c.rot}deg) scale(${c.scale})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
