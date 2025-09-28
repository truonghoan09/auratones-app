#!/usr/bin/env node
/**
 * Import CAGED seed JSON vào Firestore.
 *
 * - Đầu vào: file JSON từ script generate-caged_voicings.js (mảng ChordEntry)
 * - Ghi vào collection: chords_system (một doc / 1 symbol / instrument)
 * - Id doc: {instrument}__{symbol-encoded}
 * - Upsert (merge) mặc định; có thể --overwrite để thay cả document
 *
 * Cách chạy:
 *   node scripts/import-voicings-to-firestore.js out/guitar_caged_seed.json
 *   node scripts/import-voicings-to-firestore.js out/guitar_caged_seed.json --overwrite
 *   node scripts/import-voicings-to-firestore.js out/guitar_caged_seed.json --dry
 */

const fs = require("fs");
const path = require("path");

// Tái dùng kết nối Firestore sẵn có
// Trong code bạn, ../firebase đã export { db } với firebase-admin firestore
const { db } = require("../src/firebase");

const COLLECTION = process.env.CHORDS_SYSTEM_COLLECTION || "chords_system";

// ============ helpers ============
function usageAndExit() {
  console.log(
    `Usage:
  node scripts/import-voicings-to-firestore.js <input.json> [--overwrite] [--dry]

Options:
  --overwrite   Ghi đè toàn bộ doc (set without merge).
  --dry         Chạy thử, không ghi Firestore.
Env:
  CHORDS_SYSTEM_COLLECTION   (default: chords_system)
`
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args[0]) usageAndExit();

const INPUT = path.resolve(args[0]);
const OVERWRITE = args.includes("--overwrite");
const DRY = args.includes("--dry");

if (!fs.existsSync(INPUT)) {
  console.error("Input file not found:", INPUT);
  process.exit(1);
}

function encodeDocId(symbol, instrument) {
  // Firestore doc id không cho '/', '#', '?', ... — encode gọn:
  //   - giữ chữ/số/_ (word), còn lại chuyển thành '_'
  // NOTE: vẫn muốn phân biệt slash (C/E) → thay bằng double underscore để nhìn ra
  const safeSymbol = symbol.replace(/\//g, "__").replace(/[^\w\-\.]+/g, "_");
  return `${instrument}__${safeSymbol}`;
}

(async function main() {
  let rawBuf = fs.readFileSync(INPUT);
let raw = rawBuf.toString("utf8");

// 1) strip BOM if present
if (raw.charCodeAt(0) === 0xFEFF) {
  raw = raw.slice(1);
}

// 2) trim and try parse; if fail, try to slice between first '[' and last ']'
let data;
try {
  data = JSON.parse(raw);
} catch (_) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    const sliced = raw.slice(start, end + 1);
    try {
      data = JSON.parse(sliced);
    } catch (e2) {
      console.error("Invalid JSON after slicing:", e2.message);
      process.exit(1);
    }
  } else {
    console.error("Invalid JSON: cannot find array brackets [] in input.");
    process.exit(1);
  }
}

  if (!Array.isArray(data)) {
    console.error("Input JSON must be an array of ChordEntry.");
    process.exit(1);
  }

  // Thống kê nhanh
  const byInstrument = {};
  for (const c of data) {
    byInstrument[c.instrument] = (byInstrument[c.instrument] || 0) + 1;
  }
  console.log("[Import] entries by instrument:", byInstrument);

  // Batch write (tối đa 500/commit). Dùng 400 an toàn.
  const MAX_PER_BATCH = 400;
  let batch = db.batch();
  let pending = 0;
  let total = 0;

  async function flush() {
    if (DRY) {
      console.log(`[DRY] skip commit ${pending} writes`);
      pending = 0;
      batch = db.batch();
      return;
    }
    if (pending === 0) return;
    await batch.commit();
    console.log(`Committed batch: ${pending} writes`);
    pending = 0;
    batch = db.batch();
  }

  // Import
  for (const entry of data) {
    const { symbol, instrument, aliases = [], variants = [] } = entry || {};
    if (!symbol || !instrument) continue;

    // đảm bảo variants có form tối thiểu
    const safeVariants = (variants || []).map((v) => {
      const o = { ...v };
      // normalize frets: số nguyên; bảo vệ giá trị lẻ
      if (Array.isArray(o.frets)) {
        o.frets = o.frets.map((x) =>
          typeof x === "number" && Number.isFinite(x) ? Math.trunc(x) : -1
        );
      }
      if (o.baseFret == null) {
        // nếu không có baseFret, lấy min fret dương hoặc 1
        const pos = (o.frets || []).filter((f) => f > 0);
        o.baseFret = pos.length ? Math.min(...pos) : 1;
      }
      // gridFrets fallback
      if (o.gridFrets !== 4 && o.gridFrets !== 5) o.gridFrets = 4;
      // ràng buộc chiều dài frets = 6 (guitar) (nếu khác nhạc cụ bạn mở rộng sau)
      if (instrument === "guitar" && Array.isArray(o.frets) && o.frets.length !== 6) {
        // pad hoặc truncate
        const f = o.frets.slice(0, 6);
        while (f.length < 6) f.push(-1);
        o.frets = f;
      }
      return o;
    });

    const docId = encodeDocId(symbol, instrument);
    const ref = db.collection(COLLECTION).doc(docId);

    const payload = {
      symbol,
      instrument,
      aliases,
      variants: safeVariants,
      // Lưu thêm metadata để trace
      updatedAt: new Date(),
      source: "seed_caged_script",
    };

    if (OVERWRITE) {
      batch.set(ref, payload, { merge: false });
    } else {
      // merge: nếu doc đã tồn tại, chỉ thay các field này
      batch.set(ref, payload, { merge: true });
    }
    pending++;
    total++;

    if (pending >= MAX_PER_BATCH) {
      await flush();
    }
  }

  await flush();

  console.log(`[DONE] Imported ${total} entries into '${COLLECTION}'. DRY=${DRY ? "yes" : "no"} OVERWRITE=${OVERWRITE ? "yes" : "no"}`);
  process.exit(0);
})().catch((e) => {
  console.error("Import error:", e);
  process.exit(1);
});
