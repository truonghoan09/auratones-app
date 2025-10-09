export function asInt(x: any, def: number) {
  const n = Number.parseInt(x, 10);
  return Number.isFinite(n) ? n : def;
}
export function isNumber(x: any) {
  return typeof x === "number" && Number.isFinite(x);
}

/** bản FE cần khớp BE */
export function variantFingerprintRelaxed(v: any) {
  const frets = Array.isArray(v?.frets) ? v.frets.map((n: any) => asInt(n, 0)) : [];
  const normBarres = Array.isArray(v?.barres)
    ? v.barres.map((b: any) => {
        const fret = asInt(b?.fret, -1);
        const from = asInt(b?.from, -1);
        const to = asInt(b?.to, -1);
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        const finger = isNumber(b?.finger) ? b.finger : null;
        return { fret, from: lo, to: hi, finger };
      })
    : [];
  const fgs = Array.isArray(v?.fingers) ? v.fingers.map((n: any) => asInt(n, 0)) : [];
  const normFingers = fgs.length > 0 && fgs.every((n: number) => n === 0) ? [] : fgs;
  return JSON.stringify({ frets, barres: normBarres, fingers: normFingers });
}
