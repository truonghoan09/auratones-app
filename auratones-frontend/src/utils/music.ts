// Nhỏ gọn: helper nhạc lý & mapping đơn vị nốt

export type NoteUnit =
  | "1" | "2" | "4" | "8" | "16" | "32"
  | "4." | "8.";

export const unitLenVsQuarter = (u: NoteUnit): number => {
  switch (u) {
    case "1": return 4;
    case "2": return 2;
    case "4": return 1;
    case "8": return 0.5;
    case "16": return 0.25;
    case "32": return 0.125;
    case "4.": return 1.5;
    case "8.": return 0.75;
    default:  return 1;
  }
};

export const displayBpm = (tempoQuarter: number, unit: NoteUnit) =>
  Math.round(tempoQuarter / unitLenVsQuarter(unit));

export const toQuarterBpm = (bpmShown: number, unit: NoteUnit) =>
  bpmShown * unitLenVsQuarter(unit);

export const unitIcon = (u: NoteUnit) => {
  switch (u) {
    case "1":  return "𝅝";
    case "2":  return "𝅗𝅥";
    case "4":  return "♩";
    case "8":  return "♪";
    case "16": return "♬";
    case "32": return "♬♬";
    case "4.": return "♩.";
    case "8.": return "♪.";
    default:   return "♩";
  }
};

export const clampTempoQuarter = (t: number) =>
  Math.max(20, Math.min(300, t));

/* Accent mặc định theo chỉ nhịp “thực hành”:
   - Simple: phách 1 mạnh (3), còn lại yếu (1)
   - Compound x/8 chia nhóm 3 nốt 8: 6/8 = [3,1,1,2,1,1], 9/8 = [3,1,1,2,1,1,2,1,1]...
   - 2/2 (cut): nhấn 2 phách lớn
*/
export const defaultAccentForTimeSig = (top: number, bottom: number): number[] => {
  if (!top || !bottom) return [3,1,2,1].slice(0, Math.max(2, top||4));
  if (bottom === 8 && top % 3 === 0 && top >= 6) {
    const groups = top / 3;
    const pattern: number[] = [];
    for (let g=0; g<groups; g++) pattern.push( g===0 ? 3 : 2, 1, 1 );
    return pattern;
  }
  if (top === 2 && bottom === 2) return [3,2];
  if (top === 3 && bottom === 4) return [3,1,1];
  if (top === 4 && bottom === 4) return [3,1,2,1];
  return Array.from({length: top}, (_,i)=> (i===0?3:1));
};

/* Gợi ý click unit theo nhịp để thao tác dễ:
   - 6/8, 9/8, 12/8 → dotted quarter (4.)
   - 2/2 (cut)      → quarter vẫn hợp lý (4) cho click đều (tuỳ người), giữ an toàn
   - Mặc định       → quarter
*/
export const suggestedClickUnit = (top: number, bottom: number): NoteUnit => {
  if (bottom === 8 && top % 3 === 0 && top >= 6) return "4.";
  return "4";
};
