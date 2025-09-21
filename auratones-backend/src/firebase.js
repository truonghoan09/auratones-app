// src/firebase.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('../auratones-123456-firebase-adminsdk-fbsvc-74264b6b62.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
module.exports = { admin, db };
