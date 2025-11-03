// src/lib/sprite.ts
export type SpriteBBoxSp = { x: number; y: number; w: number; h: number };
export type Anchors = Record<string, { x: number; y: number }>;

export type Token = {
  codepoint: string;
  name: string;
  bbox_sp: SpriteBBoxSp;
  raw_bbox_units: { x1: number; y1: number; x2: number; y2: number };
  anchors?: Anchors; // optional
};

export type Tokens = Record<string, Token>;

// tokens.json được tạo không có anchors -> cast safe
import tokensRaw from "../assets/sprite/tokens.json";
export const TOKENS = tokensRaw as unknown as Tokens;

export function getBoxSp(id: string): SpriteBBoxSp {
  const t = TOKENS[id];
  if (!t) throw new Error(`Unknown glyph id: ${id}`);
  return t.bbox_sp;
}

/** Lấy tâm bbox (fallback center) */
export function getCenterSp(id: string) {
  const b = getBoxSp(id);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Có anchors không */
export function hasAnchors(id: string): boolean {
  const t = TOKENS[id];
  return !!(t && t.anchors && Object.keys(t.anchors).length > 0);
}

/** Lấy anchor an toàn: có thì trả, không thì fallback về center/0/custom */
export function getAnchorSpSafe(
  id: string,
  anchorName: string,
  fallback: "center" | "zero" | { x: number; y: number } = "center"
) {
  const t = TOKENS[id];
  if (!t) throw new Error(`Unknown glyph id: ${id}`);

  const a = t.anchors?.[anchorName];
  if (a) return a;

  if (fallback === "center") return getCenterSp(id);
  if (fallback === "zero") return { x: 0, y: 0 };
  return fallback; // custom
}
