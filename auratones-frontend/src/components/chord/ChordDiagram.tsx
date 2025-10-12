import { useMemo } from "react";
import type { ChordShape } from "../../types/chord";
import "../../styles/ChordDiagram.scss";

type Props = {
  shape: ChordShape;
  numStrings?: number;
  showName?: boolean;
  pressBias?: number;
};

const DEFAULTS = { baseFret: 1, numFretsMin: 4 };

const VB_W = 920;
const VB_H = 500;

const SAFE_X = 12;
const SAFE_Y = 10;
const TEXT_PAD_X = 8;
const TEXT_ASCENT = 10;

/** Tuning hình học */
const DOT_SCALE = 2.0;
const DOT_MAX   = 28;
const LABEL_K   = 1.2;

const OPEN_R_MIN = 6;
const OPEN_R_MAX = 13;
const OPEN_R_RATIO = 0.22 * 1.3;

const DOT_BIAS_ALL       = 0.48;
const DOT_MARGIN_RATIO_2 = 0.08;
const DOT_MARGIN_MIN_2   = 4;

/** Độ dày dây: nâng biên để khác biệt rõ ràng */
const THICK_TREBLE = 0.8;   // dây 1
const THICK_BASS   = 5.2;   // dây N
const THICK_GAMMA  = 0.6;   // cong phân bố

/** Bước tối thiểu giữa hai dây liền kề để nhìn rõ ràng */
const THICK_MIN_STEP = 0.35;

const CENTER_CORR = 0.5;

const NUT_GAP = 6;
const NUT_BAR_W = 3;

const STRING_OVERHANG_RATIO = 0.12;

const COL_W_LEFT = 26;
const COL_W_MID  = 26;
const COL_W_NECK = 22;

const NECK_GUARD_MIN   = 6;
const NECK_GUARD_RATIO = 0.6;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export default function ChordDiagram({
  shape,
  numStrings = shape.frets.length,
  showName = !!shape.name,
  pressBias,
}: Props) {
  const clipId = useMemo(() => `clip-strings-${Math.random().toString(36).slice(2)}`, []);

  const data = useMemo(() => {
    const width = VB_W;
    const height = VB_H;

    const baseFret = shape.baseFret ?? DEFAULTS.baseFret;
    const N = numStrings;

    const innerTop = SAFE_Y + height * 0.14;
    const innerBottom = height - SAFE_Y - height * 0.12;

    const COL_PAD = Math.max(60, width * 0.20);
    const LEFT = SAFE_X + COL_PAD;
    const RIGHT = SAFE_X + 36;

    const COL_CX_NECK = LEFT - COL_W_NECK / 2;
    const COL_CX_MID  = LEFT - COL_W_NECK - COL_W_MID / 2;
    const COL_CX_LEFT = LEFT - COL_W_NECK - COL_W_MID - COL_W_LEFT / 2;

    const absMaxFret = Math.max(
      baseFret + (shape.gridFrets ?? DEFAULTS.numFretsMin) - 1,
      ...shape.frets.map((f) => (f > 0 ? f : baseFret)),
      ...(shape.barres ?? []).map((b) => b.fret)
    );
    const spanUsed = Math.max(1, absMaxFret - baseFret + 1);

    const preferred = clamp(shape.gridFrets ?? DEFAULTS.numFretsMin, 4, 5);
    const needMin = Math.max(preferred, spanUsed);
    const numFrets = clamp(needMin, 4, 5);

    const fretWeights: number[] = [];
    if (baseFret >= 7) {
      for (let i = 0; i < numFrets; i++) fretWeights.push(1);
    } else {
      let wtemp = 1;
      for (let i = 0; i < numFrets; i++) {
        fretWeights.push(wtemp);
        wtemp *= 0.88;
      }
    }
    const total = fretWeights.reduce((a, b) => a + b, 0);

    const fretXs: number[] = [LEFT];
    const gridWidth = width - LEFT - RIGHT;
    for (const wi of fretWeights) {
      fretXs.push(fretXs[fretXs.length - 1] + gridWidth * (wi / total));
    }

    const hasNut = baseFret === 1;

    const stringYs = new Array(N).fill(0).map((_, i) =>
      innerTop + ((innerBottom - innerTop) * i) / (N - 1)
    );

    /** Độ dày dây cơ sở (mảnh → dày) */
    const baseThickness = Array.from({ length: N }, (_, i) => {
      const x = N === 1 ? 1 : i / (N - 1);
      const eased = Math.pow(x, THICK_GAMMA);
      const t = THICK_TREBLE + (THICK_BASS - THICK_TREBLE) * eased;
      return Math.round(t * 100) / 100;
    });

    /** Ép bước tối thiểu để khác biệt rõ ràng */
    const stringThickness = baseThickness.slice();
    for (let i = 1; i < N; i++) {
      const prev = stringThickness[i - 1];
      stringThickness[i] = Math.max(stringThickness[i], prev + THICK_MIN_STEP);
    }
    stringThickness[N - 1] = Math.min(stringThickness[N - 1], THICK_BASS);

    const yCenter = (idx: number) => stringYs[idx] - stringThickness[idx] * CENTER_CORR;

    const yTop = yCenter(0);
    const yBot = yCenter(N - 1);

    const cellH = (innerBottom - innerTop) / (N - 1);
    const dotRBase = Math.min(13, cellH * 0.36);
    const dotR = Math.min(DOT_MAX, dotRBase * DOT_SCALE);
    const labelFont = Math.max(12, Math.round(dotR * LABEL_K));
    const openR = Math.max(OPEN_R_MIN, Math.min(OPEN_R_MAX, cellH * OPEN_R_RATIO));

    const OVERHANG = Math.max(10, width * STRING_OVERHANG_RATIO);
    const requiredLeftOverhang = Math.max(OVERHANG, 2 * dotR);

    const nutCenter = fretXs[0];
    const nut1x = nutCenter - NUT_GAP / 2 - NUT_BAR_W / 2;
    const nut2x = nutCenter + NUT_GAP / 2 - NUT_BAR_W / 2;

    const stringX1 = hasNut
      ? nut1x + NUT_BAR_W
      : Math.max(fretXs[0] - requiredLeftOverhang, SAFE_X);

    const stringX2 = Math.min(fretXs[fretXs.length - 1] + OVERHANG, width - SAFE_X);

    const neckGuard = Math.max(NECK_GUARD_MIN, Math.round(openR * NECK_GUARD_RATIO));
    const stringsClipX = LEFT - COL_W_NECK + neckGuard;

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

    const dotYBias = (idx: number) => clamp(stringThickness[idx] * 1, 3, 4.6);
    const openYBias = (idx: number) => clamp(stringThickness[idx] * 0.5, 2, 3.6);

    const rawFrets = shape.frets.slice(0, N);
    const barres = (shape.barres ?? []).map((b) => ({
      fret: b.fret,
      from: Math.min(b.from, b.to),
      to: Math.max(b.from, b.to),
      finger: (b as any).finger as number | undefined,
    }));

    const highestBarreAtString = (string1: number) => {
      let maxF = 0;
      for (const b of barres) {
        if (string1 >= b.from && string1 <= b.to) maxF = Math.max(maxF, b.fret);
      }
      return maxF;
    };

    const effectiveFrets = rawFrets.map((f, idx) => {
      if (f === -1) return -1;
      const barreF = highestBarreAtString(idx + 1);
      return Math.max(f, barreF);
    });

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

    rawFrets.forEach((f, i) => {
      const eff = effectiveFrets[i];
      if (f <= 0 || eff !== f) return;
      const cx = fretCenterX(f);
      if (cx == null) return;
      const cy = yCenter(i) - dotYBias(i);
      bx(cx - DOT_MAX); bx(cx + DOT_MAX);
      by(cy - DOT_MAX); by(cy + DOT_MAX);

      const labelPadX = Math.max(TEXT_PAD_X, Math.round(labelFont * 0.35));
      const labelAscent = Math.round(labelFont * 0.6);
      bx(cx - labelPadX); bx(cx + labelPadX);
      by(cy - labelAscent); by(cy + labelAscent);
    });

    const barreRects: Array<{
      x: number; y: number; w: number; h: number; rx: number;
      cx: number; cy: number; finger?: number;
      fret: number; from: number; to: number;
    }> = [];
    if (barres.length) {
      const yOf = (s1b: number) => yCenter(s1b - 1);
      barres.forEach((b) => {
        const s1 = b.from, s2 = b.to;
        const y1 = yOf(s1), y2 = yOf(s2);
        const cx = fretCenterX(b.fret);
        if (cx == null) return;

        const wBarre = 2 * dotR;
        const extend = Math.max(4, dotR * 0.8);
        const yTopBarre = y1 - extend;
        const yBotBarre = y2 + extend;

        barreRects.push({
          x: cx - wBarre / 2,
          y: yTopBarre,
          w: wBarre,
          h: yBotBarre - yTopBarre,
          rx: wBarre / 2,
          cx,
          cy: (yTopBarre + yBotBarre) / 2,
          finger: b.finger,
          fret: b.fret,
          from: s1,
          to: s2,
        });

        bx(cx - wBarre / 2); bx(cx + wBarre / 2);
        by(yTopBarre); by(yBotBarre);
      });
    }

    fretXs.slice(0, numFrets).forEach((x1, i) => {
      const x2 = fretXs[i + 1];
      const x = (x1 + x2) / 2, y = innerTop - 26;
      bx(x - TEXT_PAD_X); bx(x + TEXT_PAD_X);
      by(y - TEXT_ASCENT); by(y + TEXT_ASCENT);
    });

    if (showName && shape.name) {
      const x = width / 2, y = height - 6;
      bx(x - 60); bx(x + 60);
      by(y - 16); by(y + 8);
    }

    const PAD = 6;
    const vbX = Math.max(0, minX - PAD);
    const vbY = Math.max(0, minY - PAD);
    const vbW = Math.min(width - vbX, maxX - minX + PAD * 2);
    const vbH = Math.min(height - vbY, maxY - minY + PAD * 2);

    const stringIndexFont = Math.round(Math.max(12, Math.min(20, cellH * 0.4)));
    const fretNumberFont = Math.round(Math.max(14, Math.min(22, cellH * 0.44)));

    const isRootOpenEffective = () =>
      !!shape.rootString && effectiveFrets[shape.rootString - 1] === 0;

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
    };
  }, [shape, numStrings, pressBias, showName]);

  const {
    baseFret, innerTop, fretXs, numFrets, hasNut, nut1x, nut2x,
    stringX1, stringX2, yCenter, yTop, yBot,
    COL_CX_LEFT, COL_CX_MID, stringsClipX,
    dotR, labelFont, openR, dotYBias, openYBias, fretCenterX,
    barreRects, effectiveFrets, rawFrets,
    stringIndexFont, fretNumberFont, isRootOpenEffective, bbox,
    stringThickness,
  } = data;

  const hasBarreAt = (stringIndex1: number, fret: number) =>
    barreRects.some((r) => r.fret === fret && stringIndex1 >= r.from && stringIndex1 <= r.to);

  return (
    <svg className="chord-svg" viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={clipId}>
          <rect x={stringsClipX} y={yTop - 20} width={VB_W - stringsClipX} height={yBot - yTop + 40} />
        </clipPath>
      </defs>

      {fretXs.map((x, i) => (
        <line key={`fret-${i}`} x1={x} x2={x} y1={yTop} y2={yBot} className="fret-line" />
      ))}
      {hasNut && (
        <>
          <rect x={nut1x} y={yTop} width={NUT_BAR_W} height={yBot - yTop} className="nut-bar" />
          <rect x={nut2x} y={yTop} width={NUT_BAR_W} height={yBot - yTop} className="nut-bar" />
        </>
      )}

      {/* Dây: strokeWidth theo stringThickness */}
      <g clipPath={`url(#${clipId})`}>
        {Array.from({ length: rawFrets.length }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={stringX1}
            x2={stringX2}
            y1={yCenter(i)}
            y2={yCenter(i)}
            className="string-line"
            style={{ strokeWidth: stringThickness[i] }}
          />
        ))}
      </g>

      {rawFrets.map((fret, i) => {
        const eff = effectiveFrets[i];
        if (fret <= 0 || eff !== fret) return null;
        const cx = fretCenterX(fret);
        if (cx == null) return null;
        const cy = yCenter(i) - dotYBias(i);

        const showFinger = (shape.fingers?.[i] ?? 0) > 0 ? shape.fingers![i] : 0;
        const isRootThisDot =
          shape.rootString === i + 1 &&
          ((shape.rootFret && shape.rootFret === fret) || (!shape.rootFret && fret > 0));

        return (
          <g key={`dot-${i}`}>
            <circle cx={cx} cy={cy} r={dotR} className="dot" />
            {!!showFinger && (
              <text x={cx} y={cy} className="dot-label" style={{ fontSize: labelFont }}>
                {showFinger}
              </text>
            )}
            {isRootThisDot && (
              <text x={cx - dotR - 8} y={cy + dotR + 2} className="root-inline">
                R
              </text>
            )}
          </g>
        );
      })}

      {barreRects.map((r, i) => (
        <g key={`barre-${i}`}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} className="barre" />
          {typeof r.finger === "number" && (
            <text x={r.cx} y={r.cy} className="dot-label" style={{ fontSize: labelFont }}>
              {r.finger}
            </text>
          )}
        </g>
      ))}

      {shape.rootString &&
        shape.rootFret &&
        hasBarreAt(shape.rootString, shape.rootFret) && (() => {
          const cx = fretCenterX(shape.rootFret!);
          if (cx == null) return null;
          const cy = yCenter(shape.rootString - 1) - 2;
          return (
            <text x={cx - dotR - 8} y={cy + dotR + 2} className="root-inline">
              R
            </text>
          );
        })()}

      {rawFrets.map((f, i) => {
        const y = yCenter(i);
        const yOpen = y - openYBias(i);
        const stringNo = i + 1;
        const eff = effectiveFrets[i];

        return (
          <g key={`leftcol-${i}`}>
            <text x={COL_CX_MID} y={y} className="string-index" style={{ fontSize: stringIndexFont }}>
              {stringNo}
            </text>
            {eff === 0 && <circle cx={COL_CX_MID} cy={yOpen} r={openR} className="open-marker" />}
            {shape.frets[i] === -1 && <text x={COL_CX_LEFT} y={y} className="mute-marker">×</text>}
            {shape.rootString === stringNo && eff === 0 && (() => {
              return <text x={COL_CX_LEFT} y={y} className="root-left">R</text>;
            })()}
          </g>
        );
      })}

      {fretXs.slice(0, numFrets).map((x1, i) => {
        const x2 = fretXs[i + 1];
        return (
          <text
            key={`fnum-${i}`}
            x={(x1 + x2) / 2}
            y={innerTop - 26}
            className="fret-number"
            style={{ fontSize: fretNumberFont }}
          >
            {baseFret + i}
          </text>
        );
      })}
    </svg>
  );
}
