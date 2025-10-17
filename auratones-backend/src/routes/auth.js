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
const RETURN_TO_COOKIE = (process.env.OAUTH_RETURN_TO_COOKIE_NAME || 'aur_rt').trim();

// ===================================================================
// Helpers
// ===================================================================

// Chuẩn hoá lỗi trả về để FE dễ map
function sendErr(res, httpStatus, code, message, fields) {
  return res.status(httpStatus).json({ code, message, fields: Array.isArray(fields) ? fields : undefined });
}

// Chỉ cho phép đường dẫn nội bộ (relative path), tránh open-redirect.
function sanitizeReturnTo(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

// Nhận returnTo từ body (hỗ trợ string, và backward-compat object)
function getReturnToFromBody(body) {
  const v = body?.returnTo;
  if (!v) return null;
  if (typeof v === 'string') return sanitizeReturnTo(v);
  if (typeof v === 'object' && v !== null) {
    const candidate = v.path || v.href || null;
    return sanitizeReturnTo(candidate);
  }
  return null;
}

// Hồ sơ mặc định
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

// So sánh, đồng bộ avatar Google -> R2
async function ensureAvatarUpToDate(userRef, current, googlePhotoURL) {
  if (!googlePhotoURL) {
    return {
      avatarURL: current?.avatarKey ? publicUrlForKey(current.avatarKey) : (current?.avatarURL || null),
      avatarKey: current?.avatarKey || null,
      photoHash: current?.photoHash || null,
    };
  }

  const resp = await axios.get(googlePhotoURL, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(resp.data);

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const changed = !current?.photoHash || current.photoHash !== hash || !current?.avatarKey;

  if (!changed) {
    return {
      avatarURL: current?.avatarKey ? publicUrlForKey(current.avatarKey) : (current?.avatarURL || null),
      avatarKey: current?.avatarKey || null,
      photoHash: current?.photoHash || null,
    };
  }

  if (current?.avatarKey) {
    try { await deleteFile(current.avatarKey); } catch (_) {}
  }

  let contentType = resp.headers['content-type'] || mime.lookup(googlePhotoURL) || 'image/jpeg';
  if (contentType === 'image/jpg') contentType = 'image/jpeg';
  const ext = mime.extension(contentType) || 'jpg';

  const key = generateKey('avatars', `${userRef.id}.${ext}`);
  const publicUrl = await uploadFile(key, buffer, contentType);

  return { avatarURL: publicUrl, avatarKey: key, photoHash: hash };
}

// Tìm user
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
  if (!username) return sendErr(res, 400, 'USERNAME_REQUIRED', 'Username is required.', ['username']);
  try {
    const existed = await findUserByUsername(username);
    res.status(200).json({ isUsernameTaken: Boolean(existed) });
  } catch (error) {
    return sendErr(res, 500, 'SERVER_ERROR', error.message);
  }
});

// ===================================================================
// Register (username/password)
// ===================================================================
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  const return_to = getReturnToFromBody(req.body);

  if (!username && !password) return sendErr(res, 400, 'MISSING_FIELDS', 'Username and password are required.', ['username', 'password']);
  if (!username) return sendErr(res, 400, 'USERNAME_REQUIRED', 'Username is required.', ['username']);
  if (!password) return sendErr(res, 400, 'PASSWORD_REQUIRED', 'Password is required.', ['password']);

  try {
    const existedUsername = await findUserByUsername(username);
    if (existedUsername) return sendErr(res, 409, 'USERNAME_TAKEN', 'Username already taken.', ['username']);

    if (email) {
      const existedEmail = await findUserByEmail(email);
      if (existedEmail) return sendErr(res, 409, 'EMAIL_IN_USE', 'Email already in use.', ['email']);
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
      code: 'REGISTERED',
      message: 'User registered and logged in',
      token,
      return_to,
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
    return sendErr(res, 500, 'SERVER_ERROR', error.message);
  }
});

// ===================================================================
// Login (username/password)
// ===================================================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const return_to = getReturnToFromBody(req.body);

  if (!username && !password) return sendErr(res, 400, 'MISSING_FIELDS', 'Username and password are required.', ['username', 'password']);
  if (!username) return sendErr(res, 400, 'USERNAME_REQUIRED', 'Username is required.', ['username']);
  if (!password) return sendErr(res, 400, 'PASSWORD_REQUIRED', 'Password is required.', ['password']);

  try {
    const found = await findUserByUsername(username);
    if (!found) return sendErr(res, 404, 'USER_NOT_FOUND', 'User not found.', ['username']);

    const user = found.data;
    if (!user.passwordHash) {
      return sendErr(
        res,
        400,
        'NO_PASSWORD_ACCOUNT',
        'This account has no password. Please login with Google or set a password.',
        ['password']
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return sendErr(res, 401, 'INCORRECT_PASSWORD', 'Incorrect password.', ['password']);

    await db.collection('users').doc(found.id).set(
      { lastLogin: FieldValue.serverTimestamp(), 'usage.totalSessions': (user.usage?.totalSessions || 0) + 1 },
      { merge: true }
    );

    const token = signAppToken({ ...user, uid: found.id });
    res.status(200).json({
      code: 'LOGIN_SUCCESS',
      message: 'Login successful',
      token,
      return_to,
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
    return sendErr(res, 500, 'SERVER_ERROR', error.message);
  }
});

// ===================================================================
// Google OAuth (server-side)
// ===================================================================
router.get('/google', (req, res) => {
  const state = crypto.randomBytes(12).toString('hex');

  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
  });

  const rt = sanitizeReturnTo(req.query.return_to);
  if (rt) {
    res.cookie(RETURN_TO_COOKIE, rt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000,
    });
  } else {
    res.clearCookie(RETURN_TO_COOKIE);
  }

  const url = getAuthUrl(state);
  return res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const saved = req.cookies ? req.cookies[STATE_COOKIE] : null;
    if (!code || !state || !saved || state !== saved) throw new Error('Invalid OAuth state');
    res.clearCookie(STATE_COOKIE);

    let return_to = null;
    try {
      const fromCookie = req.cookies ? req.cookies[RETURN_TO_COOKIE] : null;
      if (fromCookie) return_to = sanitizeReturnTo(fromCookie);
    } finally {
      res.clearCookie(RETURN_TO_COOKIE);
    }

    const tokens = await exchangeCodeForTokens(code.toString());
    if (!tokens.access_token) throw new Error('No access token from Google');

    const info = await fetchUserInfo(tokens.access_token);
    const googleSub = info.sub;
    const email = info.email || null;
    const displayName = info.name || null;
    const googlePhotoURL = info.picture || null;

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

    const userRef = db.collection('users').doc(userDocId);
    const currentSnap = await userRef.get();
    const current = currentSnap.exists ? currentSnap.data() : {};
    const { avatarURL, avatarKey, photoHash } = await ensureAvatarUpToDate(userRef, current, googlePhotoURL);

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

    const freshSnap = await userRef.get();
    const mergedUser = freshSnap.data();
    const token = signAppToken({ ...mergedUser, uid: userDocId });

    if (SUCCESS_REDIRECT) {
      const url = new URL(SUCCESS_REDIRECT);
      url.searchParams.set('token', token);
      url.searchParams.set('uid', userDocId);
      if (return_to) url.searchParams.set('return_to', return_to);
      return res.redirect(url.toString());
    }
    return res.json({
      code: 'GOOGLE_LOGIN_SUCCESS',
      message: 'Google login successful',
      token,
      return_to,
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
    return sendErr(res, 500, 'SERVER_ERROR', err.message);
  }
});

// ===================================================================
// Linking & Profile
// ===================================================================
router.post('/link/set-password', authMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return sendErr(res, 400, 'PASSWORD_TOO_SHORT', 'Password must be at least 6 characters.', ['password']);
  }
  try {
    const hash = await bcrypt.hash(newPassword, 12);
    const ref = db.collection('users').doc(req.user.uid);
    await ref.set({ passwordHash: hash, providers: { password: true } }, { merge: true });
    res.json({ code: 'PASSWORD_SET', message: 'Password set successfully.' });
  } catch (e) {
    return sendErr(res, 500, 'SERVER_ERROR', e.message);
  }
});

router.post('/link/set-username', authMiddleware, async (req, res) => {
  const { username } = req.body;
  if (!username) return sendErr(res, 400, 'USERNAME_REQUIRED', 'Username is required.', ['username']);

  try {
    const existed = await findUserByUsername(username);
    if (existed && existed.id !== req.user.uid) {
      return sendErr(res, 409, 'USERNAME_TAKEN', 'Username already taken.', ['username']);
    }
    await db.collection('users').doc(req.user.uid).set({ username }, { merge: true });
    res.json({ code: 'USERNAME_SET', message: 'Username set successfully.' });
  } catch (e) {
    return sendErr(res, 500, 'SERVER_ERROR', e.message);
  }
});

router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const allowed = ['displayName', 'settings', 'subscription', 'entitlements', 'plan'];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    if (Object.keys(patch).length === 0) return sendErr(res, 400, 'NOTHING_TO_UPDATE', 'Nothing to update.');

    await db.collection('users').doc(req.user.uid).set(patch, { merge: true });
    res.json({ code: 'PROFILE_UPDATED', message: 'Profile updated.' });
  } catch (e) {
    return sendErr(res, 500, 'SERVER_ERROR', e.message);
  }
});

// ===================================================================
// Me / Logout / Debug
// ===================================================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.user.uid).get();
    if (!snap.exists) return sendErr(res, 404, 'USER_NOT_FOUND', 'User not found.');
    const d = snap.data();

    res.json({
      code: 'ME_OK',
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
    return sendErr(res, 500, 'SERVER_ERROR', error.message);
  }
});

router.post('/logout', (_req, res) => {
  res.status(200).json({ code: 'LOGGED_OUT', message: 'Logged out' });
});

router.get('/_debug/token', (req, res) => {
  res.json({
    authorization: req.headers.authorization || null,
    note: 'Nếu null là FE không gửi header. FE cần gửi Authorization: Bearer <token>',
  });
});

module.exports = router;
