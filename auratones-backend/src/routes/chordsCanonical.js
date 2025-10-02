// routes/chordsCanonical.js
const express = require("express");
const router = express.Router();
const { db } = require("../firebase");

/**
 * GET /api/chords-canonical
 * Optional:
 *   - minimal=true  -> chỉ trả về {id, pc, recipeId} (nhẹ cho FE)
 *
 * Trả về:
 * {
 *   items: Array<{
 *     id: string;            // ví dụ: "r6__7b13"
 *     pc: number;            // 0..11
 *     recipeId: string;      // ví dụ: "11", "7b13", "maj7#11"...
 *     hasSlash?: boolean;    // nếu có trong doc
 *     symbolDefault?: string;// ví dụ: "C11"
 *     intervals?: number[];  // nếu cần đối chiếu
 *     updatedAt?: string;    // ISO
 *   }>
 * }
 */
router.get("/", async (req, res) => {
  try {
    const minimal = String(req.query.minimal || "false").toLowerCase() === "true";
    const snap = await db.collection("chords_canonical").get();

    const items = snap.docs.map((doc) => {
      const d = doc.data() || {};
      if (minimal) {
        return {
          id: doc.id,
          pc: Number.isFinite(d.pc) ? d.pc : null,
          recipeId: typeof d.recipeId === "string" ? d.recipeId : null,
        };
      }
      return {
        id: doc.id,
        pc: Number.isFinite(d.pc) ? d.pc : null,
        recipeId: typeof d.recipeId === "string" ? d.recipeId : null,
        hasSlash: typeof d.hasSlash === "boolean" ? d.hasSlash : undefined,
        symbolDefault: typeof d.symbolDefault === "string" ? d.symbolDefault : undefined,
        intervals: Array.isArray(d.intervals) ? d.intervals : undefined,
        updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : undefined,
      };
    }).filter(it => it.pc !== null && it.recipeId !== null);

    res.json({ items });
  } catch (e) {
    console.error("[GET /api/chords-canonical] error:", e);
    res.status(500).json({ error: e?.message || "internal error" });
  }
});

module.exports = router;
