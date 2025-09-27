// src/hooks/usePersistRoute.ts
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "auth:return_to";
const SCROLL_KEY  = "auth:return_scroll"; // (tuỳ chọn) tách riêng scroll

// có thể loại trừ vài trang không muốn lưu (vd: /login, /auth)
const SHOULD_TRACK = (pathname: string) => !/^\/(login|auth)/i.test(pathname);

export default function usePersistRoute() {
  const location = useLocation();
  const rafRef = useRef<number | null>(null);

  // Ghi relative path mỗi khi route đổi
  useEffect(() => {
    if (!SHOULD_TRACK(location.pathname)) return;

    const relative = `${location.pathname}${location.search}${location.hash}`;
    localStorage.setItem(STORAGE_KEY, relative); // 👈 chỉ lưu string
  }, [location]);

  // (tuỳ chọn) ghi thêm scroll Y (throttle bằng rAF) vào key riêng
  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        try {
          const savedPath = localStorage.getItem(STORAGE_KEY);
          if (!savedPath) return;
          // chỉ ghi nếu vẫn đang ở cùng trang đã lưu
          const currentPath = `${location.pathname}${location.search}${location.hash}`;
          if (savedPath === currentPath) {
            localStorage.setItem(SCROLL_KEY, String(window.scrollY ?? 0));
          }
        } catch {}
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeunload", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [location]);
}
