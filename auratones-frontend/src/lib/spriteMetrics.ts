// spriteMetrics.ts
import { TOKENS } from "../lib/sprite";

export function getSpriteMetrics(id: string) {
  const t = TOKENS[id];
  const bw = t.bbox_sp.w, bh = t.bbox_sp.h;           // viewBox (đã có padding), đơn vị sp
  const ruW = t.raw_bbox_units.x2 - t.raw_bbox_units.x1; // path width (font units)
  const ruH = t.raw_bbox_units.y2 - t.raw_bbox_units.y1; // path height (font units)

  // Giải hệ để suy ra UPEM & padding (không cần biết trước):
  // bw = ruW/U + 2p ;  bh = ruH/U + 2p
  const UPEM = (ruW - ruH) / (bw - bh);               // ví dụ Leland → ~1000
  const padSp = (bw - ruW / UPEM) / 2;

  const pathWSp = ruW / UPEM;
  const pathHSp = ruH / UPEM;

  return { UPEM, padSp, pathWSp, pathHSp, boxWSp: bw, boxHSp: bh, token: t };
}

// spriteMetrics.ts (thêm helper)
export function getDotGapSp(id = "noteheadBlack", anchorName = "dot") {
  const { padSp, pathWSp, token } = getSpriteMetrics(id);
  const a = token.anchors[anchorName];                // toạ độ đã có padding
  const rightEdgeX = padSp + pathWSp;                 // mép phải path (đã pad)
  const gapSp = a.x - rightEdgeX;                     // GAP_SP trong sprite
  return gapSp;
}
