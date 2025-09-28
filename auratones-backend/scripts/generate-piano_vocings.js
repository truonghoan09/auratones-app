#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Piano Chord Voicing Generator (2-oct layout, auto-center)
 *
 * - Uses same RECIPES as guitar set (wide coverage).
 * - Always renders within a 2-octave window (24 semitones).
 * - Chooses startKey so that the chord cluster sits centered around a "center" midi.
 * - Generates common slash inversions: 3rd, 5th (and b7 for dominant-family).
 * - verify = null (no manual verification required for piano).
 *
 * Run:
 *   node scripts/generate-piano_voicings.js --center 60 > out/piano_seed.json
 *
 * Flags:
 *   --center <midi>     : override center midi (default 64 = E4)
 *   --maxPerRoot <n>    : cap symbols per root (default 9999)
 */

//////////////////// CLI ////////////////////
const argv = process.argv.slice(2);
let DEFAULT_CENTER = 64; // E4
let MAX_PER_ROOT = 9999;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--center" && argv[i + 1]) {
    DEFAULT_CENTER = parseInt(argv[i + 1], 10);
    console.error("[INFO] Center override =", DEFAULT_CENTER);
  }
  if (argv[i] === "--maxPerRoot" && argv[i + 1]) {
    MAX_PER_ROOT = parseInt(argv[i + 1], 10);
    console.error("[INFO] Max per root =", MAX_PER_ROOT);
  }
}

//////////////////// Pitch helpers ////////////////////
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

// choose sharp naming for canonical root symbol
const ROOTS = SHARP.slice();

//////////////////// Recipes (intervals from root) ////////////////////
const I = (n) => PC(n);

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

  // 9ths (compact sets; piano dễ thêm 5th nếu muốn ở FE)
  "9":      [I(0), I(4), I(10), I(2)],
  m9:       [I(0), I(3), I(10), I(2)],
  maj9:     [I(0), I(4), I(11), I(2)],

  // 11ths / sus4 add9
  "11":     [I(0), I(4), I(10), I(5)],
  sus4add9: [I(0), I(5), I(2)],

  // 13ths
  "13":     [I(0), I(4), I(10), I(9)],
  m13:      [I(0), I(3), I(10), I(9)],

  // Altered dominant
  "7b9":    [I(0), I(4), I(10), I(1)],
  "7#9":    [I(0), I(4), I(10), I(3)],
  "7b5":    [I(0), I(4), I(6),  I(10)],
  "7#5":    [I(0), I(4), I(8),  I(10)],
  "9b5":    [I(0), I(4), I(10), I(2), I(6)],
  "9#5":    [I(0), I(4), I(10), I(2), I(8)],
  "13b9":   [I(0), I(4), I(10), I(1), I(9)],
  "13#11":  [I(0), I(4), I(10), I(6), I(9)],
  "7#11":   [I(0), I(4), I(10), I(6)],

  // extra
  "6/9":    [I(0), I(4), I(9), I(2)],
  m11:      [I(0), I(3), I(10), I(5)],
  "7sus4":  [I(0), I(5), I(10)],
};

//////////////////// Symbol mapping ////////////////////
const QUALITY_MAP = {
  major:   { suffix: "" },
  minor:   { suffix: "m" },
  dim:     { suffix: "dim" },
  aug:     { suffix: "aug" },

  "6":     { suffix: "6" },
  m6:      { suffix: "m6" },
  add9:    { suffix: "add9" },
  m_add9:  { suffix: "m(add9)" },
  sus2:    { suffix: "sus2" },
  sus4:    { suffix: "sus4" },

  "7":     { suffix: "7" },
  maj7:    { suffix: "maj7" },
  m7:      { suffix: "m7" },
  m7b5:    { suffix: "m7b5" },
  dim7:    { suffix: "dim7" },

  "9":     { suffix: "9" },
  m9:      { suffix: "m9" },
  maj9:    { suffix: "maj9" },

  "11":    { suffix: "11" },
  sus4add9:{ suffix: "sus4add9" },

  "13":    { suffix: "13" },
  m13:     { suffix: "m13" },

  "7b9":   { suffix: "7b9" },
  "7#9":   { suffix: "7#9" },
  "7b5":   { suffix: "7b5" },
  "7#5":   { suffix: "7#5" },
  "9b5":   { suffix: "9b5" },
  "9#5":   { suffix: "9#5" },
  "13b9":  { suffix: "13b9" },
  "13#11": { suffix: "13#11" },
  "7#11":  { suffix: "7#11" },

  "6/9":   { suffix: "6/9" },
  m11:     { suffix: "m11" },
  "7sus4": { suffix: "7sus4" },
};

//////////////////// Piano voicing helpers ////////////////////

/**
 * Build a closed-position stack (ascending) near a reference midi.
 * We create one or two-oct stacks then shift to fit 2-oct window around DEFAULT_CENTER.
 */
function buildClosedStack(rootPc, recipe, refMidi) {
  // Start from a root near refMidi
  const rootNear = findNearestMidiForPc(rootPc, refMidi);

  // Build ascending list using the given intervals, then lift by octaves to keep strictly ascending
  const pcs = recipe.slice().sort((a,b)=>a-b);
  const notes = [];
  for (let i = 0; i < pcs.length; i++) {
    const targetPc = PC(rootPc + pcs[i]);
    // find pitch >= previousNote (or near ref) with that pc
    const prev = i === 0 ? (rootNear - 24) : notes[notes.length - 1];
    const next = findNextMidiForPcAtLeast(targetPc, prev + 1);
    notes.push(next);
  }

  // If span too narrow, optionally duplicate octave on top to fatten (esp. triads)
  if (notes.length <= 3) {
    const topOct = notes[notes.length - 1] + 12;
    notes.push(topOct);
  }

  return notes;
}

function findNearestMidiForPc(pc, aroundMidi) {
  // search +/- 6 semitones for nearest of that pc
  let best = aroundMidi;
  let bestDist = 1e9;
  for (let m = aroundMidi - 12; m <= aroundMidi + 12; m++) {
    if (PC(m) === pc) {
      const d = Math.abs(m - aroundMidi);
      if (d < bestDist) {
        best = m;
        bestDist = d;
      }
    }
  }
  return best;
}
function findNextMidiForPcAtLeast(pc, minMidi) {
  let m = minMidi;
  while (PC(m) !== pc) m++;
  return m;
}

/**
 * Fit notes into a 2-octave window centered at DEFAULT_CENTER
 * Returns { baseKey, keys } where baseKey is leftmost key of window.
 */
function fitIntoTwoOctaves(keys, centerMidi) {
  const WINDOW = 24;
  // choose base so that (median(keys)) is near (base + 12)
  const median = keys[Math.floor(keys.length / 2)];
  let base = Math.round(median - 12);
  // align so that window covers centerMidi best
  // try a few candidates around base to minimize squared distance to center
  let bestBase = base;
  let bestScore = 1e12;
  for (let cand = base - 12; cand <= base + 12; cand++) {
    const hi = cand + WINDOW - 1;
    const inRange = keys.every(k => k >= cand && k <= hi);
    if (!inRange) continue;
    const midOfWindow = cand + 12;
    const score = (midOfWindow - centerMidi) ** 2;
    if (score < bestScore) {
      bestScore = score;
      bestBase = cand;
    }
  }
  // if no candidate fit, compress by shifting octave cluster
  let out = keys.slice();
  const hiKey = Math.max(...out);
  const loKey = Math.min(...out);
  if (hiKey - loKey >= 24) {
    // fold top notes down an octave until fits
    while (Math.max(...out) - Math.min(...out) >= 24) {
      const idxTop = out.indexOf(Math.max(...out));
      out[idxTop] -= 12;
    }
  }
  // recompute bestBase for possibly changed out
  const med2 = out[Math.floor(out.length / 2)];
  let base2 = Math.round(med2 - 12);
  let bestBase2 = base2;
  bestScore = 1e12;
  for (let cand = base2 - 12; cand <= base2 + 12; cand++) {
    const hi = cand + WINDOW - 1;
    const inRange = out.every(k => k >= cand && k <= hi);
    if (!inRange) continue;
    const midOfWindow = cand + 12;
    const score = (midOfWindow - centerMidi) ** 2;
    if (score < bestScore) {
      bestScore = score;
      bestBase2 = cand;
    }
  }
  return { baseKey: bestBase2, keys: out };
}

/**
 * Make slash variants by re-basing to put chosen chord tone in bass,
 * then re-fit into 2-oct layout.
 */
function makeSlashVariantsPiano(rootPc, recipe, baseKeys, centerMidi) {
  const targets = new Set([I(3), I(4), I(7)]); // m3, M3, 5
  const isDominant = recipe.includes(I(10));
  if (isDominant) targets.add(I(10)); // b7 for dom

  const pcsSet = new Set(recipe.map(x => PC(x)));
  const out = [];

  for (const iv of targets) {
    const targetPc = PC(rootPc + iv);
    if (!pcsSet.has(PC(iv))) continue; // ensure chord actually has that tone (it should)

    // pick the lowest instance of that pc from base voicing (or synthesize)
    // simple approach: replace bass with nearest target below median
    const median = baseKeys[Math.floor(baseKeys.length / 2)];
    // find a target below (or near) median
    const bassCandidate = findNearestMidiForPc(targetPc, median - 7);

    // build a new stack: bassCandidate + shift others up if needed to keep inside window
    let newKeys = baseKeys.slice();
    // Ensure bass is included and is the lowest key
    newKeys = [bassCandidate, ...newKeys.filter(k => k !== bassCandidate)];
    newKeys.sort((a,b)=>a-b);
    // if duplicated too close, nudge top by octave to keep texture
    for (let i = 1; i < newKeys.length; i++) {
      if (newKeys[i] - newKeys[i-1] < 2) newKeys[i] += 12;
    }
    // refit 2-octave
    const fit = fitIntoTwoOctaves(newKeys, centerMidi);
    const bassIdx = 0;
    const bass = fit.keys[bassIdx];
    const bassLabel = pcToLabel(PC(bass));
    out.push({ baseKey: fit.baseKey, keys: fit.keys, bass, bassLabel });
  }
  return out;
}

//////////////////// Main generator per root ////////////////////
function generateForRoot(rootLabel) {
  const rootPc = labelToPc(rootLabel);
  const entries = [];
  let symbolsCount = 0;

  for (const q of Object.keys(RECIPES)) {
    if (symbolsCount >= MAX_PER_ROOT) break;

    const recipe = RECIPES[q];
    const { suffix } = QUALITY_MAP[q] || { suffix: "" };
    const symbol = rootLabel + suffix;

    // base closed stack near DEFAULT_CENTER
    const closed = buildClosedStack(rootPc, recipe, DEFAULT_CENTER);
    const fit = fitIntoTwoOctaves(closed, DEFAULT_CENTER);
    const pcs = recipe.map(x => PC(x));
    const bass = fit.keys[0];
    const bassLabel = pcToLabel(PC(bass));

    const baseVariant = {
      baseKey: fit.baseKey,
      keys: fit.keys,
      pcs,
      bass,
      bassLabel,
      verify: null,
    };

    // slash variants
    const slashes = makeSlashVariantsPiano(rootPc, recipe, fit.keys, DEFAULT_CENTER)
      .map(v => ({
        baseKey: v.baseKey,
        keys: v.keys,
        pcs,
        bass: v.bass,
        bassLabel: v.bassLabel,
        verify: null,
      }));

    // dedup by key-signature
    const seen = new Set();
    const deduped = [];
    for (const v of [baseVariant, ...slashes]) {
      const sig = v.keys.join(".");
      if (seen.has(sig)) continue;
      seen.add(sig);
      deduped.push(v);
    }

    entries.push({
      symbol,
      aliases: [],
      instrument: "piano",
      variants: deduped,
    });

    symbolsCount++;
  }

  return entries;
}

//////////////////// Entry ////////////////////
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
