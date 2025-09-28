// routes/chords.js
const express = require("express");
const router = express.Router();
const { db } = require("../firebase");

/**
 * GET /api/chords?instrument=guitar|ukulele|piano
 * Trả về: { instrument, items: ChordEntry[] }
 *
 * ChordEntry (khớp FE):
 * {
 *   instrument: "guitar"|"ukulele"|"piano",
 *   symbol: string,
 *   aliases: string[],
 *   variants: any[]   // guitar/ukulele: ChordShape[]; piano: {keys?, pcs?, ...}[]
 * }
 */
router.get("/", async (req, res) => {
  try {
    const qIns = String(req.query.instrument || "guitar").toLowerCase();
    const instrument = ["guitar", "ukulele", "piano"].includes(qIns) ? qIns : "guitar";

    // --- Đọc Firestore ---
    // Gợi ý: dùng collection "chords_system" (đổi nếu bạn đặt tên khác)
    const col = db.collection("chords_system");

    // Ưu tiên filter trên server nếu docs có field 'instrument'
    let snap = await col.where("instrument", "==", instrument).get();

    // Fallback: nếu chưa có field instrument để where, lấy hết rồi lọc
    if (snap.empty) {
      const all = await col.get();
      const filtered = all.docs.filter(d => {
        const data = d.data() || {};
        return (data.instrument || "").toLowerCase() === instrument;
      });
      snap = { docs: filtered };
    }

    const items = [];
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const norm = normalizeDocToChordEntry(data, instrument);
      if (norm) items.push(norm);
    }

    res.json({ instrument, items });
  } catch (e) {
    console.error("[GET /api/chords] error:", e);
    res.status(500).json({ error: e?.message || "internal error" });
  }
});

module.exports = router;

/* ---------------- Helpers ---------------- */

function normalizeDocToChordEntry(data, instrument) {
  const symbol = getSymbol(data);
  if (!symbol) return null;

  const aliases = Array.isArray(data.aliases) ? data.aliases : [];

  if (instrument === "piano") {
    const variants = Array.isArray(data.variants)
      ? data.variants.map(mapPianoVariant)
      : [];
    return { instrument: "piano", symbol, aliases, variants };
  }

  // guitar / ukulele
  const variants = Array.isArray(data.variants)
    ? data.variants.map(mapStringInstrumentVariant)
    : [];
  return { instrument, symbol, aliases, variants };
}

function getSymbol(data) {
  // Ưu tiên field 'symbol' trong document
  if (typeof data.symbol === "string" && data.symbol.trim()) return data.symbol.trim();
  return null;
}

/* ----- PIANO ----- */
function mapPianoVariant(v) {
  return {
    baseKey: asInt(v?.baseKey, null),
    keys: Array.isArray(v?.keys) ? v.keys.map(n => asInt(n, null)).filter(isNumber) : [],
    pcs: Array.isArray(v?.pcs) ? v.pcs.map(n => asInt(n, null)).filter(isNumber) : [],
    bass: asInt(v?.bass, null),
    bassLabel: isString(v?.bassLabel) ? v.bassLabel : null,
    // dữ liệu của bạn có field "verify": null → map gọn thành "verified"
    verified: v?.verify ?? null,
  };
}

/* ----- GUITAR / UKULELE ----- */
function mapStringInstrumentVariant(v) {
  const frets = Array.isArray(v?.frets) ? v.frets.map(n => asInt(n, 0)) : [];

  const barres = Array.isArray(v?.barres)
    ? v.barres.map(b => ({
        fret: asInt(b?.fret, null),
        from: asInt(b?.from, null),
        to: asInt(b?.to, null),
        finger: isNumber(b?.finger) ? b.finger : undefined,
      })).filter(b => isNumber(b.fret) && isNumber(b.from) && isNumber(b.to))
    : undefined;

  const fingers = Array.isArray(v?.fingers)
    ? v.fingers.map(n => asInt(n, null))
    : undefined;

  return {
    baseFret: asInt(v?.baseFret, 1),
    gridFrets: asInt(v?.gridFrets, 4),
    frets,
    rootString: isNumber(v?.rootString) ? v.rootString : undefined,
    rootFret: isNumber(v?.rootFret) ? v.rootFret : undefined,
    fingers,
    barres,
  };
}

/* ----- utils ----- */
function isNumber(x) { return typeof x === "number" && Number.isFinite(x); }
function isString(x) { return typeof x === "string" && x.length > 0; }
function asInt(x, def) {
  const n = Number.parseInt(x, 10);
  return Number.isFinite(n) ? n : def;
}
