// src/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { secret, expiresIn } = require('../config/jwt');   // ✅ import
const authMiddleware = require('../middleware/authMiddleware'); // ✅ import
const router = express.Router();
const { db } = require('../firebase');
const { FieldValue } = require('firebase-admin/firestore');
const axios = require('axios');

// Cấu hình R2 Client với các biến môi trường
// const R2Client = new S3Client({
//   region: "auto",
//   endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
//   credentials: {
//     // Sử dụng R2_AUTH_TOKEN cho cả hai trường
//     accessKeyId: process.env.R2_AUTH_TOKEN,
//     secretAccessKey: process.env.R2_AUTH_TOKEN
//   }
// });

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
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });

  try {
    const q = db.collection('users').where('username', '==', username).limit(1);
    const snapshot = await q.get();
    if (snapshot.empty) return res.status(404).json({ message: 'User not found.' });

    const doc = snapshot.docs[0];
    const userData = doc.data();

    if (userData.password !== password) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    // 🔑 Tạo token
    const token = jwt.sign(
      { uid: doc.id, username: userData.username },
      secret,
      { expiresIn }
    );

    res.status(200).json({
      message: 'Login successful',
      token,                           // ✅ client sẽ lưu token này
      user: { uid: doc.id, username: userData.username }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API xử lý đăng nhập Google (đã được sửa)
router.post('/google-auth', async (req, res) => {
  console.log('POST /auth/google-auth: Request body received:', req.body);
  const { uid, email, displayName, photoURL } = req.body;
  if (!uid) {
    return res.status(400).send({ message: 'User ID is required.' });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    let newPhotoURL = null;

    if (photoURL) {
      // 1. Kiểm tra nếu URL avatar mới khác URL cũ
      if (!userDoc.exists || userDoc.data().photoURL !== photoURL) {
        // 2. Xóa avatar cũ nếu có
        if (userDoc.exists && userDoc.data().photoURL) {
          try {
            const oldAvatarKey = userDoc.data().photoURL.split('/').pop();
            const deleteParams = {
              Bucket: process.env.R2_BUCKET_NAME,
              Key: `avatars/${oldAvatarKey}`
            };
            const deleteCommand = new DeleteObjectCommand(deleteParams);
            await R2Client.send(deleteCommand);
          } catch (deleteError) {
            console.error("Lỗi khi xóa avatar cũ:", deleteError);
            // Tiếp tục ngay cả khi xóa thất bại
          }
        }

        // 3. Tải avatar mới từ Google
        const response = await axios.get(photoURL, { responseType: 'stream' });
        const key = `avatars/${uid}-${Date.now()}.jpg`;

        // 4. Upload ảnh mới lên R2
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
      } else {
        // Nếu URL không thay đổi, sử dụng lại URL cũ
        newPhotoURL = userDoc.data().photoURL;
      }
    }

    // 5. Cập nhật thông tin người dùng vào Firestore
    await userRef.set({
      email,
      displayName,
      photoURL: newPhotoURL,
      lastLogin: FieldValue.serverTimestamp()
    }, { merge: true });

    res.status(200).send({ message: 'User data saved successfully.' });
  } catch (error) {
    console.error("Lỗi trong quá trình xử lý Google Auth:", error);
    res.status(500).send({ error: error.message });
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
      email: data.email || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;