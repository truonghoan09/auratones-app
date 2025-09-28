#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Generic importer for chord entries -> Firestore
 *
 * Usage:
 *   node scripts/import-chords-json.js <path-to-json> [--collection chords_system] [--mode upsert|replace] [--dry]
 *
 * Examples:
 *   node scripts/import-chords-json.js out/piano_seed.json
 *   node scripts/import-chords-json.js out/piano_seed.json --collection chords_system --mode upsert
 *
 * Notes:
 * - Uses your existing admin init at src/firebase.js (as you provided).
 * - Batches 400 writes per commit.
 * - Doc id strategy: <instrument>__<normalized_symbol>
 */

const fs = require('fs');
const path = require('path');

// ✅ dùng firebase bạn đã khai báo
const { db, admin } = require('../src/firebase'); // adjust if your file is elsewhere

const BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = { collection: 'chords_system', mode: 'upsert', dry: false, file: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args.file = a;
      continue;
    }
    if (a === '--dry') { args.dry = true; continue; }
    const [k, v] = a.replace(/^--/, '').split('=');
    if (k === 'collection') args.collection = v || args.collection;
    else if (k === 'mode') args.mode = (v === 'replace' ? 'replace' : 'upsert');
  }
  return args;
}

function normalizeSymbolForId(symbol) {
  // Stable ID: lowercase, replace spaces, slashes, sharps/flats & odd chars
  return symbol
    .trim()
    .toLowerCase()
    .replace(/\//g, '__sl__')
    .replace(/#/g, '__sh__')
    .replace(/b/g, '__fl__')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function makeDocId(instrument, symbol) {
  return `${instrument}__${normalizeSymbolForId(symbol)}`;
}

function variantSignature(v) {
  // Guitar: prefer frets
  if (Array.isArray(v.frets)) return `g:${v.frets.join(',')}|bf:${v.baseFret || 1}`;
  // Piano: prefer 'notes' or 'notesMidi'
  if (Array.isArray(v.notesMidi)) return `p:${v.notesMidi.join(',')}`;
  if (Array.isArray(v.notes)) return `p2:${v.notes.join(',')}`;
  // Fallback
  try { return JSON.stringify(v, Object.keys(v).sort()); } catch { return String(v); }
}

function mergeVariants(existing = [], incoming = [], instrument = 'guitar', cap = 50) {
  const out = [];
  const seen = new Set();

  const push = (x) => {
    // auto add verified for piano = null if missing
    if (instrument === 'piano' && x.verified === undefined) x.verified = null;
    const sig = variantSignature(x);
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(x);
  };

  for (const v of existing) push(v);
  for (const v of incoming) push(v);

  // Cap for safety; keep earlier (usually lower/centered) first
  return out.slice(0, cap);
}

async function run() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.error('Usage: node scripts/import-chords-json.js <jsonPath> [--collection name] [--mode upsert|replace] [--dry]');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error('Cannot read file:', filePath, e.message);
    process.exit(1);
  }

  // guard against BOM
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('JSON must be an array of chord entries.');
    process.exit(1);
  }

  // Basic validate & normalize
  const entries = [];
  for (const [idx, item] of data.entries()) {
    if (!item || typeof item !== 'object') {
      console.warn(`Skip index ${idx}: not an object`);
      continue;
    }
    const { symbol, instrument, variants } = item;
    if (typeof symbol !== 'string' || !symbol.trim()) {
      console.warn(`Skip index ${idx}: invalid symbol`);
      continue;
    }
    if (typeof instrument !== 'string' || !instrument.trim()) {
      console.warn(`Skip index ${idx}: invalid instrument`);
      continue;
    }
    if (!Array.isArray(variants)) {
      console.warn(`Skip index ${idx}: variants must be an array`);
      continue;
    }

    // Ensure verified default for piano variants
    const fixedVariants = variants.map(v => {
      const vv = { ...v };
      if (instrument === 'piano' && vv.verified === undefined) vv.verified = null;
      return vv;
    });

    entries.push({
      symbol: symbol.trim(),
      instrument: instrument.trim(),
      aliases: Array.isArray(item.aliases) ? item.aliases : [],
      variants: fixedVariants,
    });
  }

  console.log(`[import] ${entries.length} entries → collection="${args.collection}" mode=${args.mode} dry=${args.dry}`);

  const colRef = db.collection(args.collection);

  let batch = db.batch();
  let pending = 0;
  let processed = 0;

  const commitIfNeeded = async (force = false) => {
    if (args.dry) return; // nothing to commit
    if (pending >= BATCH_SIZE || force) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  };

  for (const item of entries) {
    const docId = makeDocId(item.instrument, item.symbol);
    const docRef = colRef.doc(docId);

    if (args.mode === 'replace') {
      const payload = {
        symbol: item.symbol,
        instrument: item.instrument,
        aliases: item.aliases,
        variants: item.variants,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(), // will be overwritten if exists
      };
      if (!args.dry) batch.set(docRef, payload, { merge: false });
      processed++;
      pending++;
      if (!args.dry) await commitIfNeeded();
      continue;
    }

    // upsert mode
    const snap = await docRef.get();
    if (!snap.exists) {
      const payload = {
        symbol: item.symbol,
        instrument: item.instrument,
        aliases: item.aliases,
        variants: item.variants,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!args.dry) batch.set(docRef, payload, { merge: false });
    } else {
      const cur = snap.data() || {};
      const merged = {
        symbol: cur.symbol || item.symbol,
        instrument: cur.instrument || item.instrument,
        aliases: Array.isArray(cur.aliases) ? Array.from(new Set([...(cur.aliases||[]), ...item.aliases])) : item.aliases,
        variants: mergeVariants(cur.variants || [], item.variants || [], item.instrument),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!args.dry) batch.set(docRef, merged, { merge: true });
    }

    processed++;
    pending++;
    if (!args.dry) await commitIfNeeded();
  }

  if (!args.dry) await commitIfNeeded(true);

  console.log(`[import] Done. Processed ${processed} entries.`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
