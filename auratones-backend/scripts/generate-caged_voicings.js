#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * CAGED Voicing Generator (Guitar, E/A-shape)
 * - Covers many qualities (triads, 7ths, extensions, common altered dom).
 * - Validates theory (interval-set), playability (span, high fret, barre),
 * - Generates common slash inversions (3rd/5th, plus b7 for dom & minor 7),
 * - Dedups & caps ~40 per root (balanced).
 *
 * Output: array<ChordEntry> for instrument "guitar".
 *
 * Run:
 *   node scripts/generate-caged_voicings.js > out/guitar_caged_seed.json
 */

/* ================= Pitch helpers ================= */
const SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const PC = (x) => ((x % 12) + 12) % 12;

function labelToPc(label) {
  const i1 = SHARP.indexOf(label);
  if (i1 >= 0) return i1;
  const i2 = FLAT.indexOf(label);
  if (i2 >= 0) return i2;
  throw new Error("Unknown note label: " + label);
}
function pcToLabel(pc, prefer = "sharp") {
  return prefer === "flat" ? FLAT[pc] : SHARP[pc];
}

/* ================= Guitar model ================= */
const TUNING_PC = [4, 9, 2, 7, 11, 4]; // strings 6..1 => E2, A2, D3, G3, B3, E4
// strings index 0..5 == (6th..1st in tab order)
function stringPcAtFret(s, fretAbs) {
  if (fretAbs < 0) return null;        // mute
  if (fretAbs === 0) return TUNING_PC[s];
  return PC(TUNING_PC[s] + fretAbs);
}

/* ================= Recipes (intervals from root) ================= */
const I = (n) => PC(n); // interval helper
const RECIPES = {
  // Triads
  major:    [I(0), I(4), I(7)],
  minor:    [I(0), I(3), I(7)],
  dim:      [I(0), I(3), I(6)],
  aug:      [I(0), I(4), I(8)],

  // 6th + add9 + sus
  "6":      [I(0), I(4), I(7), I(9)],
  m6:       [I(0), I(3), I(7), I(9)],
  add9:     [I(0), I(4), I(7), I(2)],
  m_add9:   [I(0), I(3), I(7), I(2)],
  sus2:     [I(0), I(2), I(7)],
  sus4:     [I(0), I(5), I(7)],

  // 7ths
  "7":      [I(0), I(4), I(7), I(10)],
  maj7:     [I(0), I(4), I(7), I(11)],
  m7:       [I(0), I(3), I(7), I(10)],
  m7b5:     [I(0), I(3), I(6), I(10)],
  dim7:     [I(0), I(3), I(6), I(9)],

  // 9ths (compact sets; guitar grips often omit 5th/root)
  "9":      [I(0), I(4), I(10), I(2)],       // (1,3,b7,9)
  m9:       [I(0), I(3), I(10), I(2)],       // (1,b3,b7,9)
  maj9:     [I(0), I(4), I(11), I(2)],       // (1,3,7,9)

  // 11ths / sus4 add 9 (minimal)
  "11":     [I(0), I(4), I(10), I(5)],       // (1,3,b7,11)
  sus4add9: [I(0), I(5), I(2)],              // 1,4,9 (color chord)

  // 13ths (compact: 3, b7, 13, optionally 9, omit 5)
  "13":     [I(0), I(4), I(10), I(9)],       // (1,3,b7,13)
  m13:      [I(0), I(3), I(10), I(9)],       // (1,b3,b7,13)

  // Altered dominant sets (compact)
  "7b9":    [I(0), I(4), I(10), I(1)],
  "7#9":    [I(0), I(4), I(10), I(3)],
  "7b5":    [I(0), I(4), I(6),  I(10)],
  "7#5":    [I(0), I(4), I(8),  I(10)],
  "9b5":    [I(0), I(4), I(10), I(2), I(6)],
  "9#5":    [I(0), I(4), I(10), I(2), I(8)],
  "13b9":   [I(0), I(4), I(10), I(1), I(9)],
  "13#11":  [I(0), I(4), I(10), I(6), I(9)],
  "7#11":   [I(0), I(4), I(10), I(6)],
};

/* ================= Playability constraints ================= */
const MAX_FRET = 15;
const SPAN_LIMIT = 5;
const REQUIRE_AT_LEAST = 3;

function checkPlayability(shape) {
  const fretted = shape.frets.filter((f) => f > 0);
  const reasons = [];
  if (fretted.length < REQUIRE_AT_LEAST) reasons.push("Too few fretted notes");
  if (fretted.length) {
    const minF = Math.min(...fretted);
    const maxF = Math.max(...fretted);
    if (maxF > MAX_FRET) reasons.push(`Too high fret (> ${MAX_FRET})`);
    if (maxF - minF > SPAN_LIMIT) reasons.push(`Span > ${SPAN_LIMIT}`);
  }
  if (shape.barres && shape.barres.length) {
    for (const b of shape.barres) {
      const sounding = shape.frets.filter((f) => f >= b.fret).length;
      if (sounding < 3) reasons.push("Barre not meaningful");
    }
  }
  return { ok: reasons.length === 0, reasons };
}

function matchesRecipe(frets, intervals, rootPc) {
  const pcs = new Set();
  for (let s = 0; s < 6; s++) {
    const f = frets[s];
    if (f >= 0) pcs.add(stringPcAtFret(s, f));
  }
  for (const iv of intervals) {
    const need = PC(rootPc + iv);
    if (!pcs.has(need)) return false;
  }
  return true;
}

/* ================= Slash-bass rules ================= */
/**
 * allowFor: list of QUALITY_MAP keys allowed (e.g. "major","minor","7","m7","9","maj9","m9","11","13","m13","6","m6","add9","6/9","sus2","sus4","sus4add9", ...).
 * bassInterval: "3" | "b3" | "5" | "b7"
 */
const SLASH_BASS_RULES = [
  // Third-in-bass: major side
  { allowFor: ["major","6","add9","6/9","7","maj7","9","maj9","11","13","sus2","sus4","sus4add9","aug"], bassInterval: "3", weight: 3 },
  // Third-in-bass: minor side (use b3 by fallback logic below)
  { allowFor: ["minor","m6","m_add9","m7","m9","m11","m13"], bassInterval: "3", weight: 3 },
  // Fifth-in-bass: common to most
  { allowFor: ["major","minor","6","m6","add9","m_add9","6/9","7","maj7","m7","9","maj9","m9","11","m11","13","m13","sus2","sus4","sus4add9","dim","dim7","m7b5","aug"], bassInterval: "5", weight: 3 },
  // Dominant families: b7 bass
  { allowFor: ["7","9","11","13","7b9","7#9","9b5","9#5","13b9","13#11","7#11","7b5","7#5"], bassInterval: "b7", weight: 2 },
  // Minor 7 families: b7 bass
  { allowFor: ["m7","m9","m11","m13"], bassInterval: "b7", weight: 2 },
];

function intervalTextToSemitone(intervalText, recipe) {
  switch (intervalText) {
    case "3":
      return recipe.includes(I(4)) ? I(4) : (recipe.includes(I(3)) ? I(3) : null);
    case "b3": return I(3);
    case "5":  return I(7);
    case "b7": return I(10);
    default:   return null;
  }
}

/* ================= CAGED movable patterns ================= */
/**
 * strings index 0..5 = (6th..1st)
 * offsets per string = absolute fret = (B + offset) or OFF to mute
 * rootString = string index that carries the root tone at (B)
 */
const OFF = -1e9;

const SHAPES = {
  /* Major (E/A) */
  major_E: { rootString: 0, offsets: [0, +2, +2, +1, 0, 0],  barre: { from:1, to:6 } },
  major_A: { rootString: 1, offsets: [OFF, 0, +2, +2, +2, 0], barre: { from:1, to:5 } },

  /* Minor (E/A) */
  minor_E: { rootString: 0, offsets: [0, +2, +2, 0, 0, 0],   barre: { from:1, to:6 } },
  minor_A: { rootString: 1, offsets: [OFF, 0, +2, +2, +1, 0], barre: { from:1, to:5 } },

  /* Dominant 7 (E/A) */
  dom7_E:  { rootString: 0, offsets: [0, +2, 0, +1, 0, +2],  barre: { from:1, to:6 } },
  dom7_A:  { rootString: 1, offsets: [OFF, 0, +2, 0, +2, 0], barre: { from:1, to:5 } },

  /* Maj7 (E/A) */
  maj7_E:  { rootString: 0, offsets: [0, +2, +1, +1, 0, 0],  barre: { from:1, to:6 } },
  maj7_A:  { rootString: 1, offsets: [OFF, 0, +2, +1, +2, 0], barre: { from:1, to:5 } },

  /* m7 (E/A) */
  m7_E:    { rootString: 0, offsets: [0, +2, 0, 0, 0, 0],    barre: { from:1, to:6 } },
  m7_A:    { rootString: 1, offsets: [OFF, 0, +2, 0, +1, 0], barre: { from:1, to:5 } },

  /* m7b5 / dim7 (compact) */
  m7b5_A:  { rootString: 1, offsets: [OFF, 0, +1, 0, +1, 0], barre: { from:2, to:5 } },
  dim7_A:  { rootString: 1, offsets: [OFF, 0, +1, 0, +1, 0], barre: null },

  /* 6 / m6 (E-like) */
  six_E:   { rootString: 0, offsets: [0, +2, +2, +1, 0, +2], barre: { from:1, to:6 } },
  m6_E:    { rootString: 0, offsets: [0, +2, +2, 0, 0, +2],  barre: { from:1, to:6 } },

  /* sus4 / sus2 (E-like) */
  sus4_E:  { rootString: 0, offsets: [0, +2, +2, +2, 0, 0],  barre: { from:1, to:6 } },
  sus2_E:  { rootString: 0, offsets: [0, +2, +2, -1, 0, 0],  barre: { from:1, to:6 } }, // mute G to avoid 3rd

  /* add9 (E-like) */
  add9_E:  { rootString: 0, offsets: [0, +2, +2, +1, 0, +4], barre: { from:1, to:6 } },

  /* Dominant alterations (compact grips) */
  dom7b9_A:   { rootString: 1, offsets: [OFF, 0, +1, 0, +2, +1], barre: null },
  "dom7#9_A": { rootString: 1, offsets: [OFF, 0, +3, 0, +2, 0],  barre: null },
  dom7b5_A:   { rootString: 1, offsets: [OFF, 0, +1, +1, +2, 0], barre: null },
  "dom7#5_A": { rootString: 1, offsets: [OFF, 0, +3, +1, +2, 0], barre: null },
  dom9b5_A:   { rootString: 1, offsets: [OFF, 0, +1, 0, +2, +2], barre: null },
  "dom9#5_A": { rootString: 1, offsets: [OFF, 0, +3, 0, +2, +2], barre: null },
  dom13b9_A:  { rootString: 1, offsets: [OFF, 0, +1, 0, +2, +4], barre: null },
  "dom13#11_A":{rootString: 1, offsets: [OFF, 0, +1, +1, +2, +4],barre: null },
  "dom7#11_A": { rootString: 1, offsets: [OFF, 0, +1, +1, +2, 0], barre: null },

  /* ====== 9ths compact ====== */
  dom9_A_comp1: { rootString: 1, offsets: [OFF, 0, -1, 0, 0, OFF], barre: null }, // x 3 2 3 3 x (transposed)
  dom9_E_comp1: { rootString: 0, offsets: [0, +2, 0, +1, 0, OFF], barre: null },  // 0 2 0 1 0 x (transposed)

  m9_A_comp1:   { rootString: 1, offsets: [OFF, 0, +2, 0, +1, OFF], barre: null },
  m9_E_comp1:   { rootString: 0, offsets: [0, +2, 0, 0, +2, OFF],   barre: null },

  maj9_A_comp1: { rootString: 1, offsets: [OFF, 0, -1, +1, 0, OFF], barre: null },
  maj9_E_comp1: { rootString: 0, offsets: [0, +2, +1, +1, +2, OFF], barre: null },

  /* ====== 11ths ====== */
  dom11_A_comp1: { rootString: 1, offsets: [OFF, 0, -1, 0, +2, OFF], barre: null },
  dom11_E_comp1: { rootString: 0, offsets: [0, +2, 0, +2, 0, OFF],   barre: null },

  // sus4add9 E-like alt
  sus4add9_E_alt: { rootString: 0, offsets: [0, +2, +2, +2, 0, +2], barre: { from:1, to:6 } },

  /* ====== 13ths ====== */
  dom13_A_comp1: { rootString: 1, offsets: [OFF, 0, -1, 0, +2, OFF], barre: null },
  dom13_A_comp2: { rootString: 1, offsets: [OFF, 0, -1, 0, +2, +2],  barre: null },
  dom13_E_comp1: { rootString: 0, offsets: [0, +2, 0, +1, +2, OFF],  barre: null },

  m13_A_comp1:  { rootString: 1, offsets: [OFF, 0, +2, 0, +2, OFF],  barre: null },
  m13_E_comp1:  { rootString: 0, offsets: [0, +2, 0, 0, +2, OFF],    barre: null },

  /* ===== Triad/D-compact (thêm vị trí trên) ===== */
  triad_D_hi:  { rootString: 2, offsets: [OFF, OFF, 0, +2, +3, OFF], barre: null }, // D-shape major
  mtriad_D_hi: { rootString: 2, offsets: [OFF, OFF, 0, +1, +3, OFF], barre: null }, // D-shape minor
  aug_D_hi:    { rootString: 2, offsets: [OFF, OFF, 0, +2, +4, OFF], barre: null }, // D+
  dim_D_hi:    { rootString: 2, offsets: [OFF, OFF, 0, +1, +2, OFF], barre: null }, // Ddim

  /* ===== Add9 / 6/9 / maj6/9 ===== */
  add9_A_comp: { rootString: 1, offsets: [OFF, 0, +2, +1, 0, +4], barre: null },
  sixnine_E:   { rootString: 0, offsets: [0, +2, +2, +1, 0, +2],  barre: { from:1, to:6 } },
  maj69_A:     { rootString: 1, offsets: [OFF, 0, +2, +1, 0, +2],  barre: null },

  /* ===== 9ths/11ths/13ths extra ===== */
  "dom9_A_comp2": { rootString: 1, offsets: [OFF, 0, +2, 0, 0, +2], barre: null },
  "dom9_E_comp2": { rootString: 0, offsets: [0, +2, 0, +1, +2, 0], barre: null },
  "m9_A_comp2":   { rootString: 1, offsets: [OFF, 0, +2, 0, +2, OFF], barre: null },
  "m9_E_comp2":   { rootString: 0, offsets: [0, +2, 0, 0, +2, 0],   barre: null },
  "maj9_A_comp2": { rootString: 1, offsets: [OFF, 0, +2, +1, 0, +2], barre: null },
  "maj9_E_comp2": { rootString: 0, offsets: [0, +2, +1, +1, 0, +2], barre: null },

  "dom11_A_comp2": { rootString: 1, offsets: [OFF, 0, 0, 0, +2, 0],  barre: null },
  "dom11_E_comp2": { rootString: 0, offsets: [0, +2, 0, +2, +2, 0],  barre: null },
  "m11_A_comp1":   { rootString: 1, offsets: [OFF, 0, +2, 0, +2, +2],barre: null },
  "m11_E_comp1":   { rootString: 0, offsets: [0, +2, 0, 0, +2, +2],  barre: null },

  "dom13_A_comp3": { rootString: 1, offsets: [OFF, 0, -1, 0, +2, 0],  barre: null },
  "dom13_E_comp2": { rootString: 0, offsets: [0, +2, 0, +1, +2, 0],   barre: null },
  "dom13_9_A":     { rootString: 1, offsets: [OFF, 0, -1, 0, +2, +2], barre: null },
  "m13_A_comp2":   { rootString: 1, offsets: [OFF, 0, +2, 0, +2, 0],  barre: null },
  "m13_E_comp2":   { rootString: 0, offsets: [0, +2, 0, 0, +2, 0],    barre: null },

  /* ===== Dominant altered extra ===== */
  "7b9_E":   { rootString: 0, offsets: [0, +2, 0, +1, 0, +1], barre: null },
  "7#9_E":   { rootString: 0, offsets: [0, +2, +3, +1, 0, 0], barre: null },
  "7b13_A":  { rootString: 1, offsets: [OFF, 0, +1, 0, +1, +3], barre: null },
  "7sus4_A": { rootString: 1, offsets: [OFF, 0, +2, +2, 0, 0],  barre: null },
  "7sus4add9_A": { rootString: 1, offsets: [OFF, 0, +2, +2, 0, +2], barre: null },

  /* ===== sus2/sus4/add9 bổ sung ===== */
  "sus2_A_comp": { rootString: 1, offsets: [OFF, 0, +2, -1, 0, 0], barre: null },
  "sus4_A_comp": { rootString: 1, offsets: [OFF, 0, +2, +2, 0, 0],  barre: null },
  "add9_D_hi":   { rootString: 2, offsets: [OFF, OFF, 0, +2, +4, +2], barre: null },
};

/* Map quality -> which patterns to try + symbol suffix
   (No duplicate keys; each quality appears once) */
const QUALITY_MAP = {
  // triads & basic
  major:   { shapes:["major_E","major_A","triad_D_hi"], suffix:"" },
  minor:   { shapes:["minor_E","minor_A","mtriad_D_hi"], suffix:"m" },
  dim:     { shapes:["m7b5_A","dim_D_hi"],              suffix:"dim" },
  aug:     { shapes:["major_E","aug_D_hi"],             suffix:"aug" },

  "6":     { shapes:["six_E"],                           suffix:"6" },
  m6:      { shapes:["m6_E"],                            suffix:"m6" },
  add9:    { shapes:["add9_E","add9_A_comp","add9_D_hi"], suffix:"add9" },
  m_add9:  { shapes:["minor_E"],                         suffix:"m(add9)" },
  "6/9":   { shapes:["sixnine_E","maj69_A"],             suffix:"6/9" },
  sus2:    { shapes:["sus2_E","sus2_A_comp"],            suffix:"sus2" },
  sus4:    { shapes:["sus4_E","sus4_A_comp"],            suffix:"sus4" },
  sus4add9:{ shapes:["sus4_E","sus4add9_E_alt","7sus4add9_A"], suffix:"sus4add9" },

  // sevenths
  "7":     { shapes:["dom7_E","dom7_A"],                 suffix:"7" },
  maj7:    { shapes:["maj7_E","maj7_A"],                 suffix:"maj7" },
  m7:      { shapes:["m7_E","m7_A"],                     suffix:"m7" },
  m7b5:    { shapes:["m7b5_A"],                          suffix:"m7b5" },
  dim7:    { shapes:["dim7_A"],                          suffix:"dim7" },

  // 9ths
  "9":     { shapes:["dom7_A","dom9_A_comp1","dom9_E_comp1","dom9_A_comp2","dom9_E_comp2"], suffix:"9" },
  m9:      { shapes:["m7_A","m9_A_comp1","m9_E_comp1","m9_A_comp2","m9_E_comp2"],           suffix:"m9" },
  maj9:    { shapes:["maj7_A","maj9_A_comp1","maj9_E_comp1","maj9_A_comp2","maj9_E_comp2"], suffix:"maj9" },

  // 11ths
  "11":    { shapes:["dom7_A","dom11_A_comp1","dom11_E_comp1","dom11_A_comp2","dom11_E_comp2"], suffix:"11" },
  m11:     { shapes:["m7_A","m11_A_comp1","m11_E_comp1"],                                       suffix:"m11" },

  // 13ths
  "13":    { shapes:["six_E","dom7_A","dom13_A_comp1","dom13_A_comp2","dom13_A_comp3","dom13_E_comp1","dom13_E_comp2","dom13_9_A"], suffix:"13" },
  m13:     { shapes:["m6_E","m7_A","m13_A_comp1","m13_E_comp1","m13_A_comp2","m13_E_comp2"],                                          suffix:"m13" },

  // dominant altered
  "7b9":   { shapes:["dom7b9_A","7b9_E"], suffix:"7b9" },
  "7#9":   { shapes:["dom7#9_A","7#9_E"], suffix:"7#9" },
  "7b5":   { shapes:["dom7b5_A"],         suffix:"7b5" },
  "7#5":   { shapes:["dom7#5_A"],         suffix:"7#5" },
  "9b5":   { shapes:["dom9b5_A"],         suffix:"9b5" },
  "9#5":   { shapes:["dom9#5_A"],         suffix:"9#5" },
  "13b9":  { shapes:["dom13b9_A"],        suffix:"13b9" },
  "13#11": { shapes:["dom13#11_A"],       suffix:"13#11" },
  "7#11":  { shapes:["dom7#11_A"],        suffix:"7#11" },
  "7b13":  { shapes:["7b13_A"],           suffix:"7b13" },
};

/* ================= Generation core ================= */
function possibleBarreFretsForRoot(rootPc, pattern) {
  const s = pattern.rootString;
  const base = PC(rootPc - TUNING_PC[s]); // B ≡ rootPc - tuning[s] (mod 12)
  const list = [];
  for (let B = base; B <= MAX_FRET; B += 12) {
    if (B >= 1) list.push(B);
  }
  return list;
}
function buildFretsFromPattern(B, offsets) {
  return offsets.map(off => off === OFF ? -1 : (B + off));
}

function lowestSoundingStringIndex(frets) {
  let idx = null;
  for (let s = 0; s < 6; s++) {
    if (frets[s] >= 0) idx = s; // keep last sounding index (lowest pitch)
  }
  return idx; // 0..5 or null
}

function collectPcs(frets) {
  const pcs = new Set();
  for (let s = 0; s < 6; s++) {
    const f = frets[s];
    if (f >= 0) pcs.add(stringPcAtFret(s, f));
  }
  return pcs;
}

function tryVoicing({rootPc, recipe, shapeKey, B}) {
  const pat = SHAPES[shapeKey];
  const frets = buildFretsFromPattern(B, pat.offsets);
  const okTheory = matchesRecipe(frets, recipe, rootPc);
  if (!okTheory) return null;

  const shape = {
    baseFret: Math.max(1, Math.min(...frets.filter(f => f > 0), B)),
    frets,
    fingers: undefined,
    barres: pat.barres ? [{ fret: B, from: pat.barres.from, to: pat.barres.to, finger: 1 }] : undefined,
    gridFrets: 4,
    rootString: pat.rootString + 1,
    rootFret: B,
  };
  const play = checkPlayability(shape);
  if (!play.ok) return null;

  return shape;
}

/* ----- Generate slash inversions using SLASH_BASS_RULES ----- */
function makeSlashVariants(rootPc, recipe, qualityKey, shape) {
  const targetSet = new Set();
  for (const r of SLASH_BASS_RULES) {
    if (!r.allowFor.includes(qualityKey)) continue;
    const iv = intervalTextToSemitone(r.bassInterval, recipe);
    if (iv != null) targetSet.add(iv);
  }
  if (targetSet.size === 0) return [];

  const out = [];
  const originalFrets = shape.frets;
  const pcsPerString = originalFrets.map((f, s) => (f >= 0 ? stringPcAtFret(s, f) : null));

  for (const iv of targetSet) {
    const targetPc = PC(rootPc + iv);
    const candidates = [];
    pcsPerString.forEach((pc, idx) => { if (pc === targetPc) candidates.push(idx); });
    if (!candidates.length) continue;

    const chosen = Math.max(...candidates); // lowest pitch among found
    const newFrets = originalFrets.map((f, i) => (i < chosen ? -1 : f));

    if (!matchesRecipe(newFrets, recipe, rootPc)) continue;

    const lowestIdx = lowestSoundingStringIndex(newFrets);
    if (lowestIdx == null) continue;
    const lowestPc = stringPcAtFret(lowestIdx, newFrets[lowestIdx]);
    if (lowestPc !== targetPc) continue;

    const bassLabel = pcToLabel(lowestPc);
    const variant = {
      ...shape,
      frets: newFrets,
      bassPc: lowestPc,
      bassLabel,
      bassString: lowestIdx + 1,
    };
    const play = checkPlayability(variant);
    if (play.ok) out.push(variant);
  }
  return out;
}

/* ----- Dedup by (pcs set + bass + normalized fret signature) ----- */
function signatureOf(shape) {
  const pcs = [...collectPcs(shape.frets)].sort().join(",");
  const bassIdx = lowestSoundingStringIndex(shape.frets);
  const bassPc = bassIdx == null ? "x" : stringPcAtFret(bassIdx, shape.frets[bassIdx]);
  const pos = shape.frets.filter(f => f > 0);
  const minPos = pos.length ? Math.min(...pos) : 0;
  const rel = shape.frets.map(f => (f <= 0 ? f : f - minPos)).join(".");
  return `${pcs}|b:${bassPc}|r:${rel}`;
}

/* ================= Main routine ================= */
const ROOTS = SHARP; // 12 pitch classes in sharp naming
const QUALITIES_ORDER = Object.keys(QUALITY_MAP);
const MAX_PER_ROOT = 40;

function generateForRoot(rootLabel) {
  const rootPc = labelToPc(rootLabel);
  const bucket = []; // collect all validated shapes + metadata

  for (const q of QUALITIES_ORDER) {
    const recipe = RECIPES[q];
    if (!recipe) continue;
    const { shapes, suffix } = QUALITY_MAP[q];
    for (const shapeKey of shapes) {
      const pat = SHAPES[shapeKey];
      if (!pat) continue;
      const candidatesB = possibleBarreFretsForRoot(rootPc, pat);
      for (const B of candidatesB) {
        const v = tryVoicing({ rootPc, recipe, shapeKey, B });
        if (!v) continue;

        // Base (root-bass)
        bucket.push({ symbol: rootLabel + suffix, quality: q, shape: v });

        // Slash variants
        for (const sv of makeSlashVariants(rootPc, recipe, q, v)) {
          const bassSuffix = `/${sv.bassLabel}`;
          bucket.push({ symbol: rootLabel + suffix + bassSuffix, quality: q, shape: sv });
        }
      }
    }
  }

  // Dedup across all qualities
  const seen = new Set();
  const bySymbol = new Map(); // symbol -> variants[]
  for (const item of bucket) {
    const sig = signatureOf(item.shape);
    if (seen.has(sig)) continue;
    seen.add(sig);
    if (!bySymbol.has(item.symbol)) bySymbol.set(item.symbol, []);
    bySymbol.get(item.symbol).push(item.shape);
  }

  // Build ChordEntry list, cap to MAX_PER_ROOT by selecting lower positions first
  const symbolsSorted = [...bySymbol.keys()].sort((a,b)=>a.localeCompare(b));
  const out = [];
  let count = 0;
  for (const sym of symbolsSorted) {
    if (count >= MAX_PER_ROOT) break;
    const vars = bySymbol.get(sym)
      .sort((a,b) => {
        const mina = Math.min(...a.frets.filter(f=>f>0), 99);
        const minb = Math.min(...b.frets.filter(f=>f>0), 99);
        return mina - minb;
      })
      .slice(0, 3); // keep a few per symbol
    out.push({
      symbol: sym,
      aliases: [],
      instrument: "guitar",
      variants: vars,
    });
    count += 1;
  }

  return out;
}

function main() {
  const all = [];
  for (const root of ROOTS) {
    const set = generateForRoot(root);
    all.push(...set);
  }
  console.log(JSON.stringify(all, null, 2));
}

if (require.main === module) {
  main();
}
