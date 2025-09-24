// src/types/chord.ts
export type Instrument = "guitar" | "ukulele" | "piano";

// Thanh chặn
export type Barre = {
  fret: number;       // số ngăn tuyệt đối (tính từ baseFret)
  from: number;       // dây bắt đầu (1 = dây trên cùng)
  to: number;         // dây kết thúc (tăng dần)
  finger?: 1 | 2 | 3 | 4;
};

export type ChordShape = {
  baseFret: number;         // ngăn bắt đầu hiển thị (1 = có nut)
  frets: number[];          // theo thứ tự [1..N] (1 ở TRÊN, N ở DƯỚI). -1 mute, 0 open
  fingers?: (0 | 1 | 2 | 3 | 4)[];
  barres?: Barre[];
  // string chứa ROOT (1..N). Với root open (0), frets[rootString-1] sẽ = 0
  rootString?: number;
  name?: string;            // tên riêng của shape (optional)
};

export type ChordVariant = ChordShape & { id?: string };

export type ChordEntry = {
  symbol: string;           // ví dụ "C", "Am", "Cmaj7"
  aliases?: string[];       // ví dụ "CΔ", "Cmaj7"
  instrument: Instrument;
  variants: ChordVariant[];
};

export type ChordDictionary = {
  guitar: ChordEntry[];
  ukulele: ChordEntry[];
  piano: ChordEntry[];      // tạm lưu notes cho piano
};
