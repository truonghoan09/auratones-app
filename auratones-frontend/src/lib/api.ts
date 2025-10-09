// src/lib/api.ts
const API_BASE =
  (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3001/api';
const TOKEN_KEY =
  (import.meta.env.VITE_TOKEN_STORAGE_KEY as string) || 'auratones_token';

function buildHeaders(extra?: HeadersInit): HeadersInit {
  // luôn là Record<string, string> để TS không phàn nàn
  const base: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) base.Authorization = `Bearer ${token}`;

  if (!extra) return base;

  // Hợp nhất với extra nếu caller truyền thêm header
  if (extra instanceof Headers) {
    return new Headers({ ...base, ...Object.fromEntries(extra.entries()) });
  }
  if (Array.isArray(extra)) {
    return new Headers({ ...base, ...Object.fromEntries(extra) });
  }
  return { ...base, ...(extra as Record<string, string>) };
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method || 'GET',
    headers: buildHeaders(init.headers),
    body: init.body,
    credentials: 'omit', // dùng JWT nên không cần cookie
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}${text ? ` ${text}` : ''}`);
  }
  // có thể là 204 No Content
  return (text ? JSON.parse(text) : undefined) as T;
}

// ====== Helpers theo method ======
export const apiGet = <T = any>(path: string) =>
  apiFetch<T>(path, { method: 'GET' });

export const apiPost = <T = any, B = unknown>(path: string, body?: B) =>
  apiFetch<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiPut = <T = any, B = unknown>(path: string, body?: B) =>
  apiFetch<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiPatch = <T = any, B = unknown>(path: string, body?: B) =>
  apiFetch<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiDelete = <T = any>(path: string) =>
  apiFetch<T>(path, { method: 'DELETE' });
