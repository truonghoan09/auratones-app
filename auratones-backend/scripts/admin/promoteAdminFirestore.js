// scripts/admin/promoteAdminFirestore.js
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const [k, v] = a.split("=");
    if (k.startsWith("--")) out[k.slice(2)] = v ?? true;
  }
  return out;
}

(async () => {
  try {
    const args = parseArgs();
    const uid = args.uid || args.u;
    if (!uid) {
      console.error("❌ Thiếu tham số --uid=<USER_ID>");
      process.exit(1);
    }

    // Load service account (đường dẫn giống script trước)
    const keyPath = path.join(__dirname, "..", "..", "auratones-123456-firebase-adminsdk-fbsvc-a308c1b97e.json");
    if (!fs.existsSync(keyPath)) {
      console.error("❌ Không thấy file serviceAccountKey.json ở:", keyPath);
      process.exit(1);
    }
    const serviceAccount = require(keyPath);

    // Init Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    const db = admin.firestore();

    // Tìm doc users/{uid}
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      console.error("❌ Không tìm thấy document Firestore: users/%s", uid);
      process.exit(1);
    }

    // Update role => admin
    await ref.set(
      {
        role: "admin",
        usage: { lastActiveAt: admin.firestore.FieldValue.serverTimestamp() },
      },
      { merge: true }
    );

    console.log("✅ Đã set role=admin cho users/%s", uid);
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi:", err?.message || err);
    process.exit(1);
  }
})();
