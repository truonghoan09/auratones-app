// scripts/build-anchors/index.ts
/// <reference types="node" />
import * as fs from "fs";
import * as path from "path";

const SPRITE_DIR   = path.resolve("src/engraving/sprite");
const TOKENS_PATH  = path.join(SPRITE_DIR, "tokens.json");
const ANCHORS_PATH = path.join(SPRITE_DIR, "anchors.json");
const METRICS_PATH = path.join(SPRITE_DIR, "metrics.json");

// Phải khớp với build-sprite nếu bạn có padding riêng
const PAD_SP = 0.6;
const DEFAULT_STAFF_SPACE_PX = 20;

type TokenEntry = {
  codepoint: string;
  name: string;
  category?: string;
  bbox_sp: { x: number; y: number; w: number; h: number };
  raw_bbox_units: { x1: number; y1: number; x2: number; y2: number };
};
type Tokens = Record<string, TokenEntry>;

type Anchor  = { xSp: number; ySp: number };
type AnchorMap   = Record<string, Anchor>;
type AnchorsJSON = Record<string, AnchorMap>;

function loadTokens(): Tokens {
  const raw = fs.readFileSync(TOKENS_PATH, "utf8");
  return JSON.parse(raw) as Tokens;
}

function inferMetricsFromToken(t: TokenEntry) {
  const bw  = t.bbox_sp.w;
  const bh  = t.bbox_sp.h;
  const ruW = t.raw_bbox_units.x2 - t.raw_bbox_units.x1;
  const ruH = t.raw_bbox_units.y2 - t.raw_bbox_units.y1;

  if (Math.abs(bw - bh) < 1e-6 || Math.abs(ruW - ruH) < 1e-3) {
    return { upem: 1000, padSp: PAD_SP };
  }

  const upem  = (ruW - ruH) / (bw - bh);
  const padSp = (bw - ruW / upem) / 2;

  if (!isFinite(upem) || upem <= 0) {
    return { upem: 1000, padSp: PAD_SP };
  }

  return { upem, padSp };
}

function makeCenterAnchor(t: TokenEntry): Anchor {
  const { w, h } = t.bbox_sp;
  return { xSp: w / 2, ySp: h / 2 };
}

function makeNoteheadAnchors(t: TokenEntry): AnchorMap {
  const a: AnchorMap = {};
  const { w, h } = t.bbox_sp;

  const left   = 0;
  const right  = w;
  const top    = 0;
  const bottom = h;

  a.center = makeCenterAnchor(t);

  a.stemUpNW = {
    xSp: left + w * 0.18,
    ySp: top + h * 0.25,
  };

  a.stemDownSE = {
    xSp: right - w * 0.18,
    ySp: bottom - h * 0.25,
  };

  a.dotSE = {
    xSp: right + 0.35,
    ySp: top + h * 0.5,
  };

  return a;
}

function makeDefaultAnchors(t: TokenEntry): AnchorMap {
  return { center: makeCenterAnchor(t) };
}

(function main() {
  console.log("🔧 Building anchors.json + metrics.json from tokens.json …");

  if (!fs.existsSync(TOKENS_PATH)) {
    throw new Error(`tokens.json not found at ${TOKENS_PATH}. Run build-sprite first.`);
  }

  const tokens  = loadTokens();
  const anchors: AnchorsJSON = {};

  const firstKey   = Object.keys(tokens)[0];
  const firstEntry = tokens[firstKey];
  const { upem, padSp } = inferMetricsFromToken(firstEntry);

  for (const [id, t] of Object.entries(tokens)) {
    const name = t.name || "";

    if (name.startsWith("notehead")) {
      anchors[id] = makeNoteheadAnchors(t);
    } else {
      anchors[id] = makeDefaultAnchors(t);
    }
  }

  fs.mkdirSync(SPRITE_DIR, { recursive: true });
  fs.writeFileSync(ANCHORS_PATH, JSON.stringify(anchors, null, 2), "utf8");

  const metrics = {
    staffSpacePx: DEFAULT_STAFF_SPACE_PX,
    padSp,
    upem,
  };
  fs.writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2), "utf8");

  console.log(`✅ anchors.json written to ${ANCHORS_PATH}`);
  console.log(`✅ metrics.json written to ${METRICS_PATH}`);
})();
