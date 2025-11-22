/// <reference types="node" />
/**
 * FULL SMuFL sprite builder – optimized for Bravura
 * Coordinate System A (FONT-NATIVE, NOT FLIPPED)
 * - headnote slope đúng
 * - stem direction đúng
 * - flag direction đúng
 * - không mirrored
 * - output metadata đầy đủ như Dorico
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import opentype, { Glyph } from "opentype.js";

//
// CONFIG
//
const FONT_PATH = path.resolve("src/assets/font/Bravura.otf");

const OUT_DIR = path.resolve("src/engraving/sprite");
const OUT_SVG = path.join(OUT_DIR, "sprite.svg");
const OUT_JSON = path.join(OUT_DIR, "tokens.json");

// SMuFL metadata
const SMUFL_DIR = path.resolve("src/assets/smufl");
const GN_PATH = path.join(SMUFL_DIR, "glyphnames.json");
const RANGES_PATH = path.join(SMUFL_DIR, "ranges.json");
const CLASSES_PATH = path.join(SMUFL_DIR, "classes.json");

const REMOTE = {
  glyphnames:
    "https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/glyphnames.json",
  ranges:
    "https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/ranges.json",
  classes:
    "https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/classes.json",
};

const PAD_SP = 0.60;
const PUA_START = 0xe000;
const PUA_END = 0xf8ff;

//
// TYPES
//
type BBoxSp = { x: number; y: number; w: number; h: number };

type Tokens = Record<
  string,
  {
    codepoint: string;
    name: string;
    category?: string;
    bbox_sp: BBoxSp;
    raw_bbox_units: { x1: number; y1: number; x2: number; y2: number };
  }
>;

type GlyphNames = Record<string, { codepoint: string; description?: string }>;
type Ranges = { ranges: Array<{ name: string; range_start: string; range_end: string }> };

//
// HELPERS
//
function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchJSON(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(JSON.parse(data)));
      })
      .on("error", reject);
  });
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function tryLoadJSON<T>(file: string): T | null {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {}
  return null;
}

async function ensureSmuflMetadata() {
  ensureDir(SMUFL_DIR);
  const need: Array<[string, string, string]> = [];

  if (!fs.existsSync(GN_PATH)) need.push(["glyphnames", REMOTE.glyphnames, GN_PATH]);
  if (!fs.existsSync(RANGES_PATH)) need.push(["ranges", REMOTE.ranges, RANGES_PATH]);
  if (!fs.existsSync(CLASSES_PATH)) need.push(["classes", REMOTE.classes, CLASSES_PATH]);

  if (need.length === 0) return;

  console.log("ℹ️ Fetching SMuFL metadata…");

  for (const [label, url, out] of need) {
    process.stdout.write(`  - ${label} … `);
    const data = await fetchJSON(url);
    fs.writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
    console.log("done");
  }
}

function hexU(cp: number) {
  return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}

function codeFromUplus(s: string) {
  return parseInt(s.replace(/^U\+/i, ""), 16);
}

function buildReverseGlyphMap(gn: GlyphNames | null) {
  const rev = new Map<number, string>();
  if (!gn) return rev;

  for (const [name, info] of Object.entries(gn)) {
    const c = codeFromUplus(info.codepoint);
    rev.set(c, name);
  }
  return rev;
}

function findCategoryFor(cp: number, ranges: Ranges | null) {
  if (!ranges) return;
  for (const r of ranges.ranges || [])
    if (cp >= codeFromUplus(r.range_start) && cp <= codeFromUplus(r.range_end))
      return r.name;
}

//
// iterate all glyphs (compat with all opentype.js versions)
//
function eachGlyph(font: any, cb: (g: Glyph) => void) {
  const gs: any = font.glyphs;
  if (!gs) return;

  if (Array.isArray(gs.glyphs)) {
    for (const g of gs.glyphs) cb(g);
    return;
  }
  if (typeof gs.forEach === "function") {
    gs.forEach(cb);
    return;
  }
  if (typeof gs.length === "number" && typeof gs.get === "function") {
    for (let i = 0; i < gs.length; i++) cb(gs.get(i));
    return;
  }

  if (font?.tables?.cmap?.glyphIndexMap) {
    const idx = font.tables.cmap.glyphIndexMap as Record<string, number>;
    const seen = new Set<number>();
    for (const key of Object.keys(idx)) {
      const gi = idx[key];
      if (!seen.has(gi)) {
        seen.add(gi);
        cb(font.glyphs.get(gi));
      }
    }
    return;
  }

  throw new Error("Unsupported font glyph container");
}

//
// MAIN
//
(async () => {
  await ensureSmuflMetadata();

  const font = await opentype.load(FONT_PATH);
  const UPEM = font.unitsPerEm;

  console.log(`🔤 Loaded Bravura (UPEM = ${UPEM})`);

  const glyphnames = tryLoadJSON<GlyphNames>(GN_PATH);
  const rangesDB = tryLoadJSON<Ranges>(RANGES_PATH);
  const revNames = buildReverseGlyphMap(glyphnames);

  const symbols: string[] = [];
  const tokens: Tokens = {};

  eachGlyph(font, (g) => {
    const cp = (g as any).unicode;
    if (typeof cp !== "number" || cp < PUA_START || cp > PUA_END) return;

    const smufl = revNames.get(cp);
    const name = smufl ?? "u" + hexU(cp).slice(2);
    const id = smufl ?? "u" + cp.toString(16).toUpperCase();
    const category = findCategoryFor(cp, rangesDB);

    // extract path
    const pathObj = g.getPath(0, 0, UPEM);
    const d =
      typeof (pathObj as any).toPathData === "function"
        ? (pathObj as any).toPathData(3)
        : pathObj.commands
            .map((c: any) => {
              const f = (v: number) => Number(v.toFixed(3));
              switch (c.type) {
                case "M": return `M${f(c.x)} ${f(c.y)}`;
                case "L": return `L${f(c.x)} ${f(c.y)}`;
                case "C": return `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`;
                case "Q": return `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`;
                case "Z": return "Z";
                default: return "";
              }
            })
            .join("");

    const pb = pathObj.getBoundingBox();
    const { x1, y1, x2, y2 } = pb;

    const wSp = (x2 - x1) / UPEM;
    const hSp = (y2 - y1) / UPEM;
    const vbW = wSp + PAD_SP * 2;
    const vbH = hSp + PAD_SP * 2;

    // transform — HỆ A (FONT NATIVE)
    const scaleSp = 1 / UPEM;
    const transform =
      `translate(${PAD_SP}, ${PAD_SP}) ` +
      `scale(${scaleSp}, ${scaleSp}) ` +
      `translate(${-x1}, ${-y1})`;

    symbols.push(
      `<symbol id="${id}" viewBox="0 0 ${vbW} ${vbH}" overflow="visible" data-name="${name}"${
        category ? ` data-category="${category}"` : ""
      }>
  <g transform="${transform}">
    <path d="${d}" />
  </g>
</symbol>`
    );

    tokens[id] = {
      codepoint: hexU(cp),
      name,
      category,
      bbox_sp: { x: 0, y: 0, w: vbW, h: vbH },
      raw_bbox_units: { x1, y1, x2, y2 },
    };
  });

  ensureDir(OUT_DIR);
  fs.writeFileSync(
    OUT_SVG,
    "<?xml version='1.0' encoding='UTF-8'?>\n<svg xmlns='http://www.w3.org/2000/svg' style='display:none'>\n" +
      symbols.join("\n") +
      "\n</svg>",
    "utf8"
  );
  fs.writeFileSync(OUT_JSON, JSON.stringify(tokens, null, 2), "utf8");

  console.log(`✅ Built sprite with ${symbols.length} glyphs`);
  console.log(`📄 tokens.json generated`);
})();
