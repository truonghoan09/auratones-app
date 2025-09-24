// src/lib/installFetchDedupe.ts

// Cài đúng 1 lần (kể cả StrictMode/HMR)
export function installFetchDedupe(ttlMs = 3000) {
  if (typeof window === 'undefined' || (window as any).__me_dedupe_installed) return;
  (window as any).__me_dedupe_installed = true;

  const origFetch = window.fetch.bind(window);

  // 1) Dedupe các request đang "in-flight"
  const inflight = new Map<string, Promise<Response>>();

  // 2) Soft cache response cuối cùng trong ttlMs
  let lastCache:
    | { key: string; ts: number; resp: Response }
    | null = null;

  const log = (type: 'new' | 'dedupe' | 'cache', key: string) => {
    const label = type === 'new' ? '[me:new]' : type === 'dedupe' ? '[me:dedupe]' : '[me:cache]';
    // In ra 1 dòng ngắn + trace để thấy stack gọi
    console.log(`${label} ${key}`);
    console.trace(label); // ⬅️ stack ở đây
  };

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      // Chỉ can thiệp khi là /api/auth/me
      if (url.includes('/api/auth/me')) {
        const method = (init?.method || 'GET').toUpperCase();

        // Lấy header Authorization (nếu có) để tạo key ổn định
        let auth = '';
        const h = init?.headers as HeadersInit | undefined;
        if (h) {
          if (Array.isArray(h)) {
            const f = h.find(([k]) => k.toLowerCase() === 'authorization');
            auth = f ? f[1] : '';
          } else if (h instanceof Headers) {
            auth = h.get('authorization') || '';
          } else {
            const rec = h as Record<string, string>;
            auth = rec['Authorization'] ?? rec['authorization'] ?? '';
          }
        }

        const key = `${method}|${url}|${auth}`;

        // 2) Trả về cache nếu còn trong TTL
        if (lastCache && lastCache.key === key && Date.now() - lastCache.ts < ttlMs) {
          log('cache', key);
          return Promise.resolve(lastCache.resp.clone());
        }

        // 1) Dùng lại promise nếu đang in-flight
        const reused = inflight.get(key);
        if (reused) {
          log('dedupe', key);
          return reused.then(r => r.clone());
        }

        log('new', key);
        const p = origFetch(input as any, init)
          .then((r) => {
            // lưu cache mềm
            try {
              lastCache = { key, ts: Date.now(), resp: r.clone() };
            } catch {}
            return r;
          })
          .finally(() => inflight.delete(key));

        inflight.set(key, p);
        return p.then(r => r.clone());
      }
    } catch {
      // ignore
    }
    return origFetch(input as any, init);
  };
}
