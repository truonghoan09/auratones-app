import { useMemo } from "react";
import type { ChordShape } from "../../types/chord";
import "../../styles/ChordDiagram.scss";

type Props = {
  shape: ChordShape;
  numStrings?: number;        // 6 guitar, 4 ukulele
  showName?: boolean;
  pressBias?: number;         // 0..0.5 – override vị trí dot sát phím nếu muốn
};

const DEFAULTS = { baseFret: 1, numFretsMin: 4 };

// ViewBox chuẩn
const VB_W = 920;
const VB_H = 500;

// Lề & text
const SAFE_X = 12;
const SAFE_Y = 10;
const TEXT_PAD_X = 8;
const TEXT_ASCENT = 10;

/** ==== TUNING ==== */
const DOT_SCALE = 2.0;         // dot phóng to
const DOT_MAX   = 28;
const LABEL_K   = 1.2;         // label theo dot

const OPEN_R_MIN = 6;
const OPEN_R_MAX = 13;
const OPEN_R_RATIO = 0.22 * 1.3; // vòng Open +30%

// “Sát phím phía thùng” cho mọi ngăn
const DOT_BIAS_ALL       = 0.48; // 0..0.5 – lớn hơn = sát hơn
const DOT_MARGIN_RATIO_2 = 0.08; // biên an toàn
const DOT_MARGIN_MIN_2   = 4;

const THICK_TREBLE = 0.9;
const THICK_BASS   = 3.8;
const THICK_GAMMA  = 0.55;

/** tâm thị giác của dây = y - thickness * CENTER_CORR */
const CENTER_CORR = 0.5;

const NUT_GAP = 6;
const NUT_BAR_W = 3;

/** dây tràn ra khỏi phím nhiều hơn */
const STRING_OVERHANG_RATIO = 0.12;

/** 3 cột bên trái */
const COL_W_LEFT = 26;  // mute/R
const COL_W_MID  = 26;  // số dây + open
const COL_W_NECK = 22;  // khe cổ đàn cho dây thò (chỉ strings được vào vùng này)

/** Guard giữa NECK và MID (tránh open chạm dây) */
const NECK_GUARD_MIN   = 6;
const NECK_GUARD_RATIO = 0.6;

/** clamp helper */
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

    // Vùng lưới dọc
    const innerTop = SAFE_Y + height * 0.14;
    const innerBottom = height - SAFE_Y - height * 0.12;

    // Lề trái/phải của GRID (không tính 3 cột bên trái)
    const COL_PAD = Math.max(60, width * 0.20);
    const LEFT = SAFE_X + COL_PAD;        // biên phải của cột trái
    const RIGHT = SAFE_X + 36;

    // 3 cột: [LEFT]← NECK | MID | LEFT (từ phải sang trái)
    const COL_CX_NECK = LEFT - COL_W_NECK / 2;
    const COL_CX_MID  = LEFT - COL_W_NECK - COL_W_MID / 2;
    const COL_CX_LEFT = LEFT - COL_W_NECK - COL_W_MID - COL_W_LEFT / 2;

    // Số ô cần vẽ theo dữ liệu
    const absMaxFret = Math.max(
      baseFret + DEFAULTS.numFretsMin - 1,
      ...shape.frets.map((f) => (f > 0 ? f : baseFret))
    );
    const spanUsed = Math.max(1, absMaxFret - baseFret + 1);
    const needMin = Math.max(DEFAULTS.numFretsMin, spanUsed);

    // baseFret >= 7: hiển thị gọn 4–5 ô
    const numFrets =
      baseFret >= 7 ? clamp(needMin, 4, 5) : needMin;

    // Độ rộng các ngăn
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

    // Trục X phím
    const fretXs: number[] = [LEFT];
    const gridWidth = width - LEFT - RIGHT;
    for (const wi of fretWeights) {
      fretXs.push(fretXs[fretXs.length - 1] + gridWidth * (wi / total));
    }

    const hasNut = baseFret === 1;

    // Y dây (1 trên → N dưới)
    const stringYs = new Array(N).fill(0).map((_, i) =>
      innerTop + ((innerBottom - innerTop) * i) / (N - 1)
    );

    // độ dày dây + tâm thị giác
    const stringThickness = Array.from({ length: N }, (_, i) => {
      const x = (N === 1) ? 1 : i / (N - 1);
      const eased = Math.pow(x, THICK_GAMMA);
      const t = THICK_TREBLE + (THICK_BASS - THICK_TREBLE) * eased;
      return Math.round(t * 100) / 100;
    });
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
    const nut1x = nutCenter - (NUT_GAP / 2) - (NUT_BAR_W / 2);
    const nut2x = nutCenter + (NUT_GAP / 2) - (NUT_BAR_W / 2);

    const stringX1 = hasNut
      ? (nut1x + NUT_BAR_W)
      : Math.max(fretXs[0] - requiredLeftOverhang, SAFE_X);

    const stringX2 = Math.min(fretXs[fretXs.length - 1] + OVERHANG, width - SAFE_X);

    // CHỈ strings được “chui” vào khe NECK, có guard tránh chạm MID
    const neckGuard = Math.max(NECK_GUARD_MIN, Math.round(openR * NECK_GUARD_RATIO));
    const stringsClipX = LEFT - COL_W_NECK + neckGuard;

    // Dot sát phím phía thùng (mọi ngăn)
    const DOT_BIAS = pressBias ?? DOT_BIAS_ALL;
    const fretCenterX = (fret: number) => {
      const i = fret - baseFret;
      if (i < 0 || i >= fretXs.length - 1) return null;
      const x1 = fretXs[i];
      const x2 = fretXs[i + 1];
      const w  = x2 - x1;

      const margin     = Math.max(DOT_MARGIN_MIN_2, w * DOT_MARGIN_RATIO_2);
      const usableHalf = (w / 2) - margin;
      const bias       = clamp(DOT_BIAS, 0, 0.5);
      return x1 + w * 0.5 + usableHalf * bias;
    };

    /** ======= ĐỊNH TÂM Y “KHOA HỌC” =======
     *  - Dot & dot-label: nâng lên một phần nhỏ theo độ dày dây (đỡ bị cảm giác thấp)
     *  - Open circle: đồng tâm với TEXT số dây (giữ yCenter), nhưng để triệt cảm giác lệch,
     *    nâng vòng thêm một phần nhỏ theo thickness của chính dây đó.
     */
    const dotYBias = (idx: number) => clamp(stringThickness[idx] * 1, 3, 4.6);
    const openYBias = (idx: number) => clamp(stringThickness[idx] * 0.5, 2, 3.6);

    // BBOX
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const bx = (x: number) => { if (x < minX) minX = x; if (x > maxX) maxX = x; };
    const by = (y: number) => { if (y < minY) minY = y; if (y > maxY) maxY = y; };

    // strings lane + 3 cột
    stringYs.forEach((_, i) => {
      const y = yCenter(i);
      bx(stringsClipX); bx(stringX2); by(y);                    // strings lane
      // mid col (số dây/open)
      bx(COL_CX_MID - TEXT_PAD_X); bx(COL_CX_MID + TEXT_PAD_X);
      by(y - TEXT_ASCENT); by(y + TEXT_ASCENT);
      // left col (mute/R)
      bx(COL_CX_LEFT - TEXT_PAD_X); bx(COL_CX_LEFT + TEXT_PAD_X);
      by(y - TEXT_ASCENT); by(y + TEXT_ASCENT);
    });

    // frets
    fretXs.forEach((x) => { bx(x); by(yTop); by(yBot); });

    // nut 2 vạch
    if (hasNut) {
      bx(nut1x); bx(nut1x + NUT_BAR_W); by(yTop); by(yBot);
      bx(nut2x); bx(nut2x + NUT_BAR_W); by(yTop); by(yBot);
    }

    // dots + labels (bbox)
    shape.frets.forEach((fret, i) => {
      if (fret <= 0) return;
      const cx = fretCenterX(fret);
      if (cx == null) return;
      const cy = yCenter(i) - dotYBias(i);
      bx(cx - dotR); bx(cx + dotR); by(cy - dotR); by(cy + dotR);

      const labelPadX = Math.max(TEXT_PAD_X, Math.round(labelFont * 0.35));
      const labelAscent = Math.round(labelFont * 0.6);
      bx(cx - labelPadX); bx(cx + labelPadX);
      by(cy - labelAscent); by(cy + labelAscent);
    });

    // barre (w = 2*dotR; extend = 0.8*dotR)
    const barreRects: Array<{ x:number;y:number;w:number;h:number;rx:number; cx:number;cy:number; finger?:number; }> = [];
    if (shape.barres) {
      const yOf = (s1b: number) => yCenter(s1b - 1);
      shape.barres.forEach((b: any) => {
        const s1 = Math.min(b.from, b.to);
        const s2 = Math.max(b.from, b.to);
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
          finger: b.finger ?? (shape as any).barreFinger
        });

        bx(cx - wBarre / 2); bx(cx + wBarre / 2); by(yTopBarre); by(yBotBarre);
      });
    }

    // fret numbers
    fretXs.slice(0, numFrets).forEach((x1, i) => {
      const x2 = fretXs[i + 1];
      const x = (x1 + x2) / 2, y = innerTop - 26;
      bx(x - TEXT_PAD_X); bx(x + TEXT_PAD_X);
      by(y - TEXT_ASCENT); by(y + TEXT_ASCENT);
    });

    if (showName && shape.name) {
      const x = width / 2, y = height - 6;
      bx(x - 60); bx(x + 60); by(y - 16); by(y + 8);
    }

    // ViewBox khít
    const PAD = 6;
    const vbX = Math.max(0, minX - PAD);
    const vbY = Math.max(0, minY - PAD);
    const vbW = Math.min(width - vbX, (maxX - minX) + PAD * 2);
    const vbH = Math.min(height - vbY, (maxY - minY) + PAD * 2);

    // font động
    const stringIndexFont = Math.round(Math.max(12, Math.min(20, cellH * 0.40)));
    const fretNumberFont  = Math.round(Math.max(14, Math.min(22, cellH * 0.44)));

    const isRootOpen = () =>
      !!shape.rootString && shape.frets[shape.rootString - 1] === 0;

    return {
      // layout/grid
      baseFret, N, innerTop, innerBottom, LEFT, RIGHT,
      fretXs, numFrets,
      hasNut, nut1x, nut2x,
      // strings & columns
      stringThickness, stringX1, stringX2, yCenter, yTop, yBot,
      COL_CX_LEFT, COL_CX_MID, COL_CX_NECK, stringsClipX,
      // visuals
      dotR, labelFont, openR, dotYBias, openYBias,
      // helpers
      fretCenterX, isRootOpen,
      // barre
      barreRects,
      // text sizes
      stringIndexFont, fretNumberFont,
      // bbox
      bbox: { x: vbX, y: vbY, w: vbW, h: vbH },
    };
  }, [shape, numStrings, pressBias, showName]);

  const {
    baseFret, innerTop,
    fretXs, numFrets, hasNut, nut1x, nut2x,
    stringX1, stringX2, yCenter, yTop, yBot,
    COL_CX_LEFT, COL_CX_MID, stringsClipX,
    dotR, labelFont, openR, dotYBias, openYBias,
    fretCenterX, isRootOpen,
    barreRects,
    stringIndexFont, fretNumberFont,
    bbox
  } = data;

  return (
    <svg className="chord-svg"
         viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`}
         preserveAspectRatio="xMidYMid meet">
      <defs>
        {/* chỉ strings được phép đi vào cột NECK */}
        <clipPath id={clipId}>
          <rect x={stringsClipX} y={yTop - 20} width={VB_W - stringsClipX} height={(yBot - yTop) + 40} />
        </clipPath>
      </defs>

      {/* 1) PHÍM (background) */}
      {fretXs.map((x, i) => (
        <line key={`fret-${i}`} x1={x} x2={x} y1={yTop} y2={yBot} className="fret-line" />
      ))}
      {/* Nut = 2 vạch fill */}
      {hasNut && (
        <>
          <rect x={nut1x} y={yTop} width={NUT_BAR_W} height={yBot - yTop} className="nut-bar" />
          <rect x={nut2x} y={yTop} width={NUT_BAR_W} height={yBot - yTop} className="nut-bar" />
        </>
      )}

      {/* 2) DÂY (trên phím, dưới dot) – được phép lòi vào khe NECK */}
      <g clipPath={`url(#${clipId})`}>
        {fretXs.length > 0 && Array.from({ length: numFrets > 0 ? (fretXs.length ? (fretXs.length, (fretXs.length)) : 0) : 0 })}
        {Array.from({ length: (numFrets ? numFrets : 0), })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: baseFret ? 1 : 1 })}
        {Array.from({ length: 0 })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: (numFrets ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}

        {Array.from({ length: (numFrets ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}

        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}

        {Array.from({ length: (numFrets ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {Array.from({ length: (fretXs ? 1 : 1) })}
        {/* thực tế chỉ cần vẽ N dây: */}
        {Array.from({ length: shape.frets.length }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={stringX1}
            x2={stringX2}
            y1={yCenter(i)}
            y2={yCenter(i)}
            className="string-line"
            strokeWidth={/* độ dày theo index */ undefined}
          />
        ))}
      </g>

      {/* 3) DOTS (trên dây) */}
      {shape.frets.map((fret, i) => {
        if (fret <= 0) return null;
        const cx = fretCenterX(fret);
        if (cx == null) return null;
        const cy = yCenter(i) - dotYBias(i);
        const isRootHere = shape.rootString === i + 1 && shape.frets[i] > 0;

        return (
          <g key={`dot-${i}`}>
            <circle cx={cx} cy={cy} r={dotR} className="dot" />
            {!!shape.fingers?.[i] && (
              <text x={cx} y={cy} className="dot-label" style={{ fontSize: labelFont }}>
                {shape.fingers[i]}
              </text>
            )}
            {isRootHere && (
              <text x={cx - dotR - 8} y={cy + dotR + clamp((/* thickness proxy */ 1) * 0.2, 0.5, 4)} className="root-inline">R</text>
            )}
          </g>
        );
      })}

      {/* 4) BARRE (trên dây) */}
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

      {/* 5) CỘT TRÁI: MID (số/Open) + LEFT (mute/R) */}
      {shape.frets.map((f, i) => {
        const y = yCenter(i);
        const yOpen = y - openYBias(i);
        const stringNo = i + 1;
        const rootOpenHere = isRootOpen() && shape.rootString === stringNo;

        return (
          <g key={`leftcol-${i}`}>
            {/* MID: số dây */}
            <text x={COL_CX_MID} y={y} className="string-index" style={{ fontSize: stringIndexFont }}>
              {stringNo}
            </text>
            {/* MID: open circle đồng tâm với số → dùng yOpen đã bù lệch theo thickness */}
            {f === 0 && <circle cx={COL_CX_MID} cy={yOpen} r={openR} className="open-marker" />}

            {/* LEFT: mute/R */}
            {f === -1 && <text x={COL_CX_LEFT} y={y} className="mute-marker">×</text>}
            {rootOpenHere && <text x={COL_CX_LEFT} y={y} className="root-left">R</text>}
          </g>
        );
      })}

      {/* 6) SỐ NGĂN */}
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
            {(baseFret) + i}
          </text>
        );
      })}
    </svg>
  );
}
