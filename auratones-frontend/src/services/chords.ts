// src/services/chords.ts
import type { ChordEntry, Instrument } from "../types/chord";

/** Base URL cho backend:
 * .env của bạn đang để: VITE_API_BASE=http://localhost:3001/api
 * nên API_BASE sẽ = "http://localhost:3001/api"
 */
const API_BASE = (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/+$/, "") || "";

/** Gọi API lấy danh sách hợp âm theo instrument */
export async function fetchChords(
    instrument: Instrument
): Promise<ChordEntry[]> {
    const url = `http://localhost:3001/api/chords?instrument=${encodeURIComponent(instrument)}`;
    console.log("API_BASE =", API_BASE);

    console.log("FETCH =", `${API_BASE}/chords?instrument=${instrument}`);

  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Fetch chords failed: ${res.status}`);
  }

  const data = (await res.json()) as { items?: ChordEntry[] };
  return Array.isArray(data?.items) ? data.items : [];
}

/** Merge lưới mặc định (variants=[]) với dữ liệu backend */
export function mergeChordEntries(
  defaultList: ChordEntry[],
  backendList: ChordEntry[]
): ChordEntry[] {
  const keyOf = (c: ChordEntry) =>
    `${c.instrument}::${c.symbol}`.toLowerCase();

  const beMap = new Map<string, ChordEntry>();
  backendList.forEach((c) => beMap.set(keyOf(c), c));

  const out: ChordEntry[] = [];

  // 1) đi qua default: merge nếu backend có
  for (const d of defaultList) {
    const k = keyOf(d);
    const be = beMap.get(k);
    if (be) {
      out.push({
        ...d,
        aliases: be.aliases ?? d.aliases,
        variants: be.variants ?? [],
      });
      beMap.delete(k);
    } else {
      out.push(d);
    }
  }

  // 2) phần dư từ backend: thêm mới
  for (const rest of beMap.values()) out.push(rest);

  return out;
}
