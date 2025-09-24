// src/types/chord.ts

export type Barre = {
  fret: number;       // ngăn, tính theo baseFret
  from: number;       // index dây bắt đầu (0 = dây nhỏ nhất)
  to: number;         // index dây kết thúc
  finger?: number;    // (tuỳ chọn) số ngón tay
};

export type ChordShape = {
  id: string;
  name: string;
  instrument: "guitar" | "ukulele";
  tuning: string[];
  strings: number;
  baseFret: number;
  frets: number[]; // -1 = mute, 0 = open
  fingers?: (number | null)[];
  barres?: Barre[];
  capo?: number | null;
  comment?: string;
  rootString?: number; // nếu dùng (không bắt buộc)
};
