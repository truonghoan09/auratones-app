
// server/scripts/remove_default_sort.js
/**
 * Xoá field defaultSort khỏi toàn bộ docs trong collection "chords_system"
 * Dùng Node: node server/scripts/remove_default_sort.js
 * 
 * const { db, admin } = require("../src/firebase"); // firebase đã init từ app của bạn

*/
const { db, admin } = require("../src/firebase");
const { FieldValue } = admin.firestore;

(async () => {
  try {
    const col = db.collection("chords_system");
    const snap = await col.get();
    let count = 0;

    const batchSize = 400;
    let batch = db.batch();
    let nInBatch = 0;

    snap.forEach((doc) => {
      batch.update(doc.ref, { defaultSort: FieldValue.delete() }); // cần FieldValue
      nInBatch += 1;
      count += 1;
      if (nInBatch >= batchSize) {
        batch.commit();
        batch = db.batch();
        nInBatch = 0;
      }
    });
    if (nInBatch > 0) await batch.commit();

    console.log(`Done. Removed defaultSort from ${count} documents.`);
    process.exit(0);
  } catch (e) {
    console.error("Error", e);
    process.exit(1);
  }
})();
