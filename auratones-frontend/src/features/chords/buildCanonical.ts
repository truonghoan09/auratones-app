// src/features/chords/buildCanonical.ts
import { ALL_RECIPE_IDS } from '../../data/recipes';
import type { CanonicalChord, PitchClass, RecipeId } from '../../types/chord-canonical';

const PCS: PitchClass[] = [0,1,2,3,4,5,6,7,8,9,10,11];

export function buildCanonicalSet(): CanonicalChord[] {
  const out: CanonicalChord[] = [];
  for (const pc of PCS) for (const id of ALL_RECIPE_IDS as RecipeId[]) out.push({ pc, recipeId: id });
  return out;
}
