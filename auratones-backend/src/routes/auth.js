// src/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const axios = require('axios');
const mime = require('mime-types');

const router = express.Router();

const { secret, expiresIn } = require('../config/jwt');
const authMiddleware = require('../middleware/authMiddleware');
const { db } = require('../firebase');
const { FieldValue } = require('firebase-admin/firestore');

const {
  checkR2,
  uploadFile,
  deleteFile,
  generateKey,
  publicUrlForKey,
} = require('../config/r2');
const { getAuthUrl, exchangeCodeForTokens, fetchUserInfo } = require('../config/google');

// ===== Env =====
const STATE_COOKIE = (process.env.OAUTH_STATE_COOKIE_NAME || 'auratones_oauth_state').trim();
const SUCCESS_REDIRECT = (process.env.OAUTH_SUCCESS_REDIRECT || '').trim();
const FAILURE_REDIRECT = (process.env.OAUTH_FAILURE_REDIRECT || '').trim();

// ===================================================================
// Helpers
// ===================================================================

// Hồ sơ mặc định (dễ mở rộng về sau)
function defaultProfile(overrides = {}) {
  return {
    uid: null,
    email: null,
    username: null,
    displayName: null,

    providers: {
      password: false,
      google: { linked: false, sub: null },
    },

    role: 'user',
    plan: 'free',
    subscription: { status: 'inactive', renewAt: null },

    entitlements: { sheetSlots: 10, storageGB: 1 },
    storage: { usedBytes: 0 },
    usage: { lastActiveAt: null, totalSessions: 0 },

    avatarURL: null,
    avatarKey: null,
    photoURLOriginal: null,
    photoHash: null,

    settings: { lang: 'vi', theme: 'light' },

    createdAt: FieldValue.serverTimestamp(),
    lastLogin: FieldValue.serverTimestamp(),

    ...overrides,
  };
}

// JWT nhẹ cho FE
function signAppToken(user) {
  const claims = {
    uid: user.uid,
    username: user.username || undefined,
    email: user.email || undefined,
    role: user.role || 'user',
    plan: user.plan || 'free',
  };
  return jwt.sign(claims, secret, { expiresIn });
}

// So sánh, đồng bộ avatar Google -> R2 (trả về public r2.dev URL)
async function ensureAvatarUpToDate(userRef, current, googlePhotoURL) {
  // Không có ảnh Google → chỉ chuẩn hoá URL từ key cũ (nếu có)
  if (!googlePhotoURL) {
    return {
      avatarURL: current?.avatarKey ? publicUrlForKey(current.avatarKey) : (current?.avatarURL || null),
      avatarKey: current?.avatarKey || null,
      photoHash: current?.photoHash || null,
    };
  }

  // Tải ảnh Google
  const resp = await axios.get(googlePhotoURL, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(resp.data);

  // Hash để so sánh có thay đổi
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const changed = !current?.photoHash || current.photoHash !== hash || !current?.avatarKey;

  // Không thay đổi → chuẩn hoá URL từ key
  if (!changed) {
    return {
      avatarURL: current?.avatarKey ? publicUrlForKey(current.avatarKey) : (current?.avatarURL || null),
      avatarKey: current?.avatarKey || null,
      photoHash: current?.photoHash || null,
    };
  }

  // Xoá avatar cũ nếu có
  if (current?.avatarKey) {
    try { await deleteFile(current.avatarKey); } catch (_) {}
  }

  // Đoán content-type/đuôi
  let contentType = resp.headers['content-type'] || mime.lookup(googlePhotoURL) || 'image/jpeg';
  if (contentType === 'image/jpg') contentType = 'image/jpeg';
  const ext = mime.extension(contentType) || 'jpg';

  // Upload lên R2
  const key = generateKey('avatars', `${userRef.id}.${ext}`);
  const publicUrl = await uploadFile(key, buffer, contentType); // luôn trả r2.dev

  return { avatarURL: publicUrl, avatarKey: key, photoHash: hash };
}

// Tìm user theo email/username
async function findUserByEmail(email) {
  if (!email) return null;
  const q = await db.collection('users').where('email', '==', email).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  return { id: doc.id, data: doc.data() };
}
async function findUserByUsername(username) {
  if (!username) return null;
  const q = await db.collection('users').where('username', '==', username).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  return { id: doc.id, data: doc.data() };
}

// ===================================================================
// Health
// ===================================================================
router.get('/r2-health', async (_req, res) => {
  try {
    const result = await checkR2();
    res.status(200).json({ status: 'ok', message: `Connected to R2 bucket: ${result.bucket}` });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ===================================================================
// Username check
// ===================================================================
router.get('/check-username', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Username is required.' });
  try {
    const existed = await findUserByUsername(username);
    res.status(200).json({ isUsernameTaken: Boolean(existed) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================================================================
// Register (username/password)
// ===================================================================
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  try {
    const existedUsername = await findUserByUsername(username);
    if (existedUsername) return res.status(409).json({ message: 'Username already taken.' });

    if (email) {
      const existedEmail = await findUserByEmail(email);
      if (existedEmail) return res.status(409).json({ message: 'Email already in use.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const userRef = db.collection('users').doc();

    const profile = defaultProfile({
      uid: userRef.id,
      username,
      email: email || null,
      displayName: username,
      providers: { password: true, google: { linked: false, sub: null } },
    });

    await userRef.set({ ...profile, passwordHash: hash });

    const token = signAppToken(profile);
    res.status(201).json({
      message: 'User registered and logged in',
      token,
      user: {
        uid: profile.uid,
        username: profile.username,
        email: profile.email,
        displayName: profile.displayName,
        role: profile.role,
        plan: profile.plan,
        avatar: profile.avatarURL,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================================================================
// Login (username/password)
// ===================================================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });

  try {
    const found = await findUserByUsername(username);
    if (!found) return res.status(404).json({ message: 'User not found.' });

    const user = found.data;
    if (!user.passwordHash) {
      return res.status(400).json({ message: 'This account has no password. Please login with Google or set a password.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Incorrect password.' });

    await db.collection('users').doc(found.id).set(
      { lastLogin: FieldValue.serverTimestamp(), 'usage.totalSessions': (user.usage?.totalSessions || 0) + 1 },
      { merge: true }
    );

    const token = signAppToken({ ...user, uid: found.id });
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        uid: found.id,
        username: user.username,
        email: user.email || null,
        displayName: user.displayName || user.username,
        role: user.role || 'user',
        plan: user.plan || 'free',
        avatar: user.avatarURL || null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================================================================
// Google OAuth (server-side)
// ===================================================================

// Bắt đầu OAuth → redirect sang Google
router.get('/google', (req, res) => {
  const state = crypto.randomBytes(12).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  });
  const url = getAuthUrl(state);
  return res.redirect(url);
});

// Callback từ Google
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const saved = req.cookies ? req.cookies[STATE_COOKIE] : null;
    if (!code || !state || !saved || state !== saved) throw new Error('Invalid OAuth state');
    res.clearCookie(STATE_COOKIE);

    // 1) Đổi code -> access token
    const tokens = await exchangeCodeForTokens(code.toString());
    if (!tokens.access_token) throw new Error('No access token from Google');

    // 2) Lấy user info Google
    const info = await fetchUserInfo(tokens.access_token);
    const googleSub = info.sub;
    const email = info.email || null;
    const displayName = info.name || null;
    const googlePhotoURL = info.picture || null;

    // 3) Truy tìm user theo email, nếu chưa có thì tạo
    let userDocId;
    let userData;
    const byEmail = await findUserByEmail(email);
    if (byEmail) {
      userDocId = byEmail.id;
      userData = byEmail.data;
    } else {
      const newRef = db.collection('users').doc();
      userDocId = newRef.id;
      userData = defaultProfile({
        uid: userDocId,
        email,
        displayName,
        providers: { password: false, google: { linked: true, sub: googleSub } },
      });
      await newRef.set(userData);
    }

    // 4) Đồng bộ avatar về R2
    const userRef = db.collection('users').doc(userDocId);
    const currentSnap = await userRef.get();
    const current = currentSnap.exists ? currentSnap.data() : {};
    const { avatarURL, avatarKey, photoHash } = await ensureAvatarUpToDate(userRef, current, googlePhotoURL);

    // 5) Cập nhật hồ sơ
    await userRef.set(
      {
        email: email || current.email || null,
        displayName: displayName || current.displayName || null,
        providers: {
          ...(current.providers || {}),
          google: { linked: true, sub: googleSub },
          password: Boolean(current.passwordHash),
        },
        photoURLOriginal: googlePhotoURL || current.photoURLOriginal || null,
        avatarURL: avatarURL || current.avatarURL || null,
        avatarKey: avatarKey || current.avatarKey || null,
        photoHash: photoHash || current.photoHash || null,
        lastLogin: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 6) Cấp JWT + trả về
    const freshSnap = await userRef.get();
    const mergedUser = freshSnap.data();
    const token = signAppToken({ ...mergedUser, uid: userDocId });

    if (SUCCESS_REDIRECT) {
      const url = new URL(SUCCESS_REDIRECT);
      url.searchParams.set('token', token);
      url.searchParams.set('uid', userDocId);
      return res.redirect(url.toString());
    }
    return res.json({
      message: 'Google login successful',
      token,
      user: {
        uid: userDocId,
        username: mergedUser.username || null,
        email: mergedUser.email || null,
        displayName: mergedUser.displayName || null,
        role: mergedUser.role || 'user',
        plan: mergedUser.plan || 'free',
        avatar: mergedUser.avatarURL || null,
      },
    });
  } catch (err) {
    if (FAILURE_REDIRECT) return res.redirect(FAILURE_REDIRECT);
    res.status(500).json({ message: err.message });
  }
});

// ===================================================================
// Linking & Profile
// ===================================================================

// Đặt/đổi password (yêu cầu đã đăng nhập)
router.post('/link/set-password', authMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 12);
    const ref = db.collection('users').doc(req.user.uid);
    await ref.set({ passwordHash: hash, providers: { password: true } }, { merge: true });
    res.json({ message: 'Password set successfully.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Đặt username
router.post('/link/set-username', authMiddleware, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username is required.' });

  try {
    const existed = await findUserByUsername(username);
    if (existed && existed.id !== req.user.uid) {
      return res.status(409).json({ message: 'Username already taken.' });
    }
    await db.collection('users').doc(req.user.uid).set({ username }, { merge: true });
    res.json({ message: 'Username set successfully.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Cập nhật hồ sơ (limit các trường cho an toàn)
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const allowed = ['displayName', 'settings', 'subscription', 'entitlements', 'plan'];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ message: 'Nothing to update.' });

    await db.collection('users').doc(req.user.uid).set(patch, { merge: true });
    res.json({ message: 'Profile updated.' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ===================================================================
// Me / Logout
// ===================================================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.user.uid).get();
    if (!snap.exists) return res.status(404).json({ message: 'User not found.' });
    const d = snap.data();

    res.json({
      uid: req.user.uid,
      username: d.username || null,
      email: d.email || null,
      displayName: d.displayName || d.username || null,
      avatar: d.avatarURL || null,

      role: d.role || 'user',
      plan: d.plan || 'free',
      subscription: d.subscription || { status: 'inactive', renewAt: null },
      entitlements: d.entitlements || { sheetSlots: 10, storageGB: 1 },

      storage: d.storage || { usedBytes: 0 },
      usage: d.usage || { lastActiveAt: null, totalSessions: 0 },

      providers: d.providers || { password: !!d.passwordHash, google: { linked: false, sub: null } },
      settings: d.settings || { lang: 'vi', theme: 'light' },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/logout', (_req, res) => {
  // Nếu sau này dùng cookie HttpOnly -> clear ở đây
  res.status(200).json({ message: 'Logged out' });
});

// ===================================================================
// Debug (tùy chọn, hữu ích khi dev)
// ===================================================================
router.get('/_debug/token', (req, res) => {
  res.json({
    authorization: req.headers.authorization || null,
    note: 'Nếu null là FE không gửi header. FE cần gửi Authorization: Bearer <token>',
  });
});

module.exports = router;
