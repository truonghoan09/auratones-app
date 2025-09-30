// src/services/chords.ts
import type { ChordEntry, Instrument, ChordShape } from "../types/chord";

/** Vite env (cần file .env ở project root & restart dev server) */
const { VITE_API_BASE, VITE_TOKEN_STORAGE_KEY } = import.meta.env as unknown as {
  VITE_API_BASE?: string;
  VITE_TOKEN_STORAGE_KEY?: string;
};

const API_BASE = (VITE_API_BASE || "").replace(/\/+$/, ""); // ví dụ: http://localhost:3001/api
const TOKEN_KEY = VITE_TOKEN_STORAGE_KEY || "auratones_token";

function getJwt(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** GET: danh sách hợp âm theo instrument */
export async function fetchChords(instrument: Instrument): Promise<ChordEntry[]> {
  if (!API_BASE) {
    // Gợi ý debug nhanh
    console.warn(
      "[chords] VITE_API_BASE chưa có. Hãy kiểm tra .env ở project root (cùng cấp index.html) và restart 'npm run dev'."
    );
    throw new Error("Missing VITE_API_BASE");
  }

  const url = `${API_BASE}/chords?instrument=${encodeURIComponent(instrument)}`;
  // Debug nhẹ
  // console.log("[fetchChords] GET", url);

  const token = getJwt();

  const res = await fetch(url, {
    method: "GET",
    // Dùng JWT → không cần cookie phiên: tránh rắc rối CORS
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Fetch chords failed: ${res.status}`);
  }

  const data = (await res.json()) as { items?: ChordEntry[] };
  return Array.isArray(data?.items) ? data.items : [];
}


/** POST: gửi chord mới (JWT trong Authorization; backend tự xác minh & kiểm tra role) */
export async function postChord(payload: {
  instrument: Instrument;
  symbol: string;
  variants: ChordShape[];
  visibility: "system" | "contribute" | "private";
}): Promise<any> {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE");

  // system -> /chords (admin only). Còn lại -> /chords/preview (ai cũng được)
  const endpoint = payload.visibility === "system" ? "/postChords" : "/contributeChordOrprivate";
  const url = `${API_BASE}${endpoint}`;
  const token = getJwt();

  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "";
    try {
      msg = await res.text();
    } catch {}
    if (res.status === 401) throw new Error(msg || "Unauthorized: vui lòng đăng nhập lại.");
    if (res.status === 403) throw new Error(msg || "Forbidden: bạn không có quyền thực hiện thao tác này.");
    throw new Error(msg || `Request failed (${res.status}).`);
  }

  return res.json();
}
