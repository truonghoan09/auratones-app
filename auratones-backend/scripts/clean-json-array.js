#!/usr/bin/env node
/**
 * Clean a possibly-dirty JSON array file (BOM, UTF-16, comments, stray logs, trailing commas).
 * Usage:
 *   node scripts/clean-json-array.js in.json out.clean.json
 */
const fs = require("fs");
const { TextDecoder } = require("util");

if (process.argv.length < 4) {
  console.error("Usage: node scripts/clean-json-array.js <in> <out>");
  process.exit(1);
}

const inPath = process.argv[2];
const outPath = process.argv[3];

const buf = fs.readFileSync(inPath);

// 1) Decode with best-effort (UTF-8 or UTF-16 LE/BE)
let src;
if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
  // UTF-16 LE BOM
  src = new TextDecoder("utf-16le").decode(buf);
} else if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
  // UTF-16 BE BOM
  src = new TextDecoder("utf-16be").decode(buf);
} else {
  // assume utf-8
  src = buf.toString("utf8");
}

// 2) strip BOM char if any
if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1);

// 3) remove comments (// and /* */) outside of strings — naive but works for our generator
src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n\r]*/g, "$1");

// 4) extract JSON array between first '[' and last ']'
const first = src.indexOf("[");
const last = src.lastIndexOf("]");
if (first === -1 || last === -1 || last <= first) {
  console.error("Cannot locate a JSON array (no matching [ ... ])");
  process.exit(1);
}
let arrText = src.slice(first, last + 1);

// 5) remove trailing commas (", }" or ", ]")
arrText = arrText.replace(/,\s*(\]|\})/g, "$1");

// 6) validate parse
let json;
try {
  json = JSON.parse(arrText);
  if (!Array.isArray(json)) {
    console.error("Top-level is not an array after cleaning.");
    process.exit(1);
  }
} catch (e) {
  console.error("Still invalid after cleaning:", e.message);
  // dump head/tail for debugging
  console.error("HEAD:", arrText.slice(0, 200));
  console.error("TAIL:", arrText.slice(-200));
  process.exit(1);
}

// 7) write pretty, UTF-8 no BOM
fs.writeFileSync(outPath, JSON.stringify(json, null, 2), { encoding: "utf8" });
console.log(`[OK] Wrote clean JSON → ${outPath} (${json.length} items)`);
