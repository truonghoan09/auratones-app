import type { ChordEntry } from "../types/chord";

export type ChordApiResponse = {
  instrument: "guitar" | "ukulele" | "piano";
  items: ChordEntry[]; // đã chuẩn hoá đúng với UI (variants, barres, v.v.)
};