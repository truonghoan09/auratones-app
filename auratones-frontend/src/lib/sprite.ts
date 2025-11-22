// src/lib/sprite.ts
// Helper đọc metadata từ sprite/tokens.json: bbox_sp + anchors (nếu có).

import tokensJson from "../engraving/sprite/tokens.json";

export type BoxSp = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type RawBBoxUnits = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type AnchorEntry = {
  xSp: number;
  ySp: number;
};

type TokenEntry = {
  bbox_sp: BoxSp;
  raw_bbox_units: RawBBoxUnits;
  anchors?: Record<string, AnchorEntry>;
};

type TokensFile = Record<string, TokenEntry>;

/** Toàn bộ tokens từ build-sprite (dùng chung cho bbox, anchors, metrics). */
export const TOKENS = tokensJson as TokensFile;

/**
 * Trả về bounding box theo đơn vị staff-space (bbox_sp) cho glyph id.
 */
export function getBoxSp(id: string): BoxSp {
  const t = TOKENS[id];
  if (t && t.bbox_sp) return t.bbox_sp;
  return { x: 0, y: 0, w: 1, h: 1 };
}

/**
 * Trả về anchor theo đơn vị staff-space.
 * - Nếu tokens.json có anchors[id][anchorName] thì dùng xSp/ySp.
 * - Nếu không có:
 *    + anchor "center": dùng tâm bbox_sp.
 *    + anchor khác: fallback (0,0).
 */
export function getAnchorSp(
  id: string,
  anchorName: string
): { x: number; y: number } {
  const t = TOKENS[id];
  const a = t?.anchors?.[anchorName];
  if (a) {
    return { x: a.xSp, y: a.ySp };
  }

  if (anchorName === "center") {
    const box = getBoxSp(id);
    return { x: box.w / 2, y: box.h / 2 };
  }

  return { x: 0, y: 0 };
}

/**
 * Phiên bản an toàn:
 * - Thử anchorName trước.
 * - Nếu không có, thử fallbackName.
 * - Nếu fallbackName = "center" và không có anchors, dùng tâm bbox_sp.
 * - Nếu vẫn không có: trả (0,0).
 */
export function getAnchorSpSafe(
  id: string,
  anchorName: string,
  fallbackName: string = "center"
): { x: number; y: number } {
  const t = TOKENS[id];

  const a = t?.anchors?.[anchorName];
  if (a) {
    return { x: a.xSp, y: a.ySp };
  }

  if (fallbackName) {
    const fb = t?.anchors?.[fallbackName];
    if (fb) {
      return { x: fb.xSp, y: fb.ySp };
    }
    if (fallbackName === "center") {
      const box = getBoxSp(id);
      return { x: box.w / 2, y: box.h / 2 };
    }
  }

  if (anchorName === "center") {
    const box = getBoxSp(id);
    return { x: box.w / 2, y: box.h / 2 };
  }

  return { x: 0, y: 0 };
}
