// src/components/chord/PianoDiagram.tsx
import React from "react";
import "../../styles/PianoDiagram.scss";

// Very lightweight ref: 2 quãng tám, highlight nốt bằng cách tô đậm phím
type Props = {
  width?: number;
  height?: number;
  // danh sách các phím trắng/đen cần tô (0..23), 0 = C, 1 = C#, 2 = D ...
  notes: number[];
  label?: string; // tên hợp âm
};

export default function PianoDiagram({ width = 320, height = 120, notes, label }: Props) {
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; // pattern trong 1 octave
  const blackIndex = new Set([1, 3, 6, 8, 10]);

  const keysCount = 14; // 2 octave trắng = 14 phím trắng
  const whiteW = width / keysCount;
  const whiteH = height;

  const toAbs = (n: number) => ((n % 12) + 12) % 12;

  const allWhite = new Array(keysCount).fill(0).map((_, i) => {
    // map sang 12 nốt
    // start từ C
    const octave = Math.floor(i / 7);
    const n = whiteKeys[i % 7] + 12 * octave;
    return n;
    });

  const allBlack: { x: number, note: number }[] = [];
  for (let i = 0; i < keysCount; i++) {
    const base = allWhite[i] % 12;
    const x = i * whiteW;
    // black sau từng white (trừ sau E, B)
    if (![4, 11].includes(base)) {
      const n = base + 1;
      allBlack.push({ x: x + whiteW * 0.7, note: n + 12 * Math.floor(allWhite[i] / 12) });
    }
  }

  const shouldHighlight = (n: number) => notes.some(v => toAbs(v) === toAbs(n));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="piano-diagram">
      {/* White keys */}
      {allWhite.map((n, i) => (
        <rect key={`w-${i}`} x={i * whiteW} y={0} width={whiteW} height={whiteH}
              className={shouldHighlight(n) ? "white-key active" : "white-key"} />
      ))}

      {/* Black keys */}
      {allBlack.map((b, i) => (
        <rect key={`b-${i}`} x={b.x} y={0} width={whiteW * 0.6} height={whiteH * 0.62}
              className={shouldHighlight(b.note) ? "black-key active" : "black-key"} />
      ))}

      {label && <text x={width / 2} y={height - 4} className="piano-label">{label}</text>}
    </svg>
  );
}
