// src/types/chord.ts
export type Instrument = "guitar" | "ukulele" | "piano";

// Đã có chord-canonical trong dự án của bạn
import type { PitchClass } from "../types/chord-canonical";

// Thanh chặn
export type Barre = {
  fret: number;
  from: number;
  to: number;
  finger?: 1 | 2 | 3 | 4;
};

export type ChordShape = {
  baseFret: number;
  frets: number[];
  fingers?: (0 | 1 | 2 | 3 | 4)[];
  barres?: Barre[];

  // Grid & Root
  gridFrets?: number;
  rootString?: number;
  rootFret?: number;

  // Slash / đảo bass (tuỳ chọn)
  bassPc?: PitchClass;
  bassLabel?: string;
  bassString?: number;

  name?: string;
};

export type ChordVariant = ChordShape & { id?: string };

export type ChordEntry = {
  symbol: string;
  aliases?: string[];
  instrument: Instrument;
  variants: ChordVariant[];

  /** (Optional) Tổng lượt yêu thích theo fingerprint (relaxed) của voicing */
  likesCountByFp?: Record<string, number>;

  /** (Optional) Like của CHÍNH user hiện tại: fpRelaxed -> timestamp (ms) */
  userLikesFpToTs?: Record<string, number>;
};

export type ChordDictionary = {
  guitar: ChordEntry[];
  ukulele: ChordEntry[];
  piano: ChordEntry[]; // tạm cho piano
};
