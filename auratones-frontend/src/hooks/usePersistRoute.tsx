// src/hooks/usePersistRoute.ts
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "auth:return_to";

// có thể loại trừ vài trang không muốn lưu (vd: /login)
const SHOULD_TRACK = (pathname: string) => !/^\/(login|auth)/i.test(pathname);

export default function usePersistRoute() {
  const location = useLocation();
  const rafRef = useRef<number | null>(null);

  // ghi URL mỗi khi route đổi
  useEffect(() => {
    if (!SHOULD_TRACK(location.pathname)) return;

    const payload = {
      href: window.location.href,
      path: location.pathname,
      search: location.search,
      hash: location.hash,
      // để sau này có muốn ưu tiên “mới nhất”
      ts: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [location]);

  // (tuỳ chọn) ghi thêm scroll Y (throttle bằng rAF)
  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          const saved = JSON.parse(raw);
          if (!saved || typeof saved !== "object") return;
          // chỉ ghi nếu vẫn đang ở cùng trang đã lưu
          if (saved.path === location.pathname) {
            saved.scrollY = window.scrollY ?? 0;
            saved.ts = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
          }
        } catch {}
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", onScroll); // chốt lần cuối
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeunload", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [location]);
}
