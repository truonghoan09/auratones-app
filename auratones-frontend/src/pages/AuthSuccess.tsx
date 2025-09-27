// src/pages/AuthSuccess.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import '../styles/auth-intents.scss';

const RETURN_TO_KEY = 'auth:return_to';
// Nếu bạn có lưu scroll ở hook khác thì có thể dùng thêm:
// const SCROLL_KEY  = 'auth:return_scroll';

function sanitizeReturnTo(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  if (!raw.startsWith('/')) return null;   // chỉ allow relative path nội bộ
  if (raw.startsWith('//')) return null;   // chặn protocol-relative
  return raw;
}

// Đọc return_to từ localStorage, hỗ trợ cả định dạng JSON cũ {path, href, ...}
function getReturnToFromStorage(): string | null {
  const raw = localStorage.getItem(RETURN_TO_KEY) || '';
  if (!raw) return null;

  // backward-compat: nếu là JSON cũ
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw);
      const candidate: string | undefined = obj?.path || obj?.href;
      return sanitizeReturnTo(candidate) || null;
    } catch {
      // ignore
    }
  }

  // kiểu mới: plain string "/abc?x#y"
  return sanitizeReturnTo(raw);
}

export default function AuthSuccess() {
  const { loginWithToken } = useAuthContext();
  const [progress, setProgress] = useState(0);

  const startedRef = useRef(false);
  const aliveRef = useRef(true);
  const targetRef = useRef<string>('/'); // giữ lại để dùng cho nút "đi ngay"

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

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    // Ưu tiên return_to từ query, fallback localStorage
    const fromQuery = sanitizeReturnTo(params.get('return_to'));
    const fromStorage = getReturnToFromStorage();
    const target = fromQuery || fromStorage || '/';
    targetRef.current = target;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      url.searchParams.delete('return_to'); // dọn luôn
      window.history.replaceState({}, document.title, url.pathname + url.search);
    };

    // đã dùng thì xoá localStorage để lần sau lấy mới
    if (fromStorage) localStorage.removeItem(RETURN_TO_KEY);

    if (!token) {
      cleanUrl();
      window.location.replace('/auth/error?reason=missing_token');
      return;
    }

    // chạy progress tới 95% trong lúc hydrate
    let raf = 0;
    const tick = () => {
      if (!aliveRef.current) return;
      setProgress((p) => (p < 95 ? p + 1.8 : 95));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Fallback an toàn: 5s vẫn chưa xong thì cứ về target (không phải "/")
    const fallback = window.setTimeout(() => {
      if (!aliveRef.current) return;
      cleanUrl();
      window.location.replace(targetRef.current);
    }, 5000);

    let redirectTimer: number | undefined;

    (async () => {
      try {
        await loginWithToken(token);

        setProgress(100);
        cleanUrl();

        // chờ 2s cho user thấy 100% rồi về đúng trang cần
        redirectTimer = window.setTimeout(() => {
          window.location.replace(targetRef.current);
        }, 2000);
      } catch (e) {
        cleanUrl();
        window.location.replace('/auth/error?reason=hydrate_failed');
      } finally {
        if (raf) cancelAnimationFrame(raf);
      }
    })();

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
      clearTimeout(fallback);
      if (raf) cancelAnimationFrame(raf);
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
        <p className="subtitle">Đang đưa bạn về trang trước đó…</p>

        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.max(0, Math.min(100, progress))}
        >
          <div className="bar" style={{ width: `${progress}%` }} />
        </div>

        <button
          className="primary-btn"
          onClick={() => window.location.replace(targetRef.current)}
        >
          Đi ngay
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
