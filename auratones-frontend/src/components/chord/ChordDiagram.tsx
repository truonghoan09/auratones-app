// src/components/chord/ChordDiagram.tsx
import React from "react";
import type { ChordShape, Barre } from "../../types/chord";
import "../../styles/ChordDiagram.scss";

type Props = {
  shape: ChordShape;
  size?: number;                    // width
  numStrings?: number;              // 6 guitar, 4 ukulele
  showName?: boolean;
  // bias lệch chấm về phía thùng đàn cho ngăn < 7 (0..0.5)
  pressBias?: number;               // mặc định 0.28
};

const DEFAULTS = {
  baseFret: 1,
  numFretsMin: 4
};

/**
 * VẼ CHÍNH:
 * - 1 ở TRÊN, N ở DƯỚI
 * - Dây dày: 6→1 (hoặc 4→1 với ukulele)
 * - Chấm ngón lệch về phía thùng đàn cho ngăn < 7 (pressBias)
 * - Ngăn <7 co dần, ≥7 đều nhau
 * - Dây dài hơn grid: nếu baseFret=1 => flush ở nut; nếu >1 => lố cả hai đầu
 * - Open: khoanh TRÚNG SỐ DÂY; Mute: dấu × thẳng hàng
 * - Root: chữ 'R' đặt dưới-trái của nốt gốc; nếu root open thì 'R' nằm cột trái ở hàng dây đó
 * - Số dây ở TRÁI; số NGĂN ở TRÊN (theo mẫu)
 */
export default function ChordDiagram({
  shape,
  size = 280,
  numStrings = shape.frets.length, // auto theo dữ liệu
  showName = !!shape.name,
  pressBias = 0.28
}: Props) {

  const baseFret = shape.baseFret ?? DEFAULTS.baseFret;
  const N = numStrings; // 6 guitar, 4 ukulele

  const width = size;
  const height = size * 1.38;               // tỉ lệ theo thiết kế bạn đưa
  const innerTop = height * 0.14;           // vùng chứa 6/4 dây
  const innerBottom = height * 0.88;

  // Lề để chứa số dây, O/X, 'R' khi root open
  const COL_PAD = Math.max(60, width * 0.20);
  const LEFT = COL_PAD;
  const RIGHT = 24;

  // 5) Độ rộng các ngăn: <7 co (0.88), ≥7 đều
  const fretsAbsNeeded = Math.max(
    DEFAULTS.numFretsMin,
    ...shape.frets.map((f) => (f > 0 ? f : 0))
  );
  const numFrets = Math.max(DEFAULTS.numFretsMin, fretsAbsNeeded);

  const fretWeights: number[] = [];
  let w = 1, total = 0;
  for (let i = 0; i < numFrets; i++) {
    const abs = baseFret + i;
    const wi = abs >= 7 ? 1 : w;
    fretWeights.push(wi);
    total += wi;
    if (abs < 7) w *= 0.88;
  }

  // Tính trục dọc các phím
  const fretXs: number[] = [LEFT];
  const gridWidth = width - LEFT - RIGHT;
  for (const wi of fretWeights) {
    fretXs.push(fretXs[fretXs.length - 1] + gridWidth * (wi / total));
  }

  // Nut
  const hasNut = baseFret === 1;

  // Dây: 1 trên → N dưới
  const stringYs = new Array(N).fill(0).map((_, i) =>
    innerTop + ((innerBottom - innerTop) * i) / (N - 1)
  );

  // 2) Độ dày dây (N ở dưới dày nhất → index N-1)
  const thickLow = 2.6;
  const thickHigh = 1.2;
  const stringThickness = stringYs.map((_, i) => {
    const t = thickHigh + (thickLow - thickHigh) * (i / (N - 1));
    return +t.toFixed(2);
  });

  // 6) Dây dài hơn grid
  const OVERHANG = Math.max(20, width * 0.07);
  const stringX1 = hasNut ? fretXs[0] : Math.max(fretXs[0] - OVERHANG, 8);
  const stringX2 = Math.min(fretXs[fretXs.length - 1] + OVERHANG, width - 8);

  const fretCenterX = (fret: number) => {
    const i = fret - baseFret;
    if (i < 0 || i >= fretXs.length - 1) return null;
    const x1 = fretXs[i];
    const x2 = fretXs[i + 1];
    const w = x2 - x1;

    // 4.3) lệch về phía thùng đàn cho ngăn <7
    if (baseFret + i < 7) {
      const bias = Math.max(0, Math.min(0.5, pressBias));
      // giữ 1 khoảng mép để chấm không dính sát phím
      const margin = Math.min(14, w * 0.18);
      const cx = x1 + w * 0.5 + (w * 0.5 - margin) * bias;
      return cx;
    }
    return (x1 + x2) / 2;
  };

  // Kích thước chấm theo cell
  const cellH = (innerBottom - innerTop) / (N - 1);
  const dotR = Math.min(13, cellH * 0.36);

  // Cột trái (thẳng hàng)
  const COL_STR_NUM = LEFT - 18;   // số dây
  const COL_OX      = LEFT - 36;   // O / ×
  const COL_R_OPEN  = LEFT - 54;   // 'R' khi root open

  const yOf = (stringIdx1Based: number) => {
    const i = Math.min(N, Math.max(1, stringIdx1Based)) - 1;
    return stringYs[i];
  };

  // helper root
  const isRootOpen = () =>
    !!shape.rootString && shape.frets[shape.rootString - 1] === 0;

  return (
    <svg className="chord-diagram" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {/* DÂY */}
      {stringYs.map((y, i) => (
        <line
          key={`string-${i}`}
          x1={stringX1}
          x2={stringX2}
          y1={y}
          y2={y}
          strokeWidth={stringThickness[i]}
          className="string-line"
        />
      ))}

      {/* PHÍM */}
      {fretXs.map((x, i) => (
        <line key={`fret-${i}`} x1={x} x2={x} y1={innerTop - 16} y2={innerBottom + 16} className="fret-line" />
      ))}

      {/* NUT */}
      {hasNut && (
        <rect
          x={fretXs[0] - 2}
          y={innerTop - 16}
          width={4}
          height={innerBottom - innerTop + 32}
          className="nut"
        />
      )}

      {/* SỐ DÂY + O/X + R(open) ở cột trái */}
      {shape.frets.map((f, i) => {
        const y = stringYs[i];
        const stringNo = i + 1;

        return (
          <g key={`leftcol-${i}`}>
            {/* số dây */}
            <text x={COL_STR_NUM} y={y + 5} className="string-index">
              {stringNo}
            </text>

            {/* 4.7) open: khoanh VÀO SỐ DÂY */}
            {f === 0 && <circle cx={COL_STR_NUM - 2} cy={y} r={10} className="open-marker" />}

            {/* 4.9) mute: × */}
            {f === -1 && (
              <text x={COL_OX} y={y + 5} className="mute-marker">×</text>
            )}

            {/* 4.8) R cho root open -> đặt ở cột trái, dưới-left hàng dây root */}
            {isRootOpen() && shape.rootString === stringNo && (
              <text x={COL_R_OPEN} y={y + 5} className="root-left">R</text>
            )}
          </g>
        );
      })}

      {/* DOTS và FINGERS */}
      {shape.frets.map((fret, i) => {
        if (fret <= 0) return null;
        const cx = fretCenterX(fret);
        if (cx == null) return null;
        const cy = stringYs[i];

        const isRootHere = shape.rootString === i + 1;

        return (
          <g key={`dot-${i}`}>
            <circle cx={cx} cy={cy} r={dotR} className="dot" />
            {!!shape.fingers?.[i] && (
              <text x={cx} y={cy + 4} className="dot-label">
                {shape.fingers[i]}
              </text>
            )}
            {/* 4.8) R: dưới-trái của DOT (không phải ở cột trái) */}
            {isRootHere && (
              <text
                x={cx - dotR - 8}
                y={cy + dotR + 14}
                className="root-inline"
              >
                R
              </text>
            )}
          </g>
        );
      })}

      {/* BARRE */}
      {shape.barres?.map((b, i) => {
        const s1 = Math.min(b.from, b.to);
        const s2 = Math.max(b.from, b.to);
        const y1 = yOf(s1);
        const y2 = yOf(s2);
        const cx = fretCenterX(b.fret);
        if (cx == null) return null;
        const wBarre = Math.min(28, cellH * 0.9);
        return (
          <rect
            key={`barre-${i}`}
            x={cx - wBarre / 2}
            y={y1}
            width={wBarre}
            height={y2 - y1}
            rx={wBarre / 2}
            className="barre"
          />
        );
      })}

      {/* SỐ NGĂN 4.6: ở TRÊN, giữa mỗi ô ngăn */}
      {fretXs.slice(0, numFrets).map((x1, i) => {
        const x2 = fretXs[i + 1];
        return (
          <text key={`fnum-${i}`} x={(x1 + x2) / 2} y={innerTop - 26} className="fret-number">
            {baseFret + i}
          </text>
        );
      })}

      {/* Tên hợp âm (nếu cần) */}
      {showName && shape.name && (
        <text x={width / 2} y={height - 6} className="chord-name">
          {shape.name}
        </text>
      )}
    </svg>
  );
}
