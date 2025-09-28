// src/types/chord-canonical.ts
export type PitchClass = 0|1|2|3|4|5|6|7|8|9|10|11;

export type RecipeId =
  // Triads
  | 'maj' | 'm' | 'dim' | 'aug' | 'sus2' | 'sus4' | '5'
  // 7th
  | '7' | 'M7' | 'm7' | 'dim7' | 'm7b5' | 'aug7'
  | '7b5' | '7#5' | '7b9' | '7#9'
  // 9/11/13
  | '9' | 'M9' | 'm9'
  | '11' | 'M11' | 'm11'
  | '13' | 'M13' | 'm13'
  // add & 6
  | 'add9' | 'add11' | 'add13'
  | '6' | 'm6' | '6/9'
  // variants
  | '7sus4' | '9sus4'
  | '7b13' | '7#11' | '7alt'
  | 'maj7#11' | 'mMaj7' | 'mMaj9';

export type CanonicalChord = {
  pc: PitchClass;
  recipeId: RecipeId;
};
