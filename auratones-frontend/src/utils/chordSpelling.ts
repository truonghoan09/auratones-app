// src/utils/chordSpelling.ts
// Đặt tên root theo key/ngữ cảnh + format nhãn hợp âm (dùng RECIPES.short)

import { RECIPES } from '../data/recipes';
import type { PitchClass, RecipeId } from '../types/chord-canonical';

export type KeySignature =
  | 'C'|'G'|'D'|'A'|'E'|'B'|'F#'|'C#'   // họ ♯
  | 'F'|'Bb'|'Eb'|'Ab'|'Db'|'Gb'|'Cb';  // họ ♭

export type SpellOptions = {
  direction?: 'up' | 'down'; // chromatic passing: up → ưu tiên #, down → ưu tiên b
  preferSharps?: boolean;    // override nhanh
};

// Tên nốt cho 12 pc
const SHARP_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
const FLAT_NAMES  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'] as const;

const SHARP_KEYS: KeySignature[] = ['C','G','D','A','E','B','F#','C#'];

function chooseUseSharp(key: KeySignature, opts?: SpellOptions): boolean {
  if (opts?.direction === 'up') return true;
  if (opts?.direction === 'down') return false;
  if (typeof opts?.preferSharps === 'boolean') return opts.preferSharps;
  return SHARP_KEYS.includes(key);
}

/** Đặt tên root cho pitch-class theo key/ngữ cảnh */
export function spellRoot(pc: PitchClass, key: KeySignature, opts?: SpellOptions): string {
  const useSharp = chooseUseSharp(key, opts);
  return (useSharp ? SHARP_NAMES : FLAT_NAMES)[pc];
}

/** map RecipeId → nhãn ngắn */
export function recipeShortName(id: RecipeId): string {
  return RECIPES[id]?.short ?? '';
}

/** Tạo nhãn hợp âm hiển thị: Root + quality ngắn */
export function formatChordLabel(
  ch: { pc: PitchClass; recipeId: RecipeId },
  key: KeySignature,
  opts?: SpellOptions,
): string {
  const root = spellRoot(ch.pc, key, opts);
  const q = recipeShortName(ch.recipeId);
  return `${root}${q}`;
}

/** Cả hai tên enharmonic cho một pc (pc=1 → ['C#','Db']) */
export function enharmonicNames(pc: PitchClass): [sharp: string, flat: string] {
  return [SHARP_NAMES[pc], FLAT_NAMES[pc]];
}
