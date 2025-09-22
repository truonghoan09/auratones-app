// src/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { secret, expiresIn } = require('../config/jwt');   // ✅ import
const authMiddleware = require('../middleware/authMiddleware'); // ✅ import
const router = express.Router();
const { db } = require('../firebase');
const { FieldValue } = require('firebase-admin/firestore');
const axios = require('axios');
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");

// Cấu hình R2 Client với các biến môi trường
const R2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_AUTH_KEY_ID,
    secretAccessKey: process.env.R2_AUTH_SECRET
  }
});

async function testR2Connection() {
  try {
    const command = new ListBucketsCommand({});
    const data = await R2Client.send(command);
    console.log("Kết nối thành công với R2!");
    console.log("Danh sách bucket:", data.Buckets);
  } catch (error) {
    console.error("Lỗi kết nối với R2:", error.message);
  }
}
testR2Connection();

// API kiểm tra tên người dùng đã tồn tại chưa
router.get('/check-username', async (req, res) => {
  console.log('GET /auth/check-username: Request received with query:', req.query);
  const { username } = req.query;
  if (!username) {
    return res.status(400).send({ message: 'Username is required.' });
  }
  const usersRef = db.collection('users');
  try {
    const q = usersRef.where('username', '==', username).limit(1);
    const querySnapshot = await q.get();
    res.status(200).json({ isUsernameTaken: !querySnapshot.empty });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// API đăng ký người dùng
router.post('/register', async (req, res) => {
  console.log('POST /auth/register:', req.body);
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });

  try {
    // kiểm tra tồn tại
    const check = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!check.empty) return res.status(409).json({ message: 'Username already taken.' });

    const userRef = db.collection('users').doc();
    await userRef.set({
      username,
      password,
      createdAt: FieldValue.serverTimestamp()
    });

    // ✅ Tự động tạo token ngay khi đăng ký
    const token = jwt.sign({ uid: userRef.id, username }, secret, { expiresIn });

    res.status(201).json({
      message: 'User registered and logged in',
      token,
      user: { uid: userRef.id, username }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API đăng nhập người dùng


router.post('/login', async (req, res) => {
    console.log('POST /auth/login:', req.body);
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    try {
        const q = db.collection('users').where('username', '==', username).limit(1);
        const snapshot = await q.get();
        if (snapshot.empty) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const doc = snapshot.docs[0];
        const userData = doc.data();

        if (userData.password !== password) {
            return res.status(401).json({ message: 'Incorrect password.' });
        }
        
        const token = jwt.sign(
            { uid: doc.id, username: userData.username },
            secret,
            { expiresIn }
        );

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: { uid: doc.id, username: userData.username }
        });
    } catch (error) {
        console.error("Lỗi trong /login:", error);
        // Đảm bảo luôn gửi phản hồi 500 nếu có lỗi không mong muốn
        res.status(500).json({ error: error.message });
    }
});


// API xử lý đăng nhập Google (đã được sửa)
router.post('/google-login', async (req, res) => {
  const { idToken } = req.body; // client gửi idToken từ Firebase

  if (!idToken) return res.status(400).json({ message: 'ID token required.' });

  try {
    // 1. Verify token với Firebase
    const admin = require('firebase-admin');
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name: displayName, picture: photoURL } = decodedToken;

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    let newPhotoURL = null;

    // 2. Nếu có avatar mới hoặc user chưa tồn tại
    if (photoURL && (!userDoc.exists || userDoc.data().photoURL !== photoURL)) {
      // Xóa avatar cũ nếu có
      if (userDoc.exists && userDoc.data().photoURL) {
        try {
          const oldKey = userDoc.data().photoURL.split('/').pop();
          await R2Client.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `avatars/${oldKey}`
          }));
        } catch (err) {
          console.error('Lỗi xóa avatar cũ:', err);
        }
      }

      // Download ảnh Google
      const response = await axios.get(photoURL, { responseType: 'stream' });
      const key = `avatars/${uid}-${Date.now()}.jpg`;

      // Upload lên R2
      const upload = new Upload({
        client: R2Client,
        params: {
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: response.data,
          ContentType: 'image/jpeg'
        }
      });

      await upload.done();
      newPhotoURL = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${key}`;
    } else if (userDoc.exists) {
      newPhotoURL = userDoc.data().photoURL;
    }

    // 3. Lưu thông tin user vào Firestore
    await userRef.set({
      email,
      displayName,
      photoURL: newPhotoURL,
      lastLogin: FieldValue.serverTimestamp()
    }, { merge: true });

    // 4. Tạo JWT app
    const token = jwt.sign({ uid, email }, secret, { expiresIn });

    res.status(200).json({
      message: 'Google login successful',
      token,
      user: { uid, email, displayName, avatar: newPhotoURL }
    });

  } catch (error) {
    console.error('Lỗi Google login:', error);
    res.status(500).json({ message: error.message });
  }
});

// === API LẤY THÔNG TIN USER TỪ TOKEN ===
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ message: 'User not found.' });
    const data = doc.data();
    res.json({
      uid: req.user.uid,
      username: data.username,
      email: data.email || null,
      avatar: data.photoURL || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;