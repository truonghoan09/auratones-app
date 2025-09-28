// src/types/chord.ts
export type Instrument = "guitar" | "ukulele" | "piano";

// NOTE: dùng lại PitchClass nếu bạn đã có file chord-canonical.
// Import là tùy chọn; nếu bạn chưa tạo file đó, có thể đổi PitchClass = number (0..11).
import type { PitchClass } from "../types/chord-canonical";

// Thanh chặn
export type Barre = {
  fret: number;       // số ngăn tuyệt đối (tính từ baseFret)
  from: number;       // dây bắt đầu (1 = dây trên cùng)
  to: number;         // dây kết thúc (tăng dần)
  finger?: 1 | 2 | 3 | 4;
};

export type ChordShape = {
  baseFret: number;         // ngăn bắt đầu hiển thị (1 = có nut)
  frets: number[];          // theo thứ tự [1..N] (1 ở TRÊN, N ở DƯỚI). -1 mute, 0 open, >=1 là số ngăn
  fingers?: (0 | 1 | 2 | 3 | 4)[];
  barres?: Barre[];

  // Grid & Root
  gridFrets?: number;       // số ngăn hiển thị (4..5), optional
  rootString?: number;      // 1..N
  rootFret?: number;        // nếu muốn đánh dấu rõ

  // ---- Slash / đảo bass (tùy chọn, KHÔNG bắt buộc) ----
  // Nếu có một trong các trường này, FE có thể render A/C#, C/E...
  bassPc?: PitchClass;      // 0..11 nếu backend trả PC
  bassLabel?: string;       // ví dụ "C#", "G", "B" (ưu tiên dùng nếu có)
  bassString?: number;      // 1..N: dây đang giữ nốt trầm nhất (phục vụ kiểm tra hợp lệ voicing)

  name?: string;            // tên riêng của shape (optional)
};

export type ChordVariant = ChordShape & { id?: string };

export type ChordEntry = {
  symbol: string;           // ví dụ "C", "Am", "Cmaj7"
  aliases?: string[];       // ví dụ "Cmaj7b5", "Cm(add9)" (không dùng ký hiệu tam giác)
  instrument: Instrument;
  variants: ChordVariant[];
};

export type ChordDictionary = {
  guitar: ChordEntry[];
  ukulele: ChordEntry[];
  piano: ChordEntry[];      // tạm lưu notes cho piano
};
