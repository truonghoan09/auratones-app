// ─────────────────────────────────────────────────────────────────────────────
// src/ChordDiagram.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import type { ChordShape } from "../../types/chord";
import "../../styles/ChordDiagram.scss";

type Props = {
  shape: ChordShape;
  numStrings?: number;           // 6 guitar, 4 ukulele
  showName?: boolean;
  pressBias?: number;            // 0..0.5 – điều chỉnh lệch dot về phía thùng
  bassTrebleSplitIndex?: number; // vị trí tách bass/treble theo chỉ số 1-based (mặc định: nửa dưới)
  bassStringColor?: string;      // override màu bass (CSS color)
  trebleStringColor?: string;    // override màu treble (CSS color)
  fretboardGradient?: {
    enabled?: boolean;           // bật/ tắt nền gradient cần đàn
    from?: string;               // màu đầu
    to?: string;                 // màu cuối
    opacity?: number;            // 0..1
  };
};

const DEFAULTS = { baseFret: 1, numFretsMin: 4 };

// ViewBox cố định; SVG responsive qua width:100%
const VB_W = 920;
const VB_H = 500;

// Lề & text
const SAFE_X = 12;
const SAFE_Y = 10;
const TEXT_PAD_X = 8;
const TEXT_ASCENT = 10;

// Cấu hình kích thước dot/nhãn
const DOT_SCALE = 2.0;
const DOT_MAX   = 28;
const LABEL_K   = 1.2;

const OPEN_R_MIN = 6;
const OPEN_R_MAX = 13;
const OPEN_R_RATIO = 0.22 * 1.3;

// Lệch dot về phía thùng
const DOT_BIAS_ALL       = 0.48;
const DOT_MARGIN_RATIO_2 = 0.08;
const DOT_MARGIN_MIN_2   = 4;

// Độ dày dây: tăng tương phản thị giác
const THICK_TREBLE = 0.8;   // dây 1
const THICK_BASS   = 5.2;   // dây N
const THICK_GAMMA  = 0.6;   // độ cong phân bố
const THICK_MIN_STEP = 0.35; // chênh tối thiểu giữa 2 dây liên tiếp

// Hiệu chỉnh tâm thị giác theo độ dày nét
const CENTER_CORR = 0.5;

const NUT_GAP = 6;
const NUT_BAR_W = 3;

// Dây vượt lưới hai bên
const STRING_OVERHANG_RATIO = 0.12;

// Ba cột trái
const COL_W_LEFT = 26;  // mute/R
const COL_W_MID  = 26;  // số dây + open
const COL_W_NECK = 22;  // khe cổ đàn cho dây thò

// Guard giữa NECK và MID
const NECK_GUARD_MIN   = 6;
const NECK_GUARD_RATIO = 0.6;

// Tiện ích
function clamp(x: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, x)); }

export default function ChordDiagram({
  shape,
  numStrings = shape.frets.length,
  showName = !!shape.name,
  pressBias,
  bassTrebleSplitIndex,
  bassStringColor,
  trebleStringColor,
  fretboardGradient,
}: Props) {
  const clipId = useMemo(() => `clip-strings-${Math.random().toString(36).slice(2)}`,[ ]);
  const gradId = useMemo(() => `fretboard-grad-${Math.random().toString(36).slice(2)}`,[ ]);

  const data = useMemo(() => {
    const width = VB_W;
    const height = VB_H;

    const baseFret = shape.baseFret ?? DEFAULTS.baseFret;
    const N = numStrings;

    // Vùng lưới dọc
    const innerTop = SAFE_Y + height * 0.14;
    const innerBottom = height - SAFE_Y - height * 0.12;

    // Lề trái/phải của GRID (không tính 3 cột bên trái)
    const COL_PAD = Math.max(60, width * 0.20);
    const LEFT = SAFE_X + COL_PAD;        // biên phải của cột trái
    const RIGHT = SAFE_X + 36;

    // Tâm ba cột trái (từ phải sang trái)
    const COL_CX_NECK = LEFT - COL_W_NECK / 2;
    const COL_CX_MID  = LEFT - COL_W_NECK - COL_W_MID / 2;
    const COL_CX_LEFT = LEFT - COL_W_NECK - COL_W_MID - COL_W_LEFT / 2;

    // Số ô cần vẽ theo dữ liệu
    const absMaxFret = Math.max(
      baseFret + (shape.gridFrets ?? DEFAULTS.numFretsMin) - 1,
      ...shape.frets.map((f) => (f > 0 ? f : baseFret)),
      ...(shape.barres ?? []).map((b) => b.fret)
    );
    const spanUsed = Math.max(1, absMaxFret - baseFret + 1);

    const preferred = clamp(shape.gridFrets ?? DEFAULTS.numFretsMin, 4, 5);
    const needMin = Math.max(preferred, spanUsed);
    const numFrets = clamp(needMin, 4, 5);

    // Độ rộng các ngăn (taper ở ngăn thấp)
    const fretWeights: number[] = [];
    if (baseFret >= 7) {
      for (let i = 0; i < numFrets; i++) fretWeights.push(1);
    } else {
      let wtemp = 1;
      for (let i = 0; i < numFrets; i++) { fretWeights.push(wtemp); wtemp *= 0.88; }
    }
    const total = fretWeights.reduce((a, b) => a + b, 0);

    // Toạ độ trục X của các phím
    const fretXs: number[] = [LEFT];
    const gridWidth = width - LEFT - RIGHT;
    for (const wi of fretWeights) fretXs.push(fretXs[fretXs.length - 1] + gridWidth * (wi / total));

    const hasNut = baseFret === 1;

    // Y dây (1 trên → N dưới)
    const stringYs = new Array(N).fill(0).map((_, i) => innerTop + ((innerBottom - innerTop) * i) / (N - 1));

    // Độ dày dây cơ sở (mảnh → dày)
    const baseThickness = Array.from({ length: N }, (_, i) => {
      const x = N === 1 ? 1 : i / (N - 1);
      const eased = Math.pow(x, THICK_GAMMA);
      const t = THICK_TREBLE + (THICK_BASS - THICK_TREBLE) * eased;
      return Math.round(t * 100) / 100;
    });

    // Ép bước tối thiểu để khác biệt rõ ràng
    const stringThickness = baseThickness.slice();
    for (let i = 1; i < N; i++) {
      const prev = stringThickness[i - 1];
      stringThickness[i] = Math.max(stringThickness[i], prev + THICK_MIN_STEP);
    }
    stringThickness[N - 1] = Math.min(stringThickness[N - 1], THICK_BASS);

    // Tâm thị giác theo độ dày
    const yCenter = (idx: number) => stringYs[idx] - stringThickness[idx] * CENTER_CORR;

    const yTop = yCenter(0);
    const yBot = yCenter(N - 1);

    // Kích thước cell + dot/label/open
    const cellH = (innerBottom - innerTop) / (N - 1);
    const dotRBase = Math.min(13, cellH * 0.36);
    const dotR = Math.min(DOT_MAX, dotRBase * DOT_SCALE);
    const labelFont = Math.max(12, Math.round(dotR * LABEL_K));
    const openR = Math.max(OPEN_R_MIN, Math.min(OPEN_R_MAX, cellH * OPEN_R_RATIO));

    // Dây: overhang & vị trí X
    const OVERHANG = Math.max(10, width * STRING_OVERHANG_RATIO);
    const requiredLeftOverhang = Math.max(OVERHANG, 2 * dotR);

    const nutCenter = fretXs[0];
    const nut1x = nutCenter - NUT_GAP / 2 - NUT_BAR_W / 2;
    const nut2x = nutCenter + NUT_GAP / 2 - NUT_BAR_W / 2;

    const stringX1 = hasNut ? (nut1x + NUT_BAR_W) : Math.max(fretXs[0] - requiredLeftOverhang, SAFE_X);
    const stringX2 = Math.min(fretXs[fretXs.length - 1] + OVERHANG, width - SAFE_X);

    // Clip cho dây để không đè vào cột trái
    const neckGuard = Math.max(NECK_GUARD_MIN, Math.round(openR * NECK_GUARD_RATIO));
    const stringsClipX = LEFT - COL_W_NECK + neckGuard;

    // Vị trí dot theo phím (lệch về phía thùng)
    const DOT_BIAS = pressBias ?? DOT_BIAS_ALL;
    const fretCenterX = (fret: number) => {
      const i = fret - baseFret;
      if (i < 0 || i >= fretXs.length - 1) return null;
      const x1 = fretXs[i];
      const x2 = fretXs[i + 1];
      const w = x2 - x1;
      const margin = Math.max(DOT_MARGIN_MIN_2, w * DOT_MARGIN_RATIO_2);
      const usableHalf = w / 2 - margin;
      const bias = clamp(DOT_BIAS, 0, 0.5);
      return x1 + w * 0.5 + usableHalf * bias;
    };

    // Bù theo độ dày dây
    const dotYBias = (idx: number) => clamp(stringThickness[idx] * 1, 3, 4.6);
    const openYBias = (idx: number) => clamp(stringThickness[idx] * 0.5, 2, 3.6);

    // Barre
    const rawFrets = shape.frets.slice(0, N);
    const barres = (shape.barres ?? []).map((b) => ({
      fret: b.fret,
      from: Math.min(b.from, b.to),
      to: Math.max(b.from, b.to),
      finger: (b as any).finger as number | undefined,
    }));

    const highestBarreAtString = (string1: number) => {
      let maxF = 0;
      for (const b of barres) if (string1 >= b.from && string1 <= b.to) maxF = Math.max(maxF, b.fret);
      return maxF;
    };

    const effectiveFrets = rawFrets.map((f, idx) => {
      if (f === -1) return -1;
      const barreF = highestBarreAtString(idx + 1);
      return Math.max(f, barreF);
    });

    // BBox tính động để viewBox khít
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const bx = (x: number) => { if (x < minX) minX = x; if (x > maxX) maxX = x; };
    const by = (y: number) => { if (y < minY) minY = y; if (y > maxY) maxY = y; };

    stringYs.forEach((_, i) => {
      const y = yCenter(i);
      bx(stringsClipX); bx(stringX2); by(y);
      bx(COL_CX_MID - TEXT_PAD_X); bx(COL_CX_MID + TEXT_PAD_X); by(y - TEXT_ASCENT); by(y + TEXT_ASCENT);
      bx(COL_CX_LEFT - TEXT_PAD_X); bx(COL_CX_LEFT + TEXT_PAD_X); by(y - TEXT_ASCENT); by(y + TEXT_ASCENT);
    });

    fretXs.forEach((x) => { bx(x); by(yTop); by(yBot); });

    if (hasNut) {
      bx(nut1x); bx(nut1x + NUT_BAR_W); by(yTop); by(yBot);
      bx(nut2x); bx(nut2x + NUT_BAR_W); by(yTop); by(yBot);
    }

    // Dots + labels (bbox) — chỉ nốt trực tiếp
    rawFrets.forEach((f, i) => {
      const eff = effectiveFrets[i];
      if (f <= 0 || eff !== f) return;
      const cx = fretCenterX(f); if (cx == null) return;
      const cy = yCenter(i) - dotYBias(i);
      bx(cx - DOT_MAX); bx(cx + DOT_MAX);
      by(cy - DOT_MAX); by(cy + DOT_MAX);
      const labelPadX = Math.max(TEXT_PAD_X, Math.round(labelFont * 0.35));
      const labelAscent = Math.round(labelFont * 0.6);
      bx(cx - labelPadX); bx(cx + labelPadX);
      by(cy - labelAscent); by(cy + labelAscent);
    });

    // Barre rects
    const barreRects: Array<{ x: number; y: number; w: number; h: number; rx: number; cx: number; cy: number; finger?: number; fret: number; from: number; to: number; }>
      = [];
    if (barres.length) {
      const yOf = (s1b: number) => yCenter(s1b - 1);
      barres.forEach((b) => {
        const s1 = b.from, s2 = b.to;
        const y1 = yOf(s1), y2 = yOf(s2);
        const cx = fretCenterX(b.fret); if (cx == null) return;
        const wBarre = 2 * dotR;
        const extend = Math.max(4, dotR * 0.8);
        const yTopBarre = y1 - extend;
        const yBotBarre = y2 + extend;
        barreRects.push({ x: cx - wBarre / 2, y: yTopBarre, w: wBarre, h: yBotBarre - yTopBarre, rx: wBarre / 2, cx, cy: (yTopBarre + yBotBarre) / 2, finger: b.finger, fret: b.fret, from: s1, to: s2 });
        bx(cx - wBarre / 2); bx(cx + wBarre / 2); by(yTopBarre); by(yBotBarre);
      });
    }

    // Số ngăn
    fretXs.slice(0, numFrets).forEach((x1, i) => {
      const x2 = fretXs[i + 1]; const x = (x1 + x2) / 2, y = innerTop - 26;
      bx(x - TEXT_PAD_X); bx(x + TEXT_PAD_X); by(y - TEXT_ASCENT); by(y + TEXT_ASCENT);
    });

    // Tên hợp âm
    if (showName && shape.name) { const x = width / 2, y = height - 6; bx(x - 60); bx(x + 60); by(y - 16); by(y + 8); }

    // ViewBox khít
    const PAD = 6;
    const vbX = Math.max(0, minX - PAD);
    const vbY = Math.max(0, minY - PAD);
    const vbW = Math.min(width - vbX, maxX - minX + PAD * 2);
    const vbH = Math.min(height - vbY, maxY - minY + PAD * 2);

    // Font động
    const stringIndexFont = Math.round(Math.max(12, Math.min(20, cellH * 0.4)));
    const fretNumberFont = Math.round(Math.max(14, Math.min(22, cellH * 0.44)));

    // Root open hiệu dụng
    const isRootOpenEffective = () => !!shape.rootString && effectiveFrets[shape.rootString - 1] === 0;

    // Chia bass/treble theo index 1-based; mặc định: nửa dưới (ví dụ guitar 6 dây → bass=4-6)
    const splitAt = clamp(bassTrebleSplitIndex ?? Math.ceil(N / 2) + 1, 2, N);

    return {
      baseFret, N, innerTop, fretXs, numFrets, hasNut, nut1x, nut2x,
      stringX1, stringX2, yCenter, yTop, yBot,
      COL_CX_LEFT, COL_CX_MID, COL_CX_NECK, stringsClipX,
      dotR, labelFont, openR, dotYBias, openYBias, fretCenterX,
      barreRects,
      effectiveFrets, rawFrets,
      stringIndexFont, fretNumberFont,
      isRootOpenEffective,
      bbox: { x: vbX, y: vbY, w: vbW, h: vbH },
      stringThickness,
      splitAt,
    };
  }, [shape, numStrings, pressBias, showName, bassTrebleSplitIndex]);

  const {
    baseFret, innerTop, fretXs, numFrets, hasNut, nut1x, nut2x,
    stringX1, stringX2, yCenter, yTop, yBot,
    COL_CX_LEFT, COL_CX_MID, stringsClipX,
    dotR, labelFont, openR, dotYBias, openYBias, fretCenterX,
    barreRects, effectiveFrets, rawFrets,
    stringIndexFont, fretNumberFont, isRootOpenEffective, bbox,
    stringThickness, splitAt,
  } = data;

  // Màu dây bass/treble (ưu tiên props, sau đó CSS vars)
  const bassColor = bassStringColor ?? "var(--string-bass-color)";
  const trebleColor = trebleStringColor ?? "var(--string-treble-color)";

  const gradEnabled = fretboardGradient?.enabled ?? true;
  const gradFrom = fretboardGradient?.from ?? "var(--fretboard-grad-from)";
  const gradTo = fretboardGradient?.to ?? "var(--fretboard-grad-to)";
  const gradOpacity = clamp(fretboardGradient?.opacity ?? 1, 0, 1);

  const hasBarreAt = (stringIndex1: number, fret: number) =>
    barreRects.some((r) => r.fret === fret && stringIndex1 >= r.from && stringIndex1 <= r.to);

  return (
    <svg className="chord-svg" viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={clipId}>
          <rect x={stringsClipX} y={yTop - 20} width={VB_W - stringsClipX} height={yBot - yTop + 40} />
        </clipPath>
        {gradEnabled && (
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradFrom} stopOpacity={gradOpacity} />
            <stop offset="100%" stopColor={gradTo} stopOpacity={gradOpacity} />
          </linearGradient>
        )}
      </defs>

      {/* Nền cần đàn (gradient) */}
      {gradEnabled && (
        <rect
          x={fretXs[0]}
          y={yTop}
          width={fretXs[fretXs.length - 1] - fretXs[0]}
          height={yBot - yTop}
          fill={`url(#${gradId})`}
          rx={4}
        />
      )}

      {/* Phím */}
      {fretXs.map((x, i) => (
        <line key={`fret-${i}`} x1={x} x2={x} y1={yTop} y2={yBot} className="fret-line" />
      ))}
      {hasNut && (
        <>
          <rect x={nut1x} y={yTop} width={NUT_BAR_W} height={yBot - yTop} className="nut-bar" />
          <rect x={nut2x} y={yTop} width={NUT_BAR_W} height={yBot - yTop} className="nut-bar" />
        </>
      )}

      {/* Dây: độ dày + màu bass/treble */}
      <g clipPath={`url(#${clipId})`}>
        {Array.from({ length: rawFrets.length }).map((_, i) => {
          const stringIndex1 = i + 1; // 1-based
          const isBass = stringIndex1 >= splitAt; // phần dưới là bass
          return (
            <line
              key={`string-${i}`}
              x1={stringX1}
              x2={stringX2}
              y1={yCenter(i)}
              y2={yCenter(i)}
              className="string-line"
              style={{ strokeWidth: stringThickness[i], stroke: isBass ? bassColor : trebleColor }}
            />
          );
        })}
      </g>

      {/* Dots (nốt trực tiếp) */}
      {rawFrets.map((fret, i) => {
        const eff = effectiveFrets[i];
        if (fret <= 0 || eff !== fret) return null;
        const cx = fretCenterX(fret); if (cx == null) return null;
        const cy = yCenter(i) - dotYBias(i);
        const showFinger = (shape.fingers?.[i] ?? 0) > 0 ? shape.fingers![i] : 0;
        const isRootThisDot = shape.rootString === i + 1 && ((shape.rootFret && shape.rootFret === fret) || (!shape.rootFret && fret > 0));
        return (
          <g key={`dot-${i}`}>
            <circle cx={cx} cy={cy} r={dotR} className="dot" />
            {!!showFinger && (
              <text x={cx} y={cy} className="dot-label" style={{ fontSize: labelFont }}>{showFinger}</text>
            )}
            {isRootThisDot && (<text x={cx - dotR - 8} y={cy + dotR + 2} className="root-inline">R</text>)}
          </g>
        );
      })}

      {/* Barre + số ngón trên barre */}
      {barreRects.map((r, i) => (
        <g key={`barre-${i}`}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} className="barre" />
          {typeof r.finger === "number" && (
            <text x={r.cx} y={r.cy} className="dot-label" style={{ fontSize: labelFont }}>{r.finger}</text>
          )}
        </g>
      ))}

      {/* Root marker khi root nằm trong barre */}
      {shape.rootString && shape.rootFret && hasBarreAt(shape.rootString, shape.rootFret) && (() => {
        const cx = fretCenterX(shape.rootFret!); if (cx == null) return null;
        const cy = yCenter(shape.rootString - 1) - 2;
        return (<text x={cx - dotR - 8} y={cy + dotR + 2} className="root-inline">R</text>);
      })()}

      {/* Cột trái: MID (số/Open) + LEFT (mute/R) */}
      {rawFrets.map((f, i) => {
        const y = yCenter(i);
        const yOpen = y - openYBias(i);
        const stringNo = i + 1;
        const eff = effectiveFrets[i];
        return (
          <g key={`leftcol-${i}`}>
            <text x={COL_CX_MID} y={y} className="string-index" style={{ fontSize: stringIndexFont }}>{stringNo}</text>
            {eff === 0 && <circle cx={COL_CX_MID} cy={yOpen} r={openR} className="open-marker" />}
            {f === -1 && <text x={COL_CX_LEFT} y={y} className="mute-marker">×</text>}
            {shape.rootString === stringNo && eff === 0 && isRootOpenEffective() && (
              <text x={COL_CX_LEFT} y={y} className="root-left">R</text>
            )}
          </g>
        );
      })}

      {/* Số ngăn */}
      {fretXs.slice(0, numFrets).map((x1, i) => {
        const x2 = fretXs[i + 1];
        return (
          <text key={`fnum-${i}`} x={(x1 + x2) / 2} y={innerTop - 26} className="fret-number" style={{ fontSize: fretNumberFont }}>
            {baseFret + i}
          </text>
        );
      })}
    </svg>
  );
}

