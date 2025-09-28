// src/data/recipes.ts
import type { RecipeId } from '../types/chord-canonical';

export type Interval = 0|1|2|3|4|5|6|7|8|9|10|11;

export interface RecipeDef {
  id: RecipeId;
  intervals: Interval[]; // tính từ root, mod 12
  short: string;         // nhãn ngắn để hiển thị (C + short)
  description?: string;
}

const M = (n: number) => (n % 12) as Interval; // mod-12 helper

export const RECIPES: Record<RecipeId, RecipeDef> = {
  // --- Triads ---
  maj:  { id:'maj',  intervals:[0,4,7], short:'',    description:'major' },
  m:    { id:'m',    intervals:[0,3,7], short:'m',   description:'minor' },
  dim:  { id:'dim',  intervals:[0,3,6], short:'dim' },
  aug:  { id:'aug',  intervals:[0,4,8], short:'aug' },
  sus2: { id:'sus2', intervals:[0,2,7], short:'sus2' },
  sus4: { id:'sus4', intervals:[0,5,7], short:'sus4' },
  5:    { id:'5',    intervals:[0,7],   short:'5' },

  // --- Sevenths ---
  '7':   { id:'7',   intervals:[0,4,7,10], short:'7' },
  M7:    { id:'M7',  intervals:[0,4,7,11], short:'M7' },
  m7:    { id:'m7',  intervals:[0,3,7,10], short:'m7' },
  dim7:  { id:'dim7',intervals:[0,3,6,9],  short:'dim7' },
  m7b5:  { id:'m7b5',intervals:[0,3,6,10], short:'m7b5' },
  aug7:  { id:'aug7',intervals:[0,4,8,10], short:'aug7' },
  '7b5': { id:'7b5', intervals:[0,4,6,10], short:'7b5' },
  '7#5': { id:'7#5', intervals:[0,4,8,10], short:'7#5' },
  '7b9': { id:'7b9', intervals:[0,4,7,10,M(13)], short:'7b9' },
  '7#9': { id:'7#9', intervals:[0,4,7,10,M(15)], short:'7#9' },

  // --- 9/11/13 ---
  '9':   { id:'9',   intervals:[0,4,7,10,M(14)], short:'9' },
  M9:    { id:'M9',  intervals:[0,4,7,11,M(14)], short:'M9' },
  m9:    { id:'m9',  intervals:[0,3,7,10,M(14)], short:'m9' },

  '11':  { id:'11',  intervals:[0,4,7,10,M(14),M(17)], short:'11' },
  M11:   { id:'M11', intervals:[0,4,7,11,M(14),M(17)], short:'M11' },
  m11:   { id:'m11', intervals:[0,3,7,10,M(14),M(17)], short:'m11' },

  '13':  { id:'13',  intervals:[0,4,7,10,M(14),M(17),M(21)], short:'13' },
  M13:   { id:'M13', intervals:[0,4,7,11,M(14),M(17),M(21)], short:'M13' },
  m13:   { id:'m13', intervals:[0,3,7,10,M(14),M(17),M(21)], short:'m13' },

  // --- add & 6 ---
  add9:  { id:'add9',  intervals:[0,4,7,M(14)], short:'add9' },
  add11: { id:'add11', intervals:[0,4,7,M(17)], short:'add11' },
  add13: { id:'add13', intervals:[0,4,7,M(21)], short:'add13' },

  '6':   { id:'6',   intervals:[0,4,7,9],  short:'6' },
  m6:    { id:'m6',  intervals:[0,3,7,9],  short:'m6' },
  '6/9': { id:'6/9', intervals:[0,4,7,9,M(14)], short:'6/9' },

  // --- variants ---
  '7sus4':  { id:'7sus4',  intervals:[0,5,7,10],              short:'7sus4' },
  '9sus4':  { id:'9sus4',  intervals:[0,5,7,10,M(14)],        short:'9sus4' },
  '7b13':   { id:'7b13',   intervals:[0,4,7,10,M(20)],        short:'7b13' }, // b13 = 20 mod 12 = 8
  '7#11':   { id:'7#11',   intervals:[0,4,7,10,M(18)],        short:'7#11' }, // #11 = 18 mod 12 = 6
  '7alt':   { id:'7alt',   intervals:[0,4,7,10],              short:'7alt', description:'altered dominant (context-defined)' },
  'maj7#11':{ id:'maj7#11',intervals:[0,4,7,11,M(18)],        short:'maj7#11' },
  'mMaj7':  { id:'mMaj7',  intervals:[0,3,7,11],              short:'mMaj7' },
  'mMaj9':  { id:'mMaj9',  intervals:[0,3,7,11,M(14)],        short:'mMaj9' },
};

export const ALL_RECIPE_IDS = Object.keys(RECIPES) as Array<RecipeId>;
