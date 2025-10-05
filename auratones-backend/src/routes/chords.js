// routes/chords.js
const express = require("express");
const router = express.Router();
const { db } = require("../firebase");
const auth = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

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

    const col = db.collection("chords_system");

    let snap = await col.where("instrument", "==", instrument).get();
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

/** ====== Lưu voicing (đã có) ====== */
router.post("/postChord", auth, requireAdmin, async (req, res) => {
  try {
    const isPreview = String(req.query.preview || "0") === "1";
    const isConfirm = String(req.query.confirm || "0") === "1";

    const incoming = normalizeIncoming(req.body);

    if (!["guitar", "ukulele", "piano"].includes(incoming.instrument)) {
      return res.status(400).json({ error: "instrument must be guitar|ukulele|piano" });
    }
    if (!incoming.symbol || !Array.isArray(incoming.variants) || incoming.variants.length === 0) {
      return res.status(400).json({ error: "symbol & variants are required" });
    }

    if (isPreview) {
      return res.json({
        ok: true,
        preview: true,
        message: "Preview received (not saved)",
        received: incoming,
      });
    }

    const id = normalizeId(incoming.instrument, incoming.symbol);
    const col = db.collection("chords_system");
    const docRef = col.doc(id);
    const snap = await docRef.get();

    const existing = snap.exists ? (snap.data() || {}) : {};
    const prevVariants = Array.isArray(existing.variants) ? existing.variants : [];

    const prevFPs = new Set(prevVariants.map(v => variantFingerprintRelaxed(v)));
    const incomingWithFP = incoming.variants.map(v => ({ v, fp: variantFingerprintRelaxed(v) }));
    const duplicateMatches = incomingWithFP.filter(x => prevFPs.has(x.fp)).map(x => x.fp);

    if (duplicateMatches.length > 0 && !isConfirm) {
      return res.status(409).json({
        ok: false,
        duplicate: true,
        message: "Voicing trùng với dữ liệu đã có. Xác nhận để vẫn lưu?",
        matches: duplicateMatches,
      });
    }

    let mergedVariants;
    if (isConfirm) {
      mergedVariants = [...prevVariants, ...incoming.variants].map(sanitizeStringInstrumentVariant);
    } else {
      mergedVariants = mergeVariants(prevVariants, incoming.variants)
        .map(sanitizeStringInstrumentVariant);
    }

    const payloadToSave = {
      instrument: incoming.instrument,
      symbol: incoming.symbol,
      aliases: Array.isArray(existing.aliases) ? existing.aliases : [],
      ...(incoming.canonical ? { canonical: sanitizeCanonical(incoming.canonical) } : {}),
      variants: mergedVariants,
      updatedAt: new Date(),
    };

    await docRef.set(payloadToSave, { merge: true });
    const saved = await docRef.get();

    return res.status(201).json({
      ok: true,
      message: "Voicing saved",
      item: saved.data(),
    });
  } catch (e) {
    console.error('[POST /api/chords/postChord] error:', e);
    return res.status(500).json({ error: e?.message || "internal error" });
  }
});

/** ====== NEW: DELETE 1 voicing của 1 chord (admin only) ======
 * DELETE /api/chords/voicing
 * Body JSON:
 *  {
 *    instrument: "guitar"|"ukulele"|"piano",
 *    symbol: string,
 *    byIndex?: number,   // ưu tiên nếu FE truyền index
 *    variant?: any       // nếu không có index, BE sẽ so fingerprintRelaxed để tìm và xoá
 *  }
 */
router.delete("/voicing", auth, requireAdmin, async (req, res) => {
  try {
    const instrument = String(req.body?.instrument || "").toLowerCase();
    const symbol = String(req.body?.symbol || "").trim();
    const byIndex = Number.isFinite(req.body?.byIndex) ? Number(req.body.byIndex) : undefined;
    const variant = req.body?.variant;

    if (!["guitar", "ukulele", "piano"].includes(instrument)) {
      return res.status(400).json({ message: "instrument must be guitar|ukulele|piano" });
    }
    if (!symbol) {
      return res.status(400).json({ message: "symbol is required" });
    }
    if (typeof byIndex !== "number" && !variant) {
      return res.status(400).json({ message: "Need byIndex or variant to delete" });
    }

    const id = normalizeId(instrument, symbol);
    const col = db.collection("chords_system");
    const docRef = col.doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ message: "Chord not found" });
    }

    const data = snap.data() || {};
    const variants = Array.isArray(data.variants) ? data.variants : [];
    if (variants.length === 0) {
      return res.status(404).json({ message: "No voicings to delete" });
    }

    let targetIndex = -1;

    if (typeof byIndex === "number") {
      if (byIndex >= 0 && byIndex < variants.length) {
        targetIndex = byIndex;
      } else {
        return res.status(404).json({ message: "Voicing index out of range" });
      }
    } else if (variant) {
      // so sánh fingerprint nới lỏng để tìm index
      const targetFP = variantFingerprintRelaxed(variant);
      targetIndex = variants.findIndex(v => variantFingerprintRelaxed(v) === targetFP);
      if (targetIndex < 0) {
        return res.status(404).json({ message: "Matching voicing not found" });
      }
    }

    const removed = variants[targetIndex];
    const nextVariants = variants.filter((_, i) => i !== targetIndex);

    await docRef.set(
      {
        variants: nextVariants,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    const updated = await docRef.get();

    return res.json({
      ok: true,
      message: "Voicing deleted",
      removedIndex: targetIndex,
      removed,
      item: updated.data(),
    });
  } catch (e) {
    console.error("[DELETE /api/chords/voicing] error:", e);
    return res.status(500).json({ message: e?.message || "internal error" });
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

  const variants = Array.isArray(data.variants)
    ? data.variants.map(mapStringInstrumentVariant)
    : [];
  return { instrument, symbol, aliases, variants };
}

function getSymbol(data) {
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

/* ============ Helpers cho POST /postChord (bổ sung trong cùng file) ============ */

function normalizeId(instrument, symbol) {
  return `${String(instrument).toLowerCase()}__${String(symbol).trim().toLowerCase()}`;
}

function normalizeIncoming(body) {
  if (body && body.combinedForSubmitPreview) {
    const b = body.combinedForSubmitPreview;
    return {
      instrument: String(b.instrument || "").toLowerCase(),
      symbol: String(b.symbol || "").trim(),
      canonical: b.canonical
        ? {
            rootPc: asInt(b.canonical.rootPc, null),
            recipeId: isString(b.canonical.recipeId) ? b.canonical.recipeId : null,
            bassPc: asInt(b.canonical.bassPc, undefined),
            useSlash: !!b.canonical.useSlash,
          }
        : null,
      variants: Array.isArray(b.variants) ? b.variants : [],
    };
  }

  return {
    instrument: String(body.instrument || "").toLowerCase(),
    symbol: String(body.symbol || "").trim(),
    canonical: body.canonical
      ? {
          rootPc: asInt(body.canonical.rootPc, null),
          recipeId: isString(body.canonical.recipeId) ? body.canonical.recipeId : null,
          bassPc: asInt(body.canonical.bassPc, undefined),
          useSlash: !!body.canonical.useSlash,
        }
      : null,
    variants: Array.isArray(body.variants) ? body.variants : [],
  };
}

function mergeVariants(prev, incoming) {
  const out = [...(Array.isArray(prev) ? prev : [])];
  const seen = new Set(out.map(variantFingerprint));
  for (const v of (Array.isArray(incoming) ? incoming : [])) {
    const fp = variantFingerprint(v);
    if (!seen.has(fp)) {
      out.push(v);
      seen.add(fp);
    }
  }
  return out;
}

function variantFingerprint(v) {
  const frets = Array.isArray(v?.frets) ? v.frets : [];
  const fingers = Array.isArray(v?.fingers) ? v.fingers : [];
  const barres = Array.isArray(v?.barres)
    ? v.barres.map(b => `${asInt(b?.fret, -1)}:${asInt(b?.from, -1)}:${asInt(b?.to, -1)}:${isNumber(b?.finger) ? b.finger : "-"}`)
    : [];
  const baseFret = asInt(v?.baseFret, 1);
  const gridFrets = asInt(v?.gridFrets, 4);
  return JSON.stringify({ frets, fingers, barres, baseFret, gridFrets });
}

/** fingerprint "nới lỏng" cho bước so trùng */
function variantFingerprintRelaxed(v) {
  const frets = Array.isArray(v?.frets) ? v.frets.map(n => asInt(n, 0)) : [];

  const normBarres = Array.isArray(v?.barres)
    ? v.barres.map(b => {
        const fret = asInt(b?.fret, -1);
        const from = asInt(b?.from, -1);
        const to   = asInt(b?.to, -1);
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        const finger = isNumber(b?.finger) ? b.finger : null;
        return { fret, from: lo, to: hi, finger };
      })
    : [];

  const fgs = Array.isArray(v?.fingers) ? v.fingers.map(n => asInt(n, 0)) : [];
  const normFingers = (fgs.length > 0 && fgs.every(n => n === 0)) ? [] : fgs;

  return JSON.stringify({ frets, barres: normBarres, fingers: normFingers });
}

function sanitizeCanonical(c) {
  const out = {};
  const rootPc = asInt(c?.rootPc, null);
  if (isNumber(rootPc)) out.rootPc = rootPc;
  if (isString(c?.recipeId)) out.recipeId = c.recipeId;
  if (isNumber(c?.bassPc)) out.bassPc = c.bassPc;
  if (typeof c?.useSlash === 'boolean') out.useSlash = !!c.useSlash;
  return out;
}

function sanitizeStringInstrumentVariant(v) {
  const frets = Array.isArray(v?.frets) ? v.frets.map(n => asInt(n, 0)) : [];

  const base = {
    baseFret: asInt(v?.baseFret, 1),
    gridFrets: asInt(v?.gridFrets, 4),
    frets,
  };

  if (Array.isArray(v?.fingers)) {
    const fingers = v.fingers.map(n => asInt(n, 0));
    base.fingers = fingers;
  }

  if (Array.isArray(v?.barres)) {
    const barres = v.barres
      .map(b => ({
        fret: asInt(b?.fret, null),
        from: asInt(b?.from, null),
        to: asInt(b?.to, null),
        finger: isNumber(b?.finger) ? b.finger : undefined,
      }))
      .filter(b => isNumber(b.fret) && isNumber(b.from) && isNumber(b.to));
    if (barres.length) base.barres = barres;
  }

  if (isNumber(v?.rootString)) base.rootString = v.rootString;
  if (isNumber(v?.rootFret)) base.rootFret = v.rootFret;
  if (isString(v?.name)) base.name = v.name;

  return base;
}
