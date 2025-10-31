// src/lib/sprite.ts
export type SpriteBBoxSp = { x: number; y: number; w: number; h: number };
export type Anchors = Record<string, { x: number; y: number }>;

export type Token = {
  codepoint: string;
  anchors: Anchors;
  bbox_sp: SpriteBBoxSp;
  raw_bbox_units: { x1: number; y1: number; x2: number; y2: number };
};

export type Tokens = Record<string, Token>;

// Vite cho phép import JSON trực tiếp
import tokensRaw from '../assets/sprite/tokens.json';

export const TOKENS = tokensRaw as Tokens;

/** Lấy kích thước viewBox (đơn vị sp) của một symbol */
export function getBoxSp(id: string): SpriteBBoxSp {
  const t = TOKENS[id];
  if (!t) throw new Error(`Unknown glyph id: ${id}`);
  return t.bbox_sp;
}

/** Lấy toạ độ anchor (đơn vị sp) nếu có */
export function getAnchorSp(id: string, anchorName: string) {
  const t = TOKENS[id];
  if (!t) throw new Error(`Unknown glyph id: ${id}`);
  const a = t.anchors?.[anchorName];
  if (!a) throw new Error(`Missing anchor "${anchorName}" on ${id}`);
  return a; // {x,y} trong hệ sp của symbol
}
