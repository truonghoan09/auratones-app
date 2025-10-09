// server/routes/chords.js
const express = require("express");
const router = express.Router();
const { db } = require("../firebase");
const auth = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

/**
 * GET /api/chords?instrument=guitar|ukulele|piano
 * Trả về: { instrument, items: ChordEntry[] }
 */
router.get("/", async (req, res) => {
  try {
    const qIns = String(req.query.instrument || "guitar").toLowerCase();
    const instrument = ["guitar", "ukulele", "piano"].includes(qIns) ? qIns : "guitar";

    const col = db.collection("chords_system");
    let snap = await col.where("instrument", "==", instrument).get();

    if (snap.empty) {
      const all = await col.get();
      const filtered = all.docs.filter((d) => {
        const data = d.data() || {};
        return (data.instrument || "").toLowerCase() === instrument;
      });
      snap = { docs: filtered };
    }

    const items = [];
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const norm = normalizeDocToChordEntry(data, instrument);
      if (norm) {
        // KHÔNG còn attach defaultSort; FE sẽ tự sắp theo baseFret
        if (data.likesCountByFp && typeof data.likesCountByFp === "object") {
          norm.likesCountByFp = data.likesCountByFp;
        }
        items.push(norm);
      }
    }

    res.json({ instrument, items });
  } catch (e) {
    console.error("[GET /api/chords] error:", e);
    res.status(500).json({ error: e?.message || "internal error" });
  }
});

/**
 * POST /api/chords/postChord
 * - Clone enharmonic counterpart nếu có (C#xxx <-> Dbxxx)
 * - Cả hai doc dùng chung canonical (recipeId…)
 * - Merge variants; KHÔNG còn ensure defaultSort
 */
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

    const primaryId = normalizeId(incoming.instrument, incoming.symbol);
    const altSymbol = getEnharmonicSymbol(incoming.symbol);
    const hasAlt = !!altSymbol;
    const altId = hasAlt ? normalizeId(incoming.instrument, altSymbol) : null;

    const col = db.collection("chords_system");

    const [primarySnap, altSnap] = await Promise.all([
      col.doc(primaryId).get(),
      hasAlt ? col.doc(altId).get() : Promise.resolve({ exists: false, data: () => ({}) }),
    ]);

    const existingPrimary = primarySnap.exists ? (primarySnap.data() || {}) : {};
    const existingAlt = hasAlt && altSnap.exists ? (altSnap.data() || {}) : {};

    const prevVariants = Array.isArray(existingPrimary.variants) ? existingPrimary.variants : [];
    const prevFPs = new Set(prevVariants.map((v) => variantFingerprintRelaxed(v)));
    const incomingWithFP = incoming.variants.map((v) => ({ v, fp: variantFingerprintRelaxed(v) }));
    const duplicateMatches = incomingWithFP.filter((x) => prevFPs.has(x.fp)).map((x) => x.fp);

    if (duplicateMatches.length > 0 && !isConfirm) {
      return res.status(409).json({
        ok: false,
        duplicate: true,
        message: "Voicing trùng với dữ liệu đã có. Xác nhận để vẫn lưu?",
        matches: duplicateMatches,
      });
    }

    const mergedVariants = (isConfirm
      ? [...prevVariants, ...incoming.variants]
      : mergeVariants(prevVariants, incoming.variants)
    ).map(sanitizeStringInstrumentVariant);

    const primaryAliases = uniqueArray(
      [
        ...(Array.isArray(existingPrimary.aliases) ? existingPrimary.aliases : []),
        hasAlt ? altSymbol : null,
      ].filter(Boolean)
    );

    const altAliases = hasAlt
      ? uniqueArray(
          [
            ...(Array.isArray(existingAlt.aliases) ? existingAlt.aliases : []),
            incoming.symbol,
          ].filter(Boolean)
        )
      : [];

    const payloadPrimary = {
      instrument: incoming.instrument,
      symbol: incoming.symbol,
      aliases: primaryAliases,
      ...(incoming.canonical ? { canonical: sanitizeCanonical(incoming.canonical) } : {}),
      variants: mergedVariants,
      updatedAt: new Date(),
    };

    const payloadAlt = hasAlt
      ? {
          instrument: incoming.instrument,
          symbol: altSymbol,
          aliases: altAliases,
          ...(incoming.canonical ? { canonical: sanitizeCanonical(incoming.canonical) } : {}),
          variants: mergedVariants,
          updatedAt: new Date(),
        }
      : null;

    const writes = [col.doc(primaryId).set(payloadPrimary, { merge: true })];
    if (hasAlt && payloadAlt) {
      writes.push(col.doc(altId).set(payloadAlt, { merge: true }));
    }
    await Promise.all(writes);

    /* ===================== AUTOGEN MOVABLE TWO-WAY ===================== */
    let autogenSummary = { generatedSymbols: [], totalGeneratedVariants: 0 };
    if (incoming.instrument !== "piano") {
      const movableVariants = (incoming.variants || [])
        .map(sanitizeStringInstrumentVariant)
        .filter(isMovableVariant);

      if (movableVariants.length > 0) {
        const parsed = parseSymbol(incoming.symbol);
        if (parsed) {
          const { root: fromRoot, tail } = parsed;
          const targetSymbols = buildAllTargetSymbols(fromRoot, tail);

          const perSymbol = {};
          for (const target of targetSymbols) {
            const chosen = chooseOffsetBidirectional(fromRoot, target.root, movableVariants);
            if (chosen == null) continue;
            const { offset } = chosen;

            for (const v of movableVariants) {
              let tv = transposeVariantSemitone(v, offset);
              if (!tv) continue;

              const minPos = effectiveLowestFret(tv);
              if (!(minPos >= 1 && minPos <= 11)) continue;

              tv.baseFret = minPos;
              tv.gridFrets = computeGridFrets(tv);
              tv.name = formatVariantName(`${target.root}${tail}`, tv.baseFret);

              const dstSymbol = `${target.root}${tail}`;
              perSymbol[dstSymbol] = perSymbol[dstSymbol] || [];
              perSymbol[dstSymbol].push(tv);
            }
          }

          const writeTasks = [];
          const generatedSymbols = [];

          for (const dstSymbol of Object.keys(perSymbol)) {
            const dstId = normalizeId(incoming.instrument, dstSymbol);
            const dstDocRef = col.doc(dstId);
            const dstSnap = await dstDocRef.get();
            const dstData = dstSnap.exists ? (dstSnap.data() || {}) : {};
            const dstPrev = Array.isArray(dstData.variants) ? dstData.variants : [];

            const merged = mergeVariants(dstPrev, perSymbol[dstSymbol]).map(sanitizeStringInstrumentVariant);
            if (merged.length === dstPrev.length) continue;

            generatedSymbols.push(dstSymbol);

            writeTasks.push(
              dstDocRef.set(
                {
                  instrument: incoming.instrument,
                  symbol: dstSymbol,
                  aliases: Array.isArray(dstData.aliases) ? dstData.aliases : [],
                  ...(incoming.canonical ? { canonical: sanitizeCanonical(incoming.canonical) } : {}),
                  variants: merged,
                  updatedAt: new Date(),
                },
                { merge: true }
              )
            );

            const altForDst = getEnharmonicSymbol(dstSymbol);
            if (altForDst) {
              const altDstId = normalizeId(incoming.instrument, altForDst);
              writeTasks.push(
                db.collection("chords_system").doc(altDstId).set(
                  {
                    instrument: incoming.instrument,
                    symbol: altForDst,
                    aliases: uniqueArray([
                      ...(Array.isArray(dstData.aliases) ? dstData.aliases : []),
                      dstSymbol,
                    ]),
                    ...(incoming.canonical ? { canonical: sanitizeCanonical(incoming.canonical) } : {}),
                    variants: merged,
                    updatedAt: new Date(),
                  },
                  { merge: true }
                )
              );
            }
          }

          if (writeTasks.length > 0) {
            await Promise.all(writeTasks);
            autogenSummary = {
              generatedSymbols,
              totalGeneratedVariants: Object.values(perSymbol).reduce((acc, arr) => acc + arr.length, 0),
            };
          }
        }
      }
    }
    /* =================== HẾT AUTOGEN =================== */

    const savedPrimary = await col.doc(primaryId).get();
    const resp = {
      ok: true,
      message: hasAlt ? "Voicing saved (+enharmonic clone)" : "Voicing saved",
      item: savedPrimary.data(),
      ...(hasAlt ? { enharmonicCloned: altSymbol } : {}),
      ...(autogenSummary.totalGeneratedVariants > 0 ? { autogen: autogenSummary } : {}),
    };
    return res.status(201).json(resp);
  } catch (e) {
    console.error("[POST /api/chords/postChord] error:", e);
    return res.status(500).json({ error: e?.message || "internal error" });
  }
});

/**
 * DELETE /api/chords/voicing
 * Body: {
 *   instrument, symbol, variant,
 *   scope?: "single" | "shape+fingers" (mặc định "single"),
 *   visibility?: "system" | "private" (mặc định "system")
 * }
 * - Chỉ admin được xoá trên "system"; user thường chỉ xoá "private"
 * - Dùng FINGERPRINT NỚI LỎNG để khớp trong doc hiện tại
 * - scope="shape+fingers": xoá các voicing có cùng shape invariant + cùng fingers pattern
 */
router.delete("/voicing", auth, async (req, res) => {
  try {
    const { instrument, symbol, variant } = req.body || {};
    const scope = (req.body?.scope || "single");
    const visibility = (req.body?.visibility || "system");

    if (!["guitar", "ukulele", "piano"].includes(String(instrument))) {
      return res.status(400).json({ error: "instrument must be guitar|ukulele|piano" });
    }
    if (!symbol || !variant || typeof variant !== "object") {
      return res.status(400).json({ error: "symbol & variant are required" });
    }

    // quyền: nếu visibility=system → cần admin
    if (visibility === "system") {
      const user = req.user || {};
      if (!user?.role || user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: chỉ admin được xoá ở kho hệ thống." });
      }
    }

    const id = normalizeId(instrument, symbol);
    const col = db.collection("chords_system");
    const snap = await col.doc(id).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Không tìm thấy hợp âm cần xoá." });
    }
    const data = snap.data() || {};
    const prev = Array.isArray(data.variants) ? data.variants : [];

    // 🔧 Dùng relaxed fingerprint cho xoá trực tiếp
    const targetSan = sanitizeStringInstrumentVariant(variant);
    const targetFP = variantFingerprintRelaxed(targetSan);

    let nextVariants = prev.filter((v) => variantFingerprintRelaxed(v) !== targetFP);
    let removedHere = prev.length - nextVariants.length;

    // scope "shape+fingers": xoá thêm các biến thể cùng shape invariant + cùng fingers pattern
    let cascadeStats = { affectedDocs: 0, removedVariants: 0 };
    if (scope === "shape+fingers" && instrument !== "piano") {
      const targetSig = shapeSignatureInvariant(targetSan);
      const targetFingers = fingersPattern(targetSan);

      // quét toàn bộ doc của instrument này
      let snapAll = await col.where("instrument", "==", instrument).get();

      if (snapAll.empty) {
        const all = await col.get();
        const filtered = all.docs.filter((d) => {
          const dat = d.data() || {};
          return (dat.instrument || "").toLowerCase() === instrument;
        });
        snapAll = { docs: filtered };
      }

      const batchWrites = [];
      for (const doc of snapAll.docs) {
        const d = doc.data() || {};
        const variants = Array.isArray(d.variants) ? d.variants : [];
        if (variants.length === 0) continue;

        const kept = [];
        let removed = 0;
        for (const v of variants) {
          const sig = shapeSignatureInvariant(v);
          const fpFingers = fingersPattern(v);
          if (sig === targetSig && fpFingers === targetFingers) {
            removed += 1;
          } else {
            kept.push(v);
          }
        }

        if (removed > 0) {
          batchWrites.push(
            col.doc(doc.id).set(
              { variants: kept, updatedAt: new Date() },
              { merge: true }
            )
          );
          cascadeStats.affectedDocs += 1;
          cascadeStats.removedVariants += removed;
        }
      }

      if (batchWrites.length > 0) {
        await Promise.all(batchWrites);
      }
    } else {
      // chỉ xoá tại doc hiện tại
      if (removedHere > 0) {
        await col.doc(id).set(
          { variants: nextVariants, updatedAt: new Date() },
          { merge: true }
        );
      }
    }

    // Xoá đồng bộ ở doc enharmonic (nếu có) cùng FP
    let removedInEnh = 0;
    const altSymbol = getEnharmonicSymbol(symbol);
    if (altSymbol) {
      const altId = normalizeId(instrument, altSymbol);
      const altSnap = await col.doc(altId).get();
      if (altSnap.exists) {
        const altData = altSnap.data() || {};
        const altPrev = Array.isArray(altData.variants) ? altData.variants : [];

        const altNext = altPrev.filter((v) => variantFingerprintRelaxed(v) !== targetFP);
        removedInEnh = altPrev.length - altNext.length;

        if (removedInEnh > 0) {
          await col.doc(altId).set(
            { variants: altNext, updatedAt: new Date() },
            { merge: true }
          );
        }
      }
    }

    return res.json({
      ok: true,
      message:
        scope === "shape+fingers"
          ? "Đã xoá voicing (bao gồm các bản cùng form + fingers)."
          : (removedHere > 0 ? "Đã xoá voicing." : "Không tìm thấy voicing cần xoá."),
      removedHere,
      removedInEnh,
      ...(scope === "shape+fingers" ? { cascade: cascadeStats } : {}),
    });
  } catch (e) {
    console.error("[DELETE /api/chords/voicing] error:", e);
    return res.status(500).json({ error: e?.message || "internal error" });
  }
});

/* ====================== LIKE APIs (chung routes/chords) ====================== */

/**
 * GET /api/chords/voicing/likes?instrument=&symbol=
 * -> { countsByFp: Record<fp, number>, userLikesFpToTs: Record<fp, millis> }
 */
router.get("/voicing/likes", auth, async (req, res) => {
  try {
    const instrument = String(req.query.instrument || "").toLowerCase();
    const symbol = String(req.query.symbol || "").trim();
    if (!["guitar", "ukulele", "piano"].includes(instrument) || !symbol) {
      return res.status(400).json({ error: "invalid instrument or symbol" });
    }
    const id = normalizeId(instrument, symbol);
    const col = db.collection("chords_system");
    const snap = await col.doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: "Not found" });
    const data = snap.data() || {};
    const countsByFp = typeof data.likesCountByFp === "object" && data.likesCountByFp ? data.likesCountByFp : {};

    const user = req.user || {};
    const uid = user?.uid;
    let userLikesFpToTs = {};
    if (uid) {
      const userLikesCol = db.collection("users").doc(uid).collection("likes");
      const likesSnap = await userLikesCol.where("chordKey", "==", id).get();
      userLikesFpToTs = {};
      likesSnap.forEach((d) => {
        const dd = d.data() || {};
        if (dd.fp) userLikesFpToTs[dd.fp] = dd.likedAt?.toMillis?.() || dd.likedAt || 0;
      });
    }

    return res.json({ countsByFp, userLikesFpToTs });
  } catch (e) {
    console.error("[GET /voicing/likes] error:", e);
    return res.status(500).json({ error: e?.message || "internal error" });
  }
});

/**
 * POST /api/chords/voicing/like
 * Body: { instrument, symbol, variant }
 * Toggle like/unlike cho user hiện tại; cập nhật likesCountByFp trong doc
 */
router.post("/voicing/like", auth, async (req, res) => {
  try {
    const { instrument, symbol, variant } = req.body || {};
    if (!["guitar", "ukulele", "piano"].includes(String(instrument))) {
      return res.status(400).json({ error: "instrument must be guitar|ukulele|piano" });
    }
    if (!symbol || !variant || typeof variant !== "object") {
      return res.status(400).json({ error: "symbol & variant are required" });
    }
    const user = req.user || {};
    const uid = user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const id = normalizeId(instrument, symbol);
    const col = db.collection("chords_system");
    const snap = await col.doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: "Not found" });

    const vSan = sanitizeStringInstrumentVariant(variant);
    const fp = variantFingerprintRelaxed(vSan);

    const userLikesRef = db.collection("users").doc(uid).collection("likes");
    const likeDocId = `${id}__${fp}`;
    const likeRef = userLikesRef.doc(likeDocId);
    const chordRef = col.doc(id);

    let liked = false;
    let likedAtMs = 0;
    let count = 0;

    await db.runTransaction(async (tx) => {
      const chordDoc = await tx.get(chordRef);
      const d = chordDoc.data() || {};
      const countsByFp = typeof d.likesCountByFp === "object" && d.likesCountByFp ? d.likesCountByFp : {};
      let prev = Number(countsByFp[fp] || 0);

      const likeDoc = await tx.get(likeRef);
      if (likeDoc.exists) {
        // unlike
        tx.delete(likeRef);
        prev = Math.max(0, prev - 1);
        liked = false;
        likedAtMs = 0;
      } else {
        // like
        const now = new Date();
        tx.set(likeRef, { chordKey: id, instrument, symbol, fp, likedAt: now }, { merge: true });
        prev = prev + 1;
        liked = true;
        likedAtMs = now.getTime();
      }

      countsByFp[fp] = prev;
      count = prev;
      tx.set(chordRef, { likesCountByFp: countsByFp, updatedAt: new Date() }, { merge: true });
    });

    return res.json({ liked, likedAt: likedAtMs, count });
  } catch (e) {
    console.error("[POST /voicing/like] error:", e);
    return res.status(500).json({ error: e?.message || "internal error" });
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
    keys: Array.isArray(v?.keys) ? v.keys.map((n) => asInt(n, null)).filter(isNumber) : [],
    pcs: Array.isArray(v?.pcs) ? v.pcs.map((n) => asInt(n, null)).filter(isNumber) : [],
    bass: asInt(v?.bass, null),
    bassLabel: isString(v?.bassLabel) ? v.bassLabel : null,
    verified: v?.verify ?? null,
  };
}

/* ----- GUITAR / UKULELE ----- */
function mapStringInstrumentVariant(v) {
  const frets = Array.isArray(v?.frets) ? v.frets.map((n) => asInt(n, 0)) : [];

  const barres = Array.isArray(v?.barres)
    ? v.barres
        .map((b) => ({
          fret: asInt(b?.fret, null),
          from: asInt(b?.from, null),
          to: asInt(b?.to, null),
          finger: isNumber(b?.finger) ? b.finger : undefined,
        }))
        .filter((b) => isNumber(b.fret) && isNumber(b.from) && isNumber(b.to))
    : undefined;

  const fingers = Array.isArray(v?.fingers) ? v.fingers.map((n) => asInt(n, null)) : undefined;

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
function isNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}
function isString(x) {
  return typeof x === "string" && x.length > 0;
}
function asInt(x, def) {
  const n = Number.parseInt(x, 10);
  return Number.isFinite(n) ? n : def;
}

function uniqueArray(arr) {
  return Array.from(new Set(arr));
}

/* ============ Helpers cho POST /postChord (giữ + mở rộng) ============ */

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
  for (const v of Array.isArray(incoming) ? incoming : []) {
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
    ? v.barres.map((b) =>
        `${asInt(b?.fret, -1)}:${asInt(b?.from, -1)}:${asInt(b?.to, -1)}:${
          isNumber(b?.finger) ? b.finger : "-"
        }`
      )
    : [];
  const baseFret = asInt(v?.baseFret, 1);
  const gridFrets = asInt(v?.gridFrets, 4);
  return JSON.stringify({ frets, fingers, barres, baseFret, gridFrets });
}

/** Fingerprint “nới lỏng” cho check trùng & xoá */
function variantFingerprintRelaxed(v) {
  const frets = Array.isArray(v?.frets) ? v.frets.map((n) => asInt(n, 0)) : [];

  const normBarres = Array.isArray(v?.barres)
    ? v.barres.map((b) => {
        const fret = asInt(b?.fret, -1);
        const from = asInt(b?.from, -1);
        const to = asInt(b?.to, -1);
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        const finger = isNumber(b?.finger) ? b.finger : null;
        return { fret, from: lo, to: hi, finger };
      })
    : [];

  const fgs = Array.isArray(v?.fingers) ? v.fingers.map((n) => asInt(n, 0)) : [];
  const normFingers = fgs.length > 0 && fgs.every((n) => n === 0) ? [] : fgs;

  return JSON.stringify({ frets, barres: normBarres, fingers: normFingers });
}

function sanitizeCanonical(c) {
  const out = {};
  const rootPc = asInt(c?.rootPc, null);
  if (isNumber(rootPc)) out.rootPc = rootPc;
  if (isString(c?.recipeId)) out.recipeId = c.recipeId;
  if (isNumber(c?.bassPc)) out.bassPc = c.bassPc;
  if (typeof c?.useSlash === "boolean") out.useSlash = !!c?.useSlash;
  return out;
}

function sanitizeStringInstrumentVariant(v) {
  const frets = Array.isArray(v?.frets) ? v.frets.map((n) => asInt(n, 0)) : [];

  const base = {
    baseFret: asInt(v?.baseFret, 1),
    gridFrets: asInt(v?.gridFrets, 4),
    frets,
  };

  if (Array.isArray(v?.fingers)) {
    const fingers = v.fingers.map((n) => asInt(n, 0));
    base.fingers = fingers;
  }

  if (Array.isArray(v?.barres)) {
    const barres = v.barres
      .map((b) => ({
        fret: asInt(b?.fret, null),
        from: asInt(b?.from, null),
        to: asInt(b?.to, null),
        finger: isNumber(b?.finger) ? b.finger : undefined,
      }))
      .filter((b) => isNumber(b.fret) && isNumber(b.from) && isNumber(b.to));
    if (barres.length) base.barres = barres;
  }

  if (isNumber(v?.rootString)) base.rootString = v.rootString;
  if (isNumber(v?.rootFret)) base.rootFret = v.rootFret;
  if (isString(v?.name)) base.name = v.name;

  return base;
}

/* --------- Enharmonic helpers --------- */

const ENHARMONIC_MAP = {
  "C#": "Db",
  "Db": "C#",
  "D#": "Eb",
  "Eb": "D#",
  "F#": "Gb",
  "Gb": "F#",
  "G#": "Ab",
  "Ab": "G#",
  "A#": "Bb",
  "Bb": "A#",
};

function getEnharmonicSymbol(symbol) {
  const m = /^([A-G][#b])(.+)?$/i.exec(String(symbol || "").trim());
  if (!m) return null;
  let root = m[1];
  root = root.charAt(0).toUpperCase() + root.slice(1);
  const rest = m[2] || "";
  const altRoot = ENHARMONIC_MAP[root];
  return altRoot ? `${altRoot}${rest}` : null;
}

/* ======== AUTOGEN & TRANSPOSE HELPERS ======== */

const NOTE_TO_PC = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4,
  F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
};

function parseSymbol(symbol) {
  const m = /^([A-Ga-g](?:#|b)?)(.*)$/i.exec(String(symbol || "").trim());
  if (!m) return null;
  let root = m[1];
  const tail = m[2] || "";
  root = root.charAt(0).toUpperCase() + root.slice(1);
  return { root, tail };
}

function buildAllTargetSymbols(fromRoot, tail) {
  const rootsPrefSharp = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  return rootsPrefSharp.filter((r) => r !== fromRoot).map((r) => ({ root: r, symbol: `${r}${tail}` }));
}

function semitoneOffset(fromRoot, toRoot) {
  const a = NOTE_TO_PC[fromRoot];
  const b = NOTE_TO_PC[toRoot];
  if (!isNumber(a) || !isNumber(b)) return 0;
  return (b - a + 12) % 12;
}

function barreFretForString(variant, stringIdx1Based) {
  const barres = Array.isArray(variant?.barres) ? variant.barres : [];
  let f = null;
  for (const b of barres) {
    const from = asInt(b?.from, null);
    const to = asInt(b?.to, null);
    const fret = asInt(b?.fret, null);
    if (!isNumber(from) || !isNumber(to) || !isNumber(fret)) continue;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    if (stringIdx1Based >= lo && stringIdx1Based <= hi) {
      f = Math.min(f == null ? fret : f, fret);
    }
  }
  return f;
}

function hasRealOpenString(variant) {
  const frets = Array.isArray(variant?.frets) ? variant.frets : [];
  for (let i = 0; i < frets.length; i++) {
    if (frets[i] === 0) {
      const coveredAt = barreFretForString(variant, i + 1);
      if (!isNumber(coveredAt)) return true;
    }
  }
  return false;
}

function isMovableVariant(variant) {
  const frets = Array.isArray(variant?.frets) ? variant.frets : [];
  if (frets.length === 0) return false;
  if (hasRealOpenString(variant)) return false;
  const anyPressed =
    frets.some((f) => f > 0) ||
    (Array.isArray(variant?.barres) && variant.barres.length > 0);
  return anyPressed;
}

function transposeVariantSemitone(variant, offset) {
  const v = sanitizeStringInstrumentVariant(variant);
  const srcFrets = Array.isArray(v.frets) ? v.frets : [];
  if (srcFrets.length === 0) return null;

  const dstFrets = srcFrets.map((f) => (f > 0 ? f + offset : f));

  const dstBarres = Array.isArray(v.barres)
    ? v.barres.map((b) => ({
        ...b,
        fret: isNumber(b?.fret) ? b.fret + offset : b.fret,
      }))
    : undefined;

  const dstRootFret =
    isNumber(v.rootFret) && v.rootFret > 0 ? v.rootFret + offset : v.rootFret;

  return {
    ...v,
    frets: dstFrets,
    ...(dstBarres ? { barres: dstBarres } : {}),
    ...(isNumber(dstRootFret) ? { rootFret: dstRootFret } : {}),
  };
}

function effectiveLowestFret(variant) {
  const frets = Array.isArray(variant?.frets) ? variant.frets : [];
  const positives = frets.filter((f) => isNumber(f) && f > 0);
  let min = positives.length ? Math.min(...positives) : Infinity;

  let hasZeroCovered = false;
  let minBarre = Infinity;
  for (let i = 0; i < frets.length; i++) {
    if (frets[i] === 0) {
      const bf = barreFretForString(variant, i + 1);
      if (isNumber(bf)) {
        hasZeroCovered = true;
        if (bf < minBarre) minBarre = bf;
      }
    }
  }
  if (hasZeroCovered && isNumber(minBarre) && minBarre !== Infinity) {
    min = Math.min(min, minBarre);
  }
  return min;
}

function usedFretValues(variant) {
  const frets = Array.isArray(variant?.frets) ? variant.frets : [];
  const out = [];
  for (let i = 0; i < frets.length; i++) {
    const f = frets[i];
    if (f > 0) out.push(f);
    else if (f === 0) {
      const bf = barreFretForString(variant, i + 1);
      if (isNumber(bf)) out.push(bf);
    }
  }
  const barres = Array.isArray(variant?.barres) ? variant.barres : [];
  for (const b of barres) {
    if (isNumber(b?.fret)) out.push(b.fret);
  }
  return out;
}

function computeGridFrets(variant) {
  const base = asInt(variant?.baseFret, 1);
  const used = usedFretValues(variant);
  if (used.length === 0) return Math.max(4, asInt(variant?.gridFrets, 4) || 4);
  const maxUsed = Math.max(...used);
  const span = Math.max(1, maxUsed - base + 1);
  return Math.max(4, span);
}

function formatVariantName(symbol, baseFret) {
  const bf = isNumber(baseFret) ? baseFret : 1;
  return `${symbol}@${bf}`;
}

function chooseOffsetBidirectional(fromRoot, toRoot, sampleVariants) {
  const up = semitoneOffset(fromRoot, toRoot);
  const down = up - 12;
  const candidates = [];

  for (const off of [up, down]) {
    let okCount = 0;
    let bestMin = Infinity;
    for (const v of sampleVariants) {
      const tv = transposeVariantSemitone(v, off);
      if (!tv) continue;
      const minPos = effectiveLowestFret(tv);
      if (minPos >= 1 && minPos <= 11) {
        okCount += 1;
        if (minPos < bestMin) bestMin = minPos;
      }
    }
    candidates.push({ offset: off, valid: okCount > 0, okCount, bestMin });
  }

  const valid = candidates.filter((c) => c.valid);
  if (valid.length === 0) return null;
  valid.sort((a, b) => {
    const absdiff = Math.abs(a.offset) - Math.abs(b.offset);
    if (absdiff !== 0) return absdiff;
    return a.bestMin - b.bestMin;
  });
  return valid[0];
}

/* ======== SHAPE SIGNATURE INVARIANT (cho cascade delete) ======== */
function shapeSignatureInvariant(v0) {
  const v = sanitizeStringInstrumentVariant(v0);
  const frets = Array.isArray(v.frets) ? v.frets : [];
  const anchor0 = effectiveLowestFret(v);
  const anchor = Number.isFinite(anchor0) ? anchor0 : 0;

  const relFrets = [];
  for (let i = 0; i < frets.length; i++) {
    const f = frets[i];
    if (f > 0) {
      relFrets.push(f - anchor);
    } else if (f === 0) {
      const bf = barreFretForString(v, i + 1);
      if (isNumber(bf)) relFrets.push(bf - anchor);
      else relFrets.push(-1);
    } else {
      relFrets.push(-1);
    }
  }

  const relBarres = Array.isArray(v.barres)
    ? v.barres
        .map((b) => ({
          fret: isNumber(b?.fret) ? b.fret - anchor : null,
          from: asInt(b?.from, null),
          to: asInt(b?.to, null),
        }))
        .filter((x) => isNumber(x.fret) && isNumber(x.from) && isNumber(x.to))
        .sort((a, b) => (a.fret - b.fret) || (a.from - b.from) || (a.to - b.to))
    : [];

  const rootString = isNumber(v.rootString) ? v.rootString : null;

  return JSON.stringify({ relFrets, relBarres, rootString });
}

/** pattern ngón tay (nới lỏng, 0-array -> rỗng) để so khớp "shape+fingers" */
function fingersPattern(v0) {
  const v = sanitizeStringInstrumentVariant(v0);
  const fgs = Array.isArray(v.fingers) ? v.fingers.map((n) => asInt(n, 0)) : [];
  const norm = fgs.length > 0 && fgs.every((n) => n === 0) ? [] : fgs;
  return JSON.stringify(norm);
}
