// src/data/chords/guitar.ts
import type { ChordEntry } from "../../types/chord";

export const GUITAR_CHORDS: ChordEntry[] = [
  {
    instrument: "guitar",
    symbol: "A",
    aliases: [],
    variants: [
      {
        baseFret: 1,
        frets: [0, 2, 2, 2, 0, -1],    // [1..6]
        fingers: [0, 2, 3, 4, 0, 0],
        rootString: 5
      },
      {
        baseFret: 5,
        frets: [0, 2, 2, 2, 0, 0],     // dạng E-shape barre A (tại ngăn 5)
        fingers: [0, 3, 4, 5, 0, 0] as any,
        barres: [{ fret: 5, from: 1, to: 6, finger: 1 }],
        rootString: 6
      }
    ]
  },
  {
    instrument: "guitar",
    symbol: "Am",
    aliases: [],
    variants: [
      {
        baseFret: 1,
        frets: [0, 1, 2, 2, 0, -1],
        fingers: [0, 1, 3, 4, 0, 0],
        rootString: 5
      },
      {
        baseFret: 5,
        frets: [0, 1, 2, 2, 0, 0],
        barres: [{ fret: 5, from: 1, to: 6, finger: 1 }],
        fingers: [0, 0, 0, 0, 0, 0],
        rootString: 6
      }
    ]
  },
  {
    instrument: "guitar",
    symbol: "C",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [0, 1, 0, 2, 3, -1], fingers: [0,1,0,2,4,0], rootString: 5 },
      { baseFret: 3, frets: [0, 1, 0, 2, 3, 3], fingers: [0,1,0,2,3,4], rootString: 6 }
    ]
  },
  {
    instrument: "guitar",
    symbol: "Cmaj7",
    aliases: ["CΔ"],
    variants: [
      { baseFret: 1, frets: [0, 0, 0, 2, 3, -1], fingers: [0,0,0,2,3,0], rootString: 5 },
      { baseFret: 3, frets: [0, 0, 2, 2, 3, -1], fingers: [0,0,2,3,4,0], rootString: 5 }
    ]
  },
  {
    instrument: "guitar",
    symbol: "G",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [3, 0, 0, 0, 2, 3], fingers: [3,0,0,0,2,4], rootString: 6 },
      { baseFret: 3, frets: [1, 1, 1, 3, 3, 1], barres: [{ fret: 3, from: 1, to: 6, finger: 1 }], rootString: 6 }
    ]
  },
  {
    instrument: "guitar",
    symbol: "D",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [2, 3, 2, 0, -1, -1], fingers: [1,3,2,0,0,0], rootString: 4 },
      { baseFret: 5, frets: [2, 3, 2, 0, -1, -1], rootString: 4 }
    ]
  },
  {
    instrument: "guitar",
    symbol: "E",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [0, 0, 1, 2, 2, 0], fingers: [0,0,1,3,4,0], rootString: 6 },
      { baseFret: 7, frets: [0, 0, 1, 2, 2, 0], rootString: 6 }
    ]
  },
  {
    instrument: "guitar",
    symbol: "F",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [1, 1, 2, 3, 3, 1], barres: [{ fret: 1, from: 1, to: 6, finger: 1 }], rootString: 6 },
      { baseFret: 8, frets: [1, 1, 2, 3, 3, 1], barres: [{ fret: 8, from: 1, to: 6, finger: 1 }], rootString: 6 }
    ]
  },
  {
    instrument: "guitar",
    symbol: "Em",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [0, 0, 0, 2, 2, 0], fingers: [0,0,0,2,3,0], rootString: 6 },
      { baseFret: 7, frets: [0, 0, 0, 2, 2, 0], rootString: 6 }
    ]
  },
  {
    instrument: "guitar",
    symbol: "Am7",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [0, 1, 0, 2, 0, -1], fingers: [0,1,0,3,0,0], rootString: 5 },
      { baseFret: 5, frets: [0, 1, 0, 2, 0, 0], barres: [{ fret: 5, from: 1, to: 6, finger: 1 }], rootString: 6 }
    ]
  },
  {
    instrument: "guitar",
    symbol: "G7",
    aliases: [],
    variants: [
      { baseFret: 1, frets: [1, 0, 0, 0, 2, 3], fingers: [1,0,0,0,2,3], rootString: 6 },
      { baseFret: 3, frets: [1, 1, 1, 1, 3, 1], barres: [{ fret: 3, from: 1, to: 6, finger: 1 }], rootString: 6 }
    ]
  }
];
