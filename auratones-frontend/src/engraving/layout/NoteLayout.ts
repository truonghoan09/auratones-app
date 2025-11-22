// src/engraving/layout/NoteLayout.ts
// Build 1 note (notehead + stem + flag + dot) using anchors.json

import anchorsRaw from "../sprite/anchors.json";
import metrics from "../sprite/metrics.json";
import { getBoxSp } from "../../lib/sprite";

const anchors: Record<
  string,
  Record<string, { xSp: number; ySp: number }>
> = anchorsRaw as any;

export type NoteShape =
  | "quarter"
  | "eighth"
  | "16th"
  | "32nd"
  | "half"
  | "whole";

export interface NoteLayoutResult {
  components: Array<{
    id: string; // glyph ID in sprite
    x: number;  // px (top-left trong viewBox glyph)
    y: number;  // px
    scale: number;
  }>;
}

const SP = metrics.staffSpacePx; // 20px

// ------------------------
// GLYPH TABLE
// ------------------------
const HEAD_MAP: Record<NoteShape, string> = {
  quarter: "noteheadBlack",
  eighth: "noteheadBlack",
  ["16th"]: "noteheadBlack",
  ["32nd"]: "noteheadBlack",
  half: "noteheadHalf",
  whole: "noteheadWhole",
};

const FLAG_UP: Record<NoteShape, string | null> = {
  quarter: null,
  eighth: "flag8thUp",
  ["16th"]: "flag16thUp",
  ["32nd"]: "flag32ndUp",
  half: null,
  whole: null,
};

const FLAG_DOWN: Record<NoteShape, string | null> = {
  quarter: null,
  eighth: "flag8thDown",
  ["16th"]: "flag16thDown",
  ["32nd"]: "flag32ndDown",
  half: null,
  whole: null,
};

// Dorico-style: dưới giữa → up, trên giữa → down
export function autoStemDirectionByY(
  cyPx: number,
  staffTopPx: number
): "up" | "down" {
  const lineIndex = (cyPx - staffTopPx) / SP; // 0 = top line
  return lineIndex >= 2 ? "down" : "up";
}

// ------------------------------------------------------------
// MAIN: đặt nốt theo tâm head (cx, cy)
// ------------------------------------------------------------
export function layoutNoteAtCenter(
  cxPx: number,
  cyPx: number,
  shape: NoteShape,
  dotted: boolean = false
): NoteLayoutResult {
  const comps: NoteLayoutResult["components"] = [];

  // --------------------------
  // 1. HEAD
  // --------------------------
  const headId = HEAD_MAP[shape];
  const headAnch = anchors[headId];
  if (!headAnch?.center) {
    throw new Error(`Missing center anchor for ${headId}`);
  }

  const headCenter = headAnch.center;

  // head top-left từ anchor center (anchors ở hệ bbox: 0→w,0→h)
  const headTopLeftX = cxPx - headCenter.xSp * SP;
  const headTopLeftY = cyPx - headCenter.ySp * SP;

  comps.push({
    id: headId,
    x: headTopLeftX,
    y: headTopLeftY,
    scale: 1,
  });

  // --------------------------
  // 2. STEM
  // --------------------------
  const stemDir: "up" | "down" = autoStemDirectionByY(cyPx, 0);

  const stemAnchorName = stemDir === "up" ? "stemUpNW" : "stemDownSE";
  const stemAnchorOnHead = headAnch[stemAnchorName];

  const stemBoxSp = getBoxSp("stem");
  const stemWpx = stemBoxSp.w * SP;
  const stemHpx = stemBoxSp.h * SP;

  let stemX = 0;
  let stemY = 0;
  let stemTopX = 0;
  let stemTopY = 0;
  let stemBottomX = 0;
  let stemBottomY = 0;

  if (shape !== "whole") {
    if (!stemAnchorOnHead) {
      console.warn(`Missing stem anchor ${stemAnchorName} for ${headId}`);
    }

    // *** Quan trọng: hiểu anchor là TOP-LEFT của stem ***
    if (stemAnchorOnHead) {
      stemX = headTopLeftX + stemAnchorOnHead.xSp * SP;
      stemY = headTopLeftY + stemAnchorOnHead.ySp * SP;
    } else {
      // fallback: đặt bằng center
      stemX = cxPx;
      stemY = cyPx;
    }

    // top / bottom của stem
    stemTopX = stemX + stemWpx / 2;
    stemTopY = stemY;
    stemBottomX = stemTopX;
    stemBottomY = stemY + stemHpx;

    comps.push({
      id: "stem",
      x: stemX,
      y: stemY,
      scale: 1,
    });

    // --------------------------
    // 3. FLAG
    // --------------------------
    const flagId =
      stemDir === "up" ? FLAG_UP[shape] : FLAG_DOWN[shape];

    if (flagId) {
      const flagBoxSp = getBoxSp(flagId);
      const flagWpx = flagBoxSp.w * SP;
      const flagHpx = flagBoxSp.h * SP;

      let flagX: number;
      let flagY: number;

      if (stemDir === "down") {
        // Down-stem: gắn flag tại bottom-right của stem,
        // coi điểm đó là top-left của flag
        const stemTipX = stemX + stemWpx; // right edge
        const stemTipY = stemBottomY;     // bottom

        flagX = stemTipX;
        // kéo flag hơi lên một chút để ăn khớp với nét (tùy font có thể chỉnh 0.1–0.2 SP)
        const fudgeDownY = 0.1 * SP;
        flagY = stemTipY - fudgeDownY;
      } else {
        // Up-stem: gắn flag tại top-right của stem,
        // coi điểm đó là bottom-left của flag
        const stemTipX = stemX + stemWpx; // right edge
        const stemTipY = stemTopY;        // top

        flagX = stemTipX;
        // ở đây dùng anchor coi stemTip là bottom-left → trừ height
        const fudgeUpY = 0.1 * SP;
        flagY = stemTipY - flagHpx + fudgeUpY;
      }

      comps.push({
        id: flagId,
        x: flagX,
        y: flagY,
        scale: 1,
      });
    }
  }

  // --------------------------
  // 4. DOT
  // --------------------------
  if (dotted && headAnch.dotSE) {
    const dA = headAnch.dotSE;

    // Ở font của bạn dotSE rõ ràng đang là top-left của dot,
    // nên chỉ cần cộng trực tiếp như thế này là đúng:
    const dotX = headTopLeftX + dA.xSp * SP;
    const dotY = headTopLeftY + dA.ySp * SP;

    comps.push({
      id: "augmentationDot",
      x: dotX,
      y: dotY,
      scale: 1,
    });
  }

  return { components: comps };
}
