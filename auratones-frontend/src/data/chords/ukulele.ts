// src/data/chords/ukulele.ts
import type { ChordEntry } from "../../types/chord";

export const UKULELE_CHORDS: ChordEntry[] = [
  {
    instrument: "ukulele",
    symbol: "C",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [0, 0, 0, 3], fingers: [0,0,0,3], rootString: 1 }
    ]
  },
  {
    instrument: "ukulele",
    symbol: "Am",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [0, 0, 0, 2], fingers: [0,0,0,2], rootString: 4 }
    ]
  },
  {
    instrument: "ukulele",
    symbol: "F",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [1, 0, 0, 2], fingers: [1,0,0,2], rootString: 4 }
    ]
  },
  {
    instrument: "ukulele",
    symbol: "G",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [2, 3, 2, 0], fingers: [1,3,2,0], rootString: 3 }
    ]
  },
  {
    instrument: "ukulele",
    symbol: "Dm",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [1, 2, 2, 0], fingers: [1,2,3,0], rootString: 4 }
    ]
  },
  {
    instrument: "ukulele",
    symbol: "Cmaj7",
    aliases: ["CΔ"],
    variants: [
      { baseFret: 1, frets: [0, 0, 0, 2], fingers: [0,0,0,2], rootString: 1 }
    ]
  }
];
