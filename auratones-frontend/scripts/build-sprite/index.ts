// scripts/buildSprite.ts
// Generate sprite.svg + tokens.json from SMuFL font. Fixes notehead slant by flipping both axes.

/// <reference types="node" />
import * as fs from "fs";
import * as path from "path";
import opentype from "opentype.js";

const FONT_PATH = path.resolve("src/assets/font/Leland.otf");
const OUT_SVG   = path.resolve("src/assets/sprite/sprite.svg");
const OUT_JSON  = path.resolve("src/assets/sprite/tokens.json");

// SMuFL glyphs used by UI (extendable)
const GLYPHS: Record<string, number> = {
  noteheadBlack:     0xE0A4,

  // Metronome-mark notes for toolbar/tempo display
  metNoteHalfUp:     0xECA3, // ← ADDED
  metNoteQuarterUp:  0xECA5,
  metNote8thUp:      0xECA7,

  // Augmentation dot
  metAugDot:         0xECB7,
};

// Optional presets (sp)
const PRESET_ANCHORS: Record<string, any> = {
  noteheadBlack: {
    stemUp:   { x: 3.4,  y: 2.8 },
    stemDown: { x: -0.6, y: 2.2 },
    dot:      { x: 6.8,  y: 3.4 }, // may be overwritten below
  },
};

// Units & padding. 1sp = 1em (font units)
const PAD_SP = 0.6;

(async () => {
  const font = await opentype.load(FONT_PATH);
  const UPEM = font.unitsPerEm;

  const symbols: string[] = [];
  const tokens: Record<string, any> = {};

  for (const [name, code] of Object.entries(GLYPHS)) {
    const glyph = font.charToGlyph(String.fromCodePoint(code));
    const pathObj = glyph.getPath(0, 0, UPEM);
    const d = pathObj.toPathData(3);

    // bbox in font units (y-up)
    const pb = pathObj.getBoundingBox();
    const { x1, y1, x2, y2 } = pb;
    const wUnits = x2 - x1;
    const hUnits = y2 - y1;

    // to sp
    const toSp = (v: number) => v / UPEM;
    const wSp = toSp(wUnits);
    const hSp = toSp(hUnits);

    // viewBox with padding (sp)
    const vbW = wSp + PAD_SP * 2;
    const vbH = hSp + PAD_SP * 2;

    const scaleSp = 1 / UPEM;

    // Anchors (local copy)
    const anchors = { ...(PRESET_ANCHORS[name] || {}) };

    if (name === "noteheadBlack") {
      // center anchor for placing by center
      const centerX = PAD_SP + wSp / 2;
      const centerY = PAD_SP + hSp / 2;
      anchors.center = { x: centerX, y: centerY };

      // dot anchor: right side + optical gap
      const GAP_SP = 0.65;
      const dotX = PAD_SP + wSp + GAP_SP;
      const dotY = PAD_SP + hSp * 0.52;
      anchors.dot = { x: dotX, y: dotY };
    }

    // Flip both axes; translate to bottom-right padded corner
    const gTransform =
      `translate(${PAD_SP + wSp}, ${PAD_SP + hSp}) ` +
      `scale(${-scaleSp}, ${-scaleSp}) ` +
      `translate(${-x1}, ${-y1})`;

    symbols.push(
      `<symbol id="${name}" viewBox="0 0 ${vbW} ${vbH}" overflow="visible" data-anchors='${JSON.stringify(anchors)}'>
  <g transform="${gTransform}">
    <path d="${d}" />
  </g>
</symbol>`.trim()
    );

    tokens[name] = {
      codepoint: `U+${code.toString(16).toUpperCase()}`,
      anchors,
      bbox_sp: { x: 0, y: 0, w: vbW, h: vbH },
      raw_bbox_units: { x1, y1, x2, y2 },
    };
  }

  // Sprite document
  const sprite = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     style="display:none">
${symbols.join("\n")}
</svg>`;

  fs.mkdirSync(path.dirname(OUT_SVG), { recursive: true });
  fs.writeFileSync(OUT_SVG, sprite, "utf8");
  fs.writeFileSync(OUT_JSON, JSON.stringify(tokens, null, 2), "utf8");
  console.log("✅ Built sprite.svg + tokens.json");
})();
