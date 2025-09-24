// src/data/chords/piano.ts
import type { ChordEntry } from "../../types/chord";

export const PIANO_CHORDS: ChordEntry[] = [
  { instrument: "piano", symbol: "C", aliases: [], variants: [{ baseFret: 1, frets: [0], rootString: 1 }] },
  { instrument: "piano", symbol: "Am", aliases: [], variants: [{ baseFret: 1, frets: [0], rootString: 1 }] },
  { instrument: "piano", symbol: "F", aliases: [], variants: [{ baseFret: 1, frets: [0], rootString: 1 }] },
  { instrument: "piano", symbol: "G7", aliases: [], variants: [{ baseFret: 1, frets: [0], rootString: 1 }] },
  { instrument: "piano", symbol: "Cmaj7", aliases: ["CΔ"], variants: [{ baseFret: 1, frets: [0], rootString: 1 }] }
];
