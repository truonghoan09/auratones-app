#!/usr/bin/env node
/* eslint-disable no-console */

// scripts/create-canonical.js
/**
 * Create/Upsert canonical chords into Firestore
 *
 * Collection layout (tùy bạn chọn):
 *   1) Top-level:          chords_canonical   (docs: r<pc>__<recipeIdSafe>)
 *   2) 2-part path:        chords_system/canonical  (script sẽ chèn doc giữa là "_meta")
 *   3) 3-part path:        chords_system/<doc>/canonical
 *
 * Doc fields:
 *   pc: number (0..11)
 *   recipeId: string (e.g. "maj", "m7", "13#11", "6/9", ...)
 *   intervals: number[]   // semitones from root (0..11)
 *   symbolDefault: string // "Cmaj7", "F#7b9", ...
 *   hasSlash: false       // no slash trong batch này
 *   createdAt: serverTimestamp on insert
 *   updatedAt: serverTimestamp on each run
 *
 * Usage:
 *   node scripts/create-canonical.js --collection=chords_canonical
 *   node scripts/create-canonical.js --collection=chords_system/canonical
 *   node scripts/create-canonical.js --collection=chords_system/_meta/canonical
 *   node scripts/create-canonical.js --pcs=0,1,2 --recipes=maj,m,7,maj7 --dry
 */

const { db, admin } = require("../src/firebase"); // firebase đã init từ app của bạn
const { FieldValue } = admin.firestore;

// ---------- CLI args ----------
const args = require("minimist")(process.argv.slice(2), {
  string: ["collection", "pcs", "recipes"],
  boolean: ["dry"],
  // Đặt default thành "chords_canonical" cho rõ ràng
  default: { collection: "chords_canonical", dry: false },
});

const TARGET_PATH = String(args.collection || "chords_canonical");
const DRY = !!args.dry;

const ONLY_PCS = parseCsvInt(args.pcs);       // e.g. [0,1,2]
const ONLY_RECIPES = parseCsv(args.recipes);  // e.g. ["maj","m","7","maj7"]

function parseCsv(v) {
  if (!v) return null;
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function parseCsvInt(v) {
  const arr = parseCsv(v);
  if (!arr) return null;
  return arr.map((s) => {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0 && n <= 11) return n;
    throw new Error(`Invalid pc in --pcs: ${s}`);
  });
}

// ---------- Resolve collection ref (1, 2 hoặc 3 thành phần) ----------
function getCollectionRef(db, path) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 1) {
    // top-level collection
    return db.collection(parts[0]);
  }
  if (parts.length === 2) {
    // collection/subcollection => chèn doc "_meta" ở giữa (KHÔNG dùng "__meta__")
    const [col, subcol] = parts;
    return db.collection(col).doc("_meta").collection(subcol);
  }
  if (parts.length === 3) {
    const [col, doc, subcol] = parts;
    return db.collection(col).doc(doc).collection(subcol);
  }
  throw new Error(
    `Invalid collection path "${path}". Use one of:\n` +
      `- "chords_canonical"\n` +
      `- "chords_system/canonical" (script sẽ dùng chords_system/_meta/canonical)\n` +
      `- "chords_system/<doc>/canonical"`
  );
}

// ---------- Pitch-class labels ----------
const SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function pcToLabel(pc, prefer = "sharp") {
  return prefer === "flat" ? FLAT[pc] : SHARP[pc];
}

// ---------- Recipes (interval sets) ----------
const RECIPES = {
  // Triads
  maj:    [0, 4, 7],
  m:      [0, 3, 7],
  dim:    [0, 3, 6],
  aug:    [0, 4, 8],

  // Adds / 6 / sus
  "6":        [0, 4, 7, 9],
  m6:         [0, 3, 7, 9],
  "6/9":      [0, 4, 7, 9, 2],
  add9:       [0, 4, 7, 2],
  "m(add9)":  [0, 3, 7, 2],
  sus2:       [0, 2, 7],
  sus4:       [0, 5, 7],
  sus4add9:   [0, 5, 2],

  // 7ths
  "7":    [0, 4, 7, 10],
  maj7:   [0, 4, 7, 11],
  m7:     [0, 3, 7, 10],
  m7b5:   [0, 3, 6, 10],
  dim7:   [0, 3, 6, 9],

  // 9ths
  "9":    [0, 4, 10, 2],
  m9:     [0, 3, 10, 2],
  maj9:   [0, 4, 11, 2],

  // 11ths
  "11":   [0, 4, 10, 5],
  m11:    [0, 3, 10, 5],

  // 13ths
  "13":   [0, 4, 10, 9],
  m13:    [0, 3, 10, 9],

  // Dominant altered
  "7b9":   [0, 4, 10, 1],
  "7#9":   [0, 4, 10, 3],
  "7b5":   [0, 4, 6, 10],
  "7#5":   [0, 4, 8, 10],
  "9b5":   [0, 4, 10, 2, 6],
  "9#5":   [0, 4, 10, 2, 8],
  "13b9":  [0, 4, 10, 1, 9],
  "13#11": [0, 4, 10, 6, 9],
  "7#11":  [0, 4, 10, 6],
  "7b13":  [0, 4, 10, 8],
  "7sus4": [0, 5, 10],
};

const RECIPE_ORDER = [
  "maj","m","dim","aug",
  "6","m6","6/9","add9","m(add9)","sus2","sus4","sus4add9",
  "7","maj7","m7","m7b5","dim7",
  "9","m9","maj9",
  "11","m11",
  "13","m13",
  "7b9","7#9","7b5","7#5","9b5","9#5","13b9","13#11","7#11","7b13","7sus4",
];

// ---------- Quality → suffix (build symbolDefault) ----------
const QUALITY_SUFFIX = {
  maj: "",
  m: "m",
  dim: "dim",
  aug: "aug",
  "6": "6",
  m6: "m6",
  "6/9": "6/9",
  add9: "add9",
  "m(add9)": "m(add9)",
  sus2: "sus2",
  sus4: "sus4",
  sus4add9: "sus4add9",
  "7": "7",
  maj7: "maj7",
  m7: "m7",
  m7b5: "m7b5",
  dim7: "dim7",
  "9": "9",
  m9: "m9",
  maj9: "maj9",
  "11": "11",
  m11: "m11",
  "13": "13",
  m13: "m13",
  "7b9": "7b9",
  "7#9": "7#9",
  "7b5": "7b5",
  "7#5": "7#5",
  "9b5": "9b5",
  "9#5": "9#5",
  "13b9": "13b9",
  "13#11": "13#11",
  "7#11": "7#11",
  "7b13": "7b13",
  "7sus4": "7sus4",
};

// ---------- ID sanitizer (fix Firestore "/" trong docId) ----------
function safeId(s) {
  // Chỉ cần xử lý "/", các ký tự còn lại (#, (), …) Firestore vẫn cho trong docId
  return String(s).replace(/\//g, "_");
}

// ---------- Main ----------
async function run() {
  const colRef = getCollectionRef(db, TARGET_PATH);

  const pcs = ONLY_PCS ?? [...Array(12).keys()]; // 0..11
  const recipes = ONLY_RECIPES ?? RECIPE_ORDER.filter((r) => RECIPES[r]);

  console.log(`[canonical] target collection = ${TARGET_PATH}`);
  console.log(`[canonical] DRY = ${DRY}`);
  console.log(`[canonical] pcs = ${pcs.join(", ")}`);
  console.log(`[canonical] recipes = ${recipes.join(", ")}`);

  let total = 0;
  let pending = 0;
  const batchSize = 400;
  let batch = db.batch();

  const now = FieldValue.serverTimestamp();

  let loggedSample = false;

  for (const pc of pcs) {
    const rootLabel = pcToLabel(pc, "sharp"); // mặc định sharp cho symbolDefault
    for (const recipeId of recipes) {
      const intervals = RECIPES[recipeId];
      if (!intervals) continue;

      const suffix = QUALITY_SUFFIX[recipeId] ?? recipeId;
      const symbolDefault = rootLabel + (suffix ? suffix : "");

      // DÙNG safeId để tránh "/" (vd "6/9" -> "6_9")
      const docId = `r${pc}__${safeId(recipeId)}`;
      const ref = colRef.doc(docId);

      if (!loggedSample) {
        console.log(`[canonical] sample docId: ${docId} (from recipeId "${recipeId}")`);
        loggedSample = true;
      }

      const payload = {
        pc,
        recipeId,         // giữ nguyên giá trị gốc để truy vấn theo field
        intervals,
        symbolDefault,
        hasSlash: false,
        updatedAt: now,
      };

      if (DRY) {
        console.log(`DRY → upsert ${TARGET_PATH}/${docId}:`, payload);
      } else {
        batch.set(ref, { createdAt: now, ...payload }, { merge: true });
        pending++;
        total++;
        if (pending >= batchSize) {
          await batch.commit();
          console.log(`Committed ${pending} docs...`);
          batch = db.batch();
          pending = 0;
        }
      }
    }
  }

  if (!DRY && pending > 0) {
    await batch.commit();
    console.log(`Committed final ${pending} docs.`);
  }

  console.log(
    `[canonical] Done. Total candidates: ${pcs.length * recipes.length}${
      DRY ? " (dry-run)" : ""
    }`
  );
}

// ---------- bootstrap ----------
run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
