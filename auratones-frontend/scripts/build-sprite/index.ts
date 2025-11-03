// scripts/build-sprite/index.ts
// Build a FULL SMuFL sprite from the font (e.g., Leland.otf).
// - Downloads glyphnames.json, ranges.json, classes.json automatically if missing
// - Iterates all PUA glyphs (U+E000–U+F8FF)
// - Emits: src/assets/sprite/sprite.svg + src/assets/sprite/tokens.json
// - Each <symbol> includes data-name, optional data-category (from ranges)
// - Coordinates are flipped to screen-friendly (y-down).

/// <reference types="node" />
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import opentype, { Glyph } from "opentype.js";

const FONT_PATH = path.resolve("src/assets/font/Leland.otf");
const OUT_SVG   = path.resolve("src/assets/sprite/sprite.svg");
const OUT_JSON  = path.resolve("src/assets/sprite/tokens.json");

const SMUFL_DIR       = path.resolve("src/assets/smufl");
const GN_PATH         = path.join(SMUFL_DIR, "glyphnames.json");
const RANGES_PATH     = path.join(SMUFL_DIR, "ranges.json");
const CLASSES_PATH    = path.join(SMUFL_DIR, "classes.json");

// Official SMuFL metadata (gh-pages)
const REMOTE = {
  glyphnames: "https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/glyphnames.json",
  ranges:     "https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/ranges.json",
  classes:    "https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/classes.json"
};

// Padding (in staff spaces)
const PAD_SP = 0.6;
const PUA_START = 0xE000;
const PUA_END   = 0xF8FF;

type BBox = { x: number; y: number; w: number; h: number };
type Tokens = Record<string, {
  codepoint: string;
  name: string;
  category?: string;
  bbox_sp: BBox;
  raw_bbox_units: { x1:number, y1:number, x2:number, y2:number };
}>;

type GlyphNames = Record<string, { codepoint: string; description?: string }>;
type Ranges = { ranges: Array<{ name: string; range_start: string; range_end: string }> };

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJSON(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
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
  const need: Array<["glyphnames"|"ranges"|"classes", string, string]> = [];
  if (!fs.existsSync(GN_PATH))      need.push(["glyphnames", REMOTE.glyphnames, GN_PATH]);
  if (!fs.existsSync(RANGES_PATH))  need.push(["ranges",     REMOTE.ranges,     RANGES_PATH]);
  if (!fs.existsSync(CLASSES_PATH)) need.push(["classes",    REMOTE.classes,    CLASSES_PATH]);

  if (need.length === 0) return;

  console.log("ℹ️  Fetching SMuFL metadata…");
  for (const [label, url, out] of need) {
    process.stdout.write(`   - ${label} … `);
    const json = await fetchJSON(url);
    fs.writeFileSync(out, JSON.stringify(json, null, 2), "utf8");
    console.log("done");
  }
  console.log("✅ SMuFL metadata ready.");
}

function hexU(cp: number) { return "U+" + cp.toString(16).toUpperCase().padStart(4, "0"); }
function codeFromUplus(s: string) { return parseInt(s.replace(/^U\+/i, ""), 16); }

function buildReverseGlyphMap(gn: GlyphNames | null) {
  const rev = new Map<number, string>();
  if (!gn) return rev;
  for (const [name, info] of Object.entries(gn)) {
    const c = codeFromUplus(info.codepoint);
    rev.set(c, name);
  }
  return rev;
}

function findCategoryFor(cp: number, ranges: Ranges | null): string | undefined {
  if (!ranges) return;
  for (const r of ranges.ranges || []) {
    const start = codeFromUplus(r.range_start);
    const end   = codeFromUplus(r.range_end);
    if (cp >= start && cp <= end) return r.name;
  }
}

function eachGlyph(font: any, cb: (g: Glyph) => void) {
  const gs: any = font.glyphs;
  if (!gs) return;

  if (Array.isArray(gs.glyphs)) { for (const g of gs.glyphs) cb(g); return; }
  if (typeof gs.forEach === "function") { gs.forEach((g: Glyph) => cb(g)); return; }
  if (typeof gs.length === "number" && typeof gs.get === "function") {
    for (let i = 0; i < gs.length; i++) cb(gs.get(i));
    return;
  }

  // fallback via cmap
  if (font?.tables?.cmap?.glyphIndexMap) {
    const idxMap = font.tables.cmap.glyphIndexMap as Record<string, number>;
    const seen = new Set<number>();
    for (const k of Object.keys(idxMap)) {
      const gi = idxMap[k];
      if (seen.has(gi)) continue;
      seen.add(gi);
      const g = font.glyphs.get(gi);
      if (g) cb(g);
    }
    return;
  }

  throw new Error("Unsupported opentype.js glyphs container (cannot iterate).");
}

(async () => {
  await ensureSmuflMetadata();

  const font = await opentype.load(FONT_PATH);
  const UPEM = font.unitsPerEm;

  const glyphnames = tryLoadJSON<GlyphNames>(GN_PATH);
  const rangesDB   = tryLoadJSON<Ranges>(RANGES_PATH);
  const revNames   = buildReverseGlyphMap(glyphnames);

  const symbols: string[] = [];
  const tokens: Tokens = {};

  eachGlyph(font, (g) => {
    const cp = (g as any).unicode as number | undefined;
    if (typeof cp !== "number" || cp < PUA_START || cp > PUA_END) return;

    const smuflName = revNames.get(cp);
    const displayName = smuflName ?? ("u" + hexU(cp).slice(2));
    const symbolId = smuflName ?? ("u" + cp.toString(16).toUpperCase());
    const category = findCategoryFor(cp, rangesDB);

    const pathObj = g.getPath(0, 0, UPEM);
    const d = typeof (pathObj as any).toPathData === "function"
      ? (pathObj as any).toPathData(3)
      : pathObj.commands.map((c: any) => {
          const up = (p:number)=>Number(p.toFixed(3));
          switch (c.type) {
            case "M": return `M${up(c.x)} ${up(c.y)}`;
            case "L": return `L${up(c.x)} ${up(c.y)}`;
            case "C": return `C${up(c.x1)} ${up(c.y1)} ${up(c.x2)} ${up(c.y2)} ${up(c.x)} ${up(c.y)}`;
            case "Q": return `Q${up(c.x1)} ${up(c.y1)} ${up(c.x)} ${up(c.y)}`;
            case "Z": return "Z";
            default:  return "";
          }
        }).join("");

    const pb = pathObj.getBoundingBox();
    const { x1, y1, x2, y2 } = pb;
    const wSp = (x2 - x1) / UPEM;
    const hSp = (y2 - y1) / UPEM;
    const vbW = wSp + PAD_SP * 2;
    const vbH = hSp + PAD_SP * 2;

    const scaleSp = 1 / UPEM;
    const gTransform =
      `translate(${PAD_SP + wSp}, ${PAD_SP + hSp}) ` +
      `scale(${-scaleSp}, ${-scaleSp}) ` +
      `translate(${-x1}, ${-y1})`;

    symbols.push(
      `<symbol id="${symbolId}" viewBox="0 0 ${vbW} ${vbH}" overflow="visible" data-name="${displayName}"` +
      (category ? ` data-category="${category}"` : ``) +
      `>
  <g transform="${gTransform}">
    <path d="${d}" />
  </g>
</symbol>`
    );

    tokens[symbolId] = {
      codepoint: hexU(cp),
      name: displayName,
      category,
      bbox_sp: { x: 0, y: 0, w: vbW, h: vbH },
      raw_bbox_units: { x1, y1, x2, y2 },
    };
  });

  const sprite = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     style="display:none">
${symbols.join("\n")}
</svg>`;

  fs.mkdirSync(path.dirname(OUT_SVG), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_SVG, sprite, "utf8");
  fs.writeFileSync(OUT_JSON, JSON.stringify(tokens, null, 2), "utf8");

  console.log(`✅ Built sprite.svg (${symbols.length} symbols) + tokens.json`);
  console.log(`📦 SMuFL JSON: ${GN_PATH}, ${RANGES_PATH}, ${CLASSES_PATH}`);
})().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
