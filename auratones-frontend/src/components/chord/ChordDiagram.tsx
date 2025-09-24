// src/components/chords/ChordDiagram.tsx

import React from "react";
import type { ChordShape, Barre } from "../../types/chord";


type Props = {
    shape: ChordShape;
    width?: number;                 // px
    height?: number;                // auto tính theo tỉ lệ nếu không truyền
    stringLabels?: boolean;         // có in số dây bên trái không
    showFretNumbers?: boolean;      // có in số ngăn trên đầu không
    fretCompress?: number;          // 0.8–0.95 (nhỏ hơn => ngăn về sau ngắn hơn)
    size: number;
    theme?: {
        line?: string;
        ink?: string;
        dot?: string;
        dotText?: string;
        muteOpen?: string;
        nut?: string;
    };
};

const DEFAULTS = {
    baseFret: 1,
    numFrets: 4,
    width: 420,
    fretCompress: 0.88,
};

const STR_THICKNESS = [ // dây 1..6 trên xuống, nhưng ta render 6 dưới -> đảo khi dùng
    1.2, 1.25, 1.35, 1.45, 1.7, 2.1
];

export default function ChordDiagram({
    shape,
    width = DEFAULTS.width,
    height,
    size,
    stringLabels = false,
  showFretNumbers = true,
  fretCompress = DEFAULTS.fretCompress,
  theme,
}: Props) {
  width = size ?? width;
  const positions = shape.frets;
  const baseFret = shape.baseFret ?? DEFAULTS.baseFret;
  const relativeFrets = shape.frets
  .filter(f => f > 0)
  .map(f => f); // các phím tương đối

  const maxFret = Math.max(...relativeFrets, 0); // phòng ngừa empty array
  const numFrets = Math.max(3, maxFret); // ít nhất vẽ 3 ngăn cho đẹp
  
  // Khu vực vẽ (padding for labels)
  const padL = stringLabels ? 36 : 24;
  const padR = 16;
  const padT = showFretNumbers ? 34 : 18;
  const padB = 44; // chỗ cho tên hợp âm

  const innerW = width - padL - padR;
  const strings = 6;
  const stringGap = innerW / (strings - 1);

  // Tính chiều rộng từng “khoang” phím: ngăn 1 dài nhất, sau ngắn dần
  const fretWidths: number[] = [];
  let total = 0;
  let w = 1;
  for (let i = 0; i < numFrets; i++) {
    fretWidths.push(w);
    total += w;
    w *= fretCompress;
  }
  // scale để vừa khung
  const gridH = 220; // chiều cao lưới (auto nếu height không truyền)
  const unitH = gridH / total;
  const fretHeights = fretWidths.map((f) => f * unitH);

  const h = height ?? padT + gridH + padB;

  // y của từng đường phím (ngang)
  const fretYs: number[] = [];
  let acc = padT;
  for (let i = 0; i <= numFrets; i++) {
    fretYs.push(acc);
    if (i < numFrets) acc += fretHeights[i];
  }

  const xOfString = (s: number) => padL + (s - 1) * stringGap; // s: 1..6 từ trái sang phải
  // nhưng ta vẽ dây 6 ở DƯỚI -> y vị trí node: dùng giữa 2 fret line
  const yOfFretCenter = (fret: number) => {
    // fret thực tế (theo thang) -> cột trong khung:
    // nếu baseFret=1:  1..numFrets
    // nếu baseFret=3:  3..(3+numFrets-1)
    const col = fret - baseFret; // 0-based vào mảng fretHeights
    if (col < 0 || col >= numFrets) return null;
    const yTop = fretYs[col];
    const yBot = fretYs[col + 1];
    return (yTop + yBot) / 2;
  };

  // style
  const line = theme?.line ?? "rgba(0,0,0,.45)";
  const ink = theme?.ink ?? "var(--text-color)";
  const dot = theme?.dot ?? "var(--text-color)";
  const dotText = theme?.dotText ?? "#fff";
  const muteOpen = theme?.muteOpen ?? "var(--text-color)";
  const nutColor = theme?.nut ?? "var(--text-color)";

  // helpers vẽ open/mute
  const renderOpenMute = (sIdxFrom6: number, val: number) => {
    const s = 6 - sIdxFrom6; // convert 0-based from bottom -> 1-based left-right
    const x = xOfString(s);
    const y = padT - 10;

    if (val === -1) {
      return (
        <text key={`x-${s}`} x={x} y={y} textAnchor="middle" fontSize="14" fill={muteOpen} fontWeight={700}>
          ×
        </text>
      );
    }
    if (val === 0 && baseFret === 1) {
      // chỉ hiển thị ◯ khi baseFret=1 (ở các vị trí dịch capo thường không cần)
      return (
        <text key={`o-${s}`} x={x} y={y} textAnchor="middle" fontSize="14" fill={muteOpen} fontWeight={700}>
          ◯
        </text>
      );
    }
    return null;
  };

  // Barre
  const renderBarre = (b: Barre, i: number) => {
  const y = yOfFretCenter(b.fret);
  if (y == null) return null;
  const x1 = xOfString(6 - b.to);
  const x2 = xOfString(6 - b.from);
  return (
    <g key={`barre-${i}`}>
      <rect
        x={x1 - 10}
        y={y - 12}
        width={(x2 - x1) + 20}
        height={24}
        rx={12}
        fill={dot}
        opacity={0.95}
      />
      {b.finger && (
        <text x={(x1 + x2) / 2} y={y + 5} textAnchor="middle" fontSize="13" fill={dotText} fontWeight={800}>
          {b.finger}
        </text>
      )}
    </g>
  );
};

  // Dots
  const renderDots = () => {
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < 6; i++) {
      const val = positions[i];             // theo thứ tự [6,5,4,3,2,1]
      if (val <= 0) continue;
      const y = yOfFretCenter(val);
      if (y == null) continue;
      const s = 6 - i;                             // 1..6 trái->phải
      const x = xOfString(s);
      nodes.push(
        <g key={`d-${i}`}>
          <circle cx={x} cy={y} r={12.5} fill={dot} />
          {shape.fingers?.[i] && (
            <text x={x} y={y + 4} fill={dotText} fontSize="13" fontWeight={800} textAnchor="middle">
              {shape.fingers![i] as number}
            </text>
          )}
        </g>
      );
    }
    return nodes;
  };

  // Root marker trái (tuỳ chọn)
  const renderRoot = () => {
    if (!shape.rootString) return null;
    const s = shape.rootString; // 6..1
    const x = xOfString(s);
    const y = fretYs[numFrets] + 18; // bên trái hàng dưới cùng
    return (
      <text x={x} y={padT + gridH + 22} textAnchor="middle" fontSize="12" fill={ink} opacity={0.9}>
        R
      </text>
    );
  };

  // Tên hợp âm
  const renderName = () => {
    if (!shape.name) return null;
    return (
      <text
        x={width / 2}
        y={h - 16}
        textAnchor="middle"
        fontWeight={800}
        fontSize="22"
        fill={ink}
      >
        {shape.name}
      </text>
    );
  };

  // Số ngăn phía trên
  const renderFretNumbers = () => {
    if (!showFretNumbers) return null;
    const nums: React.ReactNode[] = [];
    for (let i = 0; i < numFrets; i++) {
      const label = baseFret + i;
      const x = padL + (stringGap * 0.5); // đặt gần phía trái
      const y = (fretYs[i] + fretYs[i + 1]) / 2 + 5;
      nums.push(
        <text key={`fn-${i}`} x={padL + i * 1000 /* offscreen to avoid clutter */} style={{ display: "none" }}>
          {label}
        </text>
      );
    }
    // In dọc phía trên: 1..4 (hoặc 3..6) “giản dị” hơn
    const labels: React.ReactNode[] = [];
    for (let i = 0; i < numFrets; i++) {
      const label = baseFret + i;
      const x = padL + (i + 0.5) * ((innerW) / numFrets); // chia đều trên trục x
      labels.push(
        <text key={`top-${i}`} x={x} y={padT - 12} textAnchor="middle" fontSize="12" fill={ink} opacity={0.9}>
          {label}
        </text>
      );
    }
    return <>{labels}</>;
  };

  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} role="img" aria-label={shape.name ?? "Chord"}>
      {/* background nhẹ theo theme */}
      <rect x="0" y="0" width={width} height={h} fill="transparent" />
      
      {/* Grid: frets (ngang) */}
      {fretYs.map((y, i) => (
        <line
          key={`f-${i}`}
          x1={padL}
          x2={padL + innerW}
          y1={y}
          y2={y}
          stroke={i === 0 && baseFret === 1 ? nutColor : line}
          strokeWidth={i === 0 && baseFret === 1 ? 4 : 1.2}
        />
      ))}

      {/* Grid: strings (dọc) — dây 1 trên, dây 6 dưới nhưng vẫn vẽ trái->phải 1..6 */}
      {Array.from({ length: 6 }).map((_, idx) => {
        const s = idx + 1;
        const x = xOfString(s);
        // chọn thickness theo dây (chuyển sang index 1..6 rồi map sang STR_THICKNESS)
        const thick = STR_THICKNESS[idx];
        return (
          <line
            key={`s-${s}`}
            x1={x}
            x2={x}
            y1={padT}
            y2={padT + gridH}
            stroke={line}
            strokeWidth={thick}
          />
        );
      })}

      {/* Open / Mute markers */}
      {positions.map((v, i) => renderOpenMute(i, v))}

      {/* Barre trước rồi dot (dot đè lên đẹp hơn, muốn ngược lại thì đổi thứ tự) */}
      {shape.barres?.map(renderBarre)}
      {renderDots()}

      {/* String labels (1..6 hoặc ký hiệu khác) */}
      {stringLabels &&
        Array.from({ length: 6 }).map((_, idx) => (
          <text
            key={`lbl-${idx}`}
            x={padL - 16}
            y={padT + gridH - (idx * (gridH / (numFrets * 0 + 6))) - 2}
            textAnchor="middle"
            fontSize="12"
            fill={ink}
            opacity={0.75}
          >
            {6 - idx}
          </text>
        ))}

      {renderRoot()}
      {renderFretNumbers()}
      {renderName()}
    </svg>
  );
}
