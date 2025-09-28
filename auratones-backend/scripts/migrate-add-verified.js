#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Migration: add `verified` field vào tất cả chords trong collection Firestore
 *
 * Chạy thử (dry run):
 *   node scripts/migrate-add-verified.js --collection chords_system --dry
 *
 * Chạy thật (ghi vào Firestore):
 *   node scripts/migrate-add-verified.js --collection chords_system
 */

const { db } = require("../src/firebase");
const admin = require("firebase-admin");

const args = process.argv.slice(2);

function getFlag(name, fallback = null) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] || true;
}

const COLLECTION = getFlag("collection", "chords_system");
const DRY = args.includes("--dry");
const BATCH_SIZE = parseInt(getFlag("batch", 400), 10);

async function run() {
  console.log(`[migrate-add-verified] collection=${COLLECTION} DRY=${DRY} BATCH_SIZE=${BATCH_SIZE}`);

  const snapshot = await db.collection(COLLECTION).get();
  console.log(`[info] Found ${snapshot.size} documents`);

  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const ref = doc.ref;
    batch.update(ref, { verified: false }); // mặc định false
    count++;
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      if (!DRY) await batch.commit();
      console.log(`[batch] committed ${batchCount} docs`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    if (!DRY) await batch.commit();
    console.log(`[batch] committed ${batchCount} docs`);
  }

  console.log(`[done] Processed ${count} documents`);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
