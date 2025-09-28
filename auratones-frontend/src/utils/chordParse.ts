// src/utils/chordParse.ts
// Parse "Dbm7b5", "C#maj7", "Bb", "Faug", ... → { pc, recipeId }

import type { PitchClass, RecipeId } from '../types/chord-canonical';

// map root → pc
const ROOT_TO_PC: Record<string, PitchClass> = {
  'C':0, 'B#':0,
  'C#':1, 'Db':1,
  'D':2,
  'D#':3, 'Eb':3,
  'E':4, 'Fb':4,
  'E#':5, 'F':5,
  'F#':6, 'Gb':6,
  'G':7,
  'G#':8, 'Ab':8,
  'A':9,
  'A#':10, 'Bb':10,
  'B':11, 'Cb':11,
};

// quality patterns → RecipeId
const QUALITY_MAP: Array<[pattern: RegExp, id: RecipeId]> = [
  // Major-family
  [/^maj7$/i, 'M7'],
  [/^maj9$/i, 'M9'],
  [/^maj11$/i, 'M11'],
  [/^maj13$/i, 'M13'],
  [/^maj7#11$/i, 'maj7#11'],
  [/^maj$/i, 'maj'],
  [/^M7$/i, 'M7'],

  // Minor-family
  [/^mMaj7$/i, 'mMaj7'],
  [/^mMaj9$/i, 'mMaj9'],
  [/^m13$/i, 'm13'],
  [/^m11$/i, 'm11'],
  [/^m9$/i, 'm9'],
  [/^m7b5$/i, 'm7b5'],
  [/^m7$/i, 'm7'],
  [/^min7$/i, 'm7'],
  [/^m6$/i, 'm6'],
  [/^m$/i, 'm'],
  [/^min$/i, 'm'],

  // Dominant/alt
  [/^7sus4$/i, '7sus4'],
  [/^9sus4$/i, '9sus4'],
  [/^7alt$/i, '7alt'],
  [/^7b13$/i, '7b13'],
  [/^7#11$/i, '7#11'],
  [/^13$/i, '13'],
  [/^11$/i, '11'],
  [/^9$/i, '9'],
  [/^7b9$/i, '7b9'],
  [/^7#9$/i, '7#9'],
  [/^7b5$/i, '7b5'],
  [/^7#5$/i, '7#5'],
  [/^7$/i, '7'],

  // Triads / add / power
  [/^dim7$/i, 'dim7'],
  [/^dim$/i, 'dim'],
  [/^aug$/i, 'aug'],
  [/^add13$/i, 'add13'],
  [/^add11$/i, 'add11'],
  [/^add9$/i, 'add9'],
  [/^6\/9$/i, '6/9'],
  [/^6$/i, '6'],
  [/^sus2$/i, 'sus2'],
  [/^sus4$/i, 'sus4'],
  [/^5$/i, '5'],

  // fallback maj handled later
];

const RX = /^([A-Ga-g])([#b]{0,2})(.*)$/;

export function parseChordSymbol(symbolRaw: string): { pc: PitchClass; recipeId: RecipeId } | null {
  const symbol = symbolRaw.trim();
  const m = RX.exec(symbol);
  if (!m) return null;

  const letter = m[1].toUpperCase();
  const accidentals = (m[2] || '');
  const qualityStr = (m[3] || '').replace(/\s+/g, '');

  const pc = normalizeRootToPc(letter + accidentals);
  if (pc == null) return null;

  const qualityId = detectQualityId(qualityStr);
  if (!qualityId) return null;

  return { pc, recipeId: qualityId };
}

export function normalizeRootToPc(root: string): PitchClass | null {
  if (ROOT_TO_PC[root] != null) return ROOT_TO_PC[root];

  // support ## / bb
  const base = root[0]?.toUpperCase();
  if (!base || !'ABCDEFG'.includes(base)) return null;

  const BASE_PC: Record<string, PitchClass> = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  let pc = BASE_PC[base];
  if (pc == null) return null;

  for (const ch of root.slice(1)) {
    if (ch === '#') pc = ((pc + 1) % 12) as PitchClass;
    else if (ch === 'b') pc = ((pc + 11) % 12) as PitchClass;
    else return null;
  }
  return pc as PitchClass;
}

export function detectQualityId(qRaw: string): RecipeId | null {
  const q = qRaw || '';
  if (q === '') return 'maj';
  for (const [rx, id] of QUALITY_MAP) {
    if (rx.test(q)) return id;
  }
  return null;
}
