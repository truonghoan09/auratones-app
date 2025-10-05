// src/firebase.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('../auratones-123456-firebase-adminsdk-fbsvc-a308c1b97e.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
// db.settings({ ignoreUndefinedProperties: true });
module.exports = { admin, db };
