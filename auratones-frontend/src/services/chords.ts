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
  // console.log("[fetchChords] GET", url);

  const token = getJwt();

  const res = await fetch(url, {
    method: "GET",
    credentials: "omit", // Dùng JWT → không cần cookie phiên
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

/** POST: gửi chord mới (JWT trong Authorization; backend tự xác minh & kiểm tra role)
 *  Giữ nguyên logic cũ — không sửa để tránh ảnh hưởng các luồng đang dùng.
 */
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

/** POST: gửi voicing bundle mới (luồng check trùng → confirm)
 *  - Gọi: POST /api/chords/postChord
 *  - Query:
 *      ?preview=1   → chỉ xem trước, không lưu (tùy chọn)
 *      ?confirm=1   → xác nhận lưu dù trùng (sau khi nhận 409)
 *  - Body: bundle JSON (ví dụ bundleForInspect có combinedForSubmitPreview)
 */
export async function postChordVoicing(
  bundle: any,
  opts?: { preview?: boolean; confirm?: boolean }
): Promise<any> {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE");

  const params = new URLSearchParams();
  if (opts?.preview) params.set("preview", "1");
  if (opts?.confirm) params.set("confirm", "1");

  const url = `${API_BASE}/chords/postChord${params.toString() ? `?${params.toString()}` : ""}`;
  const token = getJwt();

  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(bundle),
  });

  // BE sẽ trả 409 khi phát hiện trùng & chưa confirm
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error(data?.message || "Duplicate voicing");
    err.duplicate = true;
    err.data = data; // { duplicate: true, message, matches: [...] }
    throw err;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Post voicing failed: ${res.status}`);
  }

  return res.json();
}

/** DELETE: xoá 1 voicing của hợp âm
 * - Gọi: DELETE /api/chords/voicing
 * - Body JSON:
 *    {
 *      instrument: "guitar"|"ukulele"|"piano",
 *      symbol: string,
 *      byIndex?: number,   // ưu tiên dùng index để xoá
 *      variant?: any       // nếu không có index, gửi variant để BE so fingerprint "relaxed"
 *    }
 * - Backend đang kiểm tra quyền: chỉ admin được xoá thời điểm hiện tại.
 */
export async function deleteChordVoicing(params: {
  instrument: Instrument;
  symbol: string;
  byIndex?: number;
  variant?: any;
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
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    let msg = "";
    try {
      const j = await res.json();
      msg = j?.message || j?.error || "";
    } catch {
      try {
        msg = await res.text();
      } catch {}
    }
    if (res.status === 401) throw new Error(msg || "Unauthorized: vui lòng đăng nhập lại.");
    if (res.status === 403) throw new Error(msg || "Forbidden: chỉ admin được xoá voicing lúc này.");
    if (res.status === 404) throw new Error(msg || "Không tìm thấy hợp âm hoặc voicing cần xoá.");
    throw new Error(msg || `Delete voicing failed (${res.status}).`);
  }

  return res.json();
}
