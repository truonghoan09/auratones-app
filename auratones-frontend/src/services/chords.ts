// src/services/chords.ts
import type { ChordEntry, Instrument, ChordShape } from "../types/chord";

const { VITE_API_BASE, VITE_TOKEN_STORAGE_KEY } = import.meta.env as unknown as {
  VITE_API_BASE?: string;
  VITE_TOKEN_STORAGE_KEY?: string;
};

const API_BASE = (VITE_API_BASE || "").replace(/\/+$/, "");
const TOKEN_KEY = VITE_TOKEN_STORAGE_KEY || "auratones_token";

function getJwt(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

/** GET: danh sách hợp âm theo instrument */
export async function fetchChords(instrument: Instrument): Promise<ChordEntry[]> {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE");
  const url = `${API_BASE}/chords?instrument=${encodeURIComponent(instrument)}`;
  const token = getJwt();
  const res = await fetch(url, {
    method: "GET",
    credentials: "omit",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Fetch chords failed: ${res.status}`);
  }
  const data = (await res.json()) as { items?: ChordEntry[] };
  return Array.isArray(data?.items) ? data.items : [];
}

/** POST: (giữ nguyên) */
export async function postChord(payload: {
  instrument: Instrument;
  symbol: string;
  variants: ChordShape[];
  visibility: "system" | "contribute" | "private";
}): Promise<any> {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE");
  const endpoint = payload.visibility === "system" ? "/postChords" : "/contributeChordOrprivate";
  const url = `${API_BASE}${endpoint}`;
  const token = getJwt();

  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "";
    try { msg = await res.text(); } catch {}
    if (res.status === 401) throw new Error(msg || "Unauthorized: vui lòng đăng nhập lại.");
    if (res.status === 403) throw new Error(msg || "Forbidden: bạn không có quyền thực hiện thao tác này.");
    throw new Error(msg || `Request failed (${res.status}).`);
  }
  return res.json();
}

/** POST: /api/chords/postChord (giữ nguyên) */
export async function postChordVoicing(bundle: any, opts?: { preview?: boolean; confirm?: boolean }): Promise<any> {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE");
  const params = new URLSearchParams();
  if (opts?.preview) params.set("preview", "1");
  if (opts?.confirm) params.set("confirm", "1");

  const url = `${API_BASE}/chords/postChord${params.toString() ? `?${params.toString()}` : ""}`;
  const token = getJwt();

  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(bundle),
  });

  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error(data?.message || "Duplicate voicing");
    err.duplicate = true;
    err.data = data;
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Post voicing failed: ${res.status}`);
  }

  return res.json();
}

/** DELETE: /api/chords/voicing */
export async function deleteChordVoicing(params: {
  instrument: Instrument;
  symbol: string;
  byIndex?: number;
  variant?: any;
  scope?: "single" | "shape+fingers";
  visibility?: "system" | "private";
}): Promise<any> {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE");
  if (typeof params.byIndex !== "number" && !params.variant) {
    throw new Error("Thiếu định danh voicing: cần byIndex hoặc variant.");
  }

  const url = `${API_BASE}/chords/voicing`;
  const token = getJwt();

  const res = await fetch(url, {
    method: "DELETE",
    credentials: "omit",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      instrument: params.instrument,
      symbol: params.symbol,
      variant: params.variant,
      scope: params.scope || "single",
      visibility: params.visibility || "system",
    }),
  });

  if (!res.ok) {
    let msg = "";
    try {
      const j = await res.json();
      msg = j?.message || j?.error || "";
    } catch {
      try { msg = await res.text(); } catch {}
    }
    if (res.status === 401) throw new Error(msg || "Unauthorized: vui lòng đăng nhập lại.");
    if (res.status === 403) throw new Error(msg || "Forbidden: bạn không có quyền thực hiện thao tác này.");
    if (res.status === 404) throw new Error(msg || "Không tìm thấy hợp âm hoặc voicing cần xoá.");
    throw new Error(msg || `Delete voicing failed (${res.status}).`);
  }

  return res.json();
}

/* ================= Like APIs ================= */

/** Toggle like/unlike một voicing */
export async function toggleVoicingLike(params: {
  instrument: Instrument;
  symbol: string;
  variant: any;
}): Promise<{ liked: boolean; likedAt?: number; count: number }> {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE");
  const url = `${API_BASE}/chords/voicing/like`;
  const token = getJwt();
  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let msg = "";
    try { const j = await res.json(); msg = j?.message || j?.error || ""; } catch { try { msg = await res.text(); } catch {} }
    if (res.status === 401) throw new Error(msg || "Unauthorized.");
    throw new Error(msg || `Toggle like failed (${res.status}).`);
  }
  return res.json();
}

/** Lấy trạng thái like (user + tổng) của một chord */
export async function fetchVoicingLikes(params: {
  instrument: Instrument;
  symbol: string;
}): Promise<{ countsByFp: Record<string, number>, userLikesFpToTs: Record<string, number> }> {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE");
  const url = `${API_BASE}/chords/voicing/likes?instrument=${encodeURIComponent(params.instrument)}&symbol=${encodeURIComponent(params.symbol)}`;
  const token = getJwt();
  const res = await fetch(url, {
    method: "GET",
    credentials: "omit",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Fetch likes failed: ${res.status}`);
  }
  return res.json();
}
