// src/lib/chords/demoShapes.ts

import type { ChordShape } from "../../types/chord";

export const demoGuitarShapes: ChordShape[] = [
  {
    id: "C_open",
    name: "C",
    instrument: "guitar",
    tuning: ["E", "A", "D", "G", "B", "E"],
    strings: 6,
    baseFret: 1,
    frets: [-1, 3, 2, 0, 1, 0],
    fingers: [null, 3, 2, null, 1, null],
  },
  {
    id: "G_open",
    name: "G",
    instrument: "guitar",
    tuning: ["E", "A", "D", "G", "B", "E"],
    strings: 6,
    baseFret: 1,
    frets: [3, 2, 0, 0, 0, 3],
    fingers: [3, 2, null, null, null, 4],
  },
  {
    id: "D_open",
    name: "D",
    instrument: "guitar",
    tuning: ["E", "A", "D", "G", "B", "E"],
    strings: 6,
    baseFret: 1,
    frets: [-1, -1, 0, 2, 3, 2],
    fingers: [null, null, null, 1, 3, 2],
  },
  {
    id: "Amaj7_5fr",
    name: "Amaj7",
    instrument: "guitar",
    tuning: ["E", "A", "D", "G", "B", "E"],
    strings: 6,
    baseFret: 5,
    frets: [-1, 0, 2, 1, 2, 0],
    fingers: [null, null, 3, 2, 4, null],
    comment: "Voicing vùng 5fr",
  },
  {
    id: "F_barre_1",
    name: "F",
    instrument: "guitar",
    tuning: ["E", "A", "D", "G", "B", "E"],
    strings: 6,
    baseFret: 1,
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barres: [
      {
        fret: 1,
        from: 0,   // Dây số 1 (high E)
        to: 5,     // Dây số 6 (low E)
        finger: 1  // Ngón trỏ
      }
    ],
  },
];
