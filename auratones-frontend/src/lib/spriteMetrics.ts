// src/lib/spriteMetrics.ts
// Tính toán thêm về kích thước glyph dựa trên tokens: UPEM, padding, path size, dot gap.

import { TOKENS } from "../lib/sprite";

export function getSpriteMetrics(id: string) {
  const t = TOKENS[id];
  if (!t) {
    throw new Error(`[spriteMetrics] Missing token for id '${id}'`);
  }

  const bw = t.bbox_sp.w;
  const bh = t.bbox_sp.h;
  const ruW = t.raw_bbox_units.x2 - t.raw_bbox_units.x1;
  const ruH = t.raw_bbox_units.y2 - t.raw_bbox_units.y1;

  // Giải hệ để suy ra UPEM & padding:
  // bw = ruW/U + 2p ;  bh = ruH/U + 2p
  const UPEM = (ruW - ruH) / (bw - bh);
  const padSp = (bw - ruW / UPEM) / 2;

  const pathWSp = ruW / UPEM;
  const pathHSp = ruH / UPEM;

  return {
    UPEM,
    padSp,
    pathWSp,
    pathHSp,
    boxWSp: bw,
    boxHSp: bh,
    token: t,
  };
}

/**
 * Tính khoảng cách trong đơn vị staff-space giữa mép phải path notehead và anchor dot.
 * Nếu thiếu anchor, trả về 0.
 */
export function getDotGapSp(id = "noteheadBlack", anchorName = "dot") {
  const { padSp, pathWSp, token } = getSpriteMetrics(id);
  const a = token.anchors?.[anchorName];
  if (!a) return 0;

  const rightEdgeX = padSp + pathWSp;
  const gapSp = a.xSp - rightEdgeX;
  return gapSp;
}
