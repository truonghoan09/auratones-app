// src/constants/qualityMap.ts
export const QUALITY_MAP = {
  maj:   { text: "",   symbol: "" },
  m:     { text: "m",     symbol: "–" },
  dim:   { text: "dim",   symbol: "°" },
  aug:   { text: "aug",   symbol: "+" },
  "6":   { text: "6",     symbol: "6" },
  m6:    { text: "m6",    symbol: "–6" },
  "6/9": { text: "6/9",   symbol: "M6/9" },
  add9:     { text: "add9",     symbol: "add9" },
  "m(add9)":{ text: "m(add9)",  symbol: "–(add9)" },
  sus2:     { text: "sus2",     symbol: "sus2" },
  sus4:     { text: "sus4",     symbol: "sus4" },
  sus4add9: { text: "sus4add9", symbol: "9sus4" },
  "7":    { text: "7",    symbol: "7" },
  maj7:   { text: "maj7", symbol: "Δ7" },
  m7:     { text: "m7",   symbol: "–7" },
  m7b5:   { text: "m7♭5", symbol: "ø7" },
  dim7:   { text: "dim7", symbol: "°7" },
  "9":    { text: "9",    symbol: "9" },
  m9:     { text: "m9",   symbol: "–9" },
  maj9:   { text: "maj9", symbol: "Δ9" },
  "11":   { text: "11",   symbol: "11" },
  m11:    { text: "m11",  symbol: "–11" },
  "13":   { text: "13",   symbol: "13" },
  m13:    { text: "m13",  symbol: "–13" },
  "7b9":  { text: "7♭9",  symbol: "7♭9" },
  "7#9":  { text: "7♯9",  symbol: "7♯9" },
  "7b5":  { text: "7♭5",  symbol: "7♭5" },
  "7#5":  { text: "7♯5",  symbol: "7♯5" },
  "9b5":  { text: "9♭5",  symbol: "9♭5" },
  "9#5":  { text: "9♯5",  symbol: "9♯5" },
  "13b9": { text: "13♭9", symbol: "13♭9" },
  "13#11":{ text: "13♯11",symbol: "13♯11" },
  "7#11": { text: "7♯11", symbol: "7♯11" },
  "7b13": { text: "7♭13", symbol: "7♭13" },
  "7sus4":{ text: "7sus4",symbol: "7sus4" }
} as const;

// ✅ xuất type từ chính object để tạo union các key/giá trị
export type QualityMap = typeof QUALITY_MAP;
export type QualityKey = keyof QualityMap;
export type QualityValue = QualityMap[QualityKey];
