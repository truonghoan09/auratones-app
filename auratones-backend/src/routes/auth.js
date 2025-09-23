// src/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const axios = require('axios');

const router = express.Router();

const { secret, expiresIn } = require('../config/jwt');
const authMiddleware = require('../middleware/authMiddleware');
const { db } = require('../firebase');
const { FieldValue } = require('firebase-admin/firestore');

const { checkR2, uploadFile, deleteFile, generateKey } = require('../config/r2');
const { getAuthUrl, exchangeCodeForTokens, fetchUserInfo } = require('../config/google');

// ---------- OAuth constants ----------
const STATE_COOKIE = (process.env.OAUTH_STATE_COOKIE_NAME || 'auratones_oauth_state').trim();
const SUCCESS_REDIRECT = (process.env.OAUTH_SUCCESS_REDIRECT || 'http://localhost:5173/auth/success').trim();
const FAILURE_REDIRECT = (process.env.OAUTH_FAILURE_REDIRECT || 'http://localhost:5173/auth/error').trim();

// ============================================================================
// Helpers
// ============================================================================

function defaultProfile(overrides = {}) {
  return {
    // identity
    uid: null,
    email: null,
    username: null,
    displayName: null,

    // providers
    providers: {
      password: false,
      google: { linked: false, sub: null },
    },

    // roles / plan
    role: 'user',
    plan: 'free',
    subscription: {
      status: 'inactive',
      renewAt: null,
    },

    // entitlements
    entitlements: {
      sheetSlots: 10,
      storageGB: 1,
    },

    // telemetry
    storage: { usedBytes: 0 },
    usage: { lastActiveAt: null, totalSessions: 0 },

    // avatar
    avatarURL: null,
    avatarKey: null,
    photoURLOriginal: null,
    photoHash: null,

    // ui settings
    settings: { lang: 'vi', theme: 'light' },

    // timestamps
    createdAt: FieldValue.serverTimestamp(),
    lastLogin: FieldValue.serverTimestamp(),

    ...overrides,
  };
}

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

// Best-effort avatar sync to R2; never throw to break login flow
async function ensureAvatarUpToDate(userRef, current, googlePhotoURL) {
  if (!googlePhotoURL) {
    return {
      avatarURL: current?.avatarURL || null,
      avatarKey: current?.avatarKey || null,
      photoHash: current?.photoHash || null,
    };
  }

  const resp = await axios.get(googlePhotoURL, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(resp.data);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  const changed = !current?.photoHash || current.photoHash !== hash || !current?.avatarKey;
  if (!changed) {
    return { avatarURL: current.avatarURL, avatarKey: current.avatarKey, photoHash: current.photoHash };
  }

  if (current?.avatarKey) {
    try { await deleteFile(current.avatarKey); } catch (_) {}
  }

  const key = generateKey('avatars', `${userRef.id}.jpg`);
  const url = await uploadFile(key, buffer, 'image/jpeg');
  return { avatarURL: url, avatarKey: key, photoHash: hash };
}

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

// ============================================================================
// Health
// ============================================================================

router.get('/r2-health', async (_req, res) => {
  try {
    const result = await checkR2();
    return res.status(200).json({ status: 'ok', message: `Connected to R2 bucket: ${result.bucket}` });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ============================================================================
// Username check
// ============================================================================

router.get('/check-username', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ message: 'Username is required.' });
  try {
    const existed = await findUserByUsername(username);
    return res.status(200).json({ isUsernameTaken: Boolean(existed) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Register (username/password)
// ============================================================================

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
    return res.status(201).json({
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
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Login (username/password)
// ============================================================================

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

    await db.collection('users').doc(found.id).set({
      lastLogin: FieldValue.serverTimestamp(),
      'usage.totalSessions': (user.usage?.totalSessions || 0) + 1,
    }, { merge: true });

    const token = signAppToken({ ...user, uid: found.id });
    return res.status(200).json({
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
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Google OAuth (server-side)
// ============================================================================

router.get('/google', (_req, res) => {
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

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      const reason = encodeURIComponent(String(error));
      return res.redirect(`${FAILURE_REDIRECT}?reason=google_${reason}`);
    }

    const saved = req.cookies ? req.cookies[STATE_COOKIE] : null;
    if (!code || !state || !saved || state !== saved) {
      return res.redirect(`${FAILURE_REDIRECT}?reason=state_mismatch`);
    }
    res.clearCookie(STATE_COOKIE);

    // 1) Exchange code -> tokens
    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code.toString());
    } catch {
      return res.redirect(`${FAILURE_REDIRECT}?reason=exchange_failed`);
    }
    if (!tokens.access_token) {
      return res.redirect(`${FAILURE_REDIRECT}?reason=no_access_token`);
    }

    // 2) Fetch Google user info
    let info;
    try {
      info = await fetchUserInfo(tokens.access_token);
    } catch {
      return res.redirect(`${FAILURE_REDIRECT}?reason=userinfo_failed`);
    }

    const googleSub = info.sub;
    const email = info.email || null;
    const displayName = info.name || null;
    const googlePhotoURL = info.picture || null;

    // 3) Pick or create user (merge by email if exists)
    let userDocId, userData;
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

    // 4) Best-effort avatar sync (never fail login)
    const userRef = db.collection('users').doc(userDocId);
    const currentSnap = await userRef.get();
    const current = currentSnap.exists ? currentSnap.data() : {};

    let avatarURL  = current?.avatarURL || null;
    let avatarKey  = current?.avatarKey || null;
    let photoHash  = current?.photoHash || null;

    try {
      const r = await ensureAvatarUpToDate(userRef, current, googlePhotoURL);
      avatarURL = r.avatarURL;
      avatarKey = r.avatarKey;
      photoHash = r.photoHash;
    } catch (e) {
      // fallback: use Google's direct url
      avatarURL = googlePhotoURL || avatarURL;
    }

    // 5) Update profile (do not override other provider flags)
    await userRef.set({
      email: email || current.email || null,
      displayName: displayName || current.displayName || null,
      'providers.google': { linked: true, sub: googleSub },
      'providers.password': Boolean(current.passwordHash),
      photoURLOriginal: googlePhotoURL || current.photoURLOriginal || null,
      avatarURL,
      avatarKey,
      photoHash,
      lastLogin: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 6) Issue JWT & redirect
    const freshSnap = await userRef.get();
    const mergedUser = freshSnap.data();
    const token = signAppToken({ ...mergedUser, uid: userDocId });

    const url = new URL(SUCCESS_REDIRECT);
    url.searchParams.set('token', token);
    url.searchParams.set('uid', userDocId);
    return res.redirect(url.toString());
  } catch (err) {
    const reason = encodeURIComponent(err?.message || 'unknown');
    return res.redirect(`${FAILURE_REDIRECT}?reason=${reason}`);
  }
});

// ============================================================================
// Linking & Profile Ops
// ============================================================================

// Set / change password for logged-in account (even if originally Google)
router.post('/link/set-password', authMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 12);
    const ref = db.collection('users').doc(req.user.uid);
    await ref.set({
      passwordHash: hash,
      'providers.password': true, // do not override providers.google
    }, { merge: true });

    return res.json({ message: 'Password set successfully.' });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Set username after Google login (or change it)
router.post('/link/set-username', authMiddleware, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username is required.' });

  try {
    const existed = await findUserByUsername(username);
    if (existed && existed.id !== req.user.uid) {
      return res.status(409).json({ message: 'Username already taken.' });
    }
    await db.collection('users').doc(req.user.uid).set({ username }, { merge: true });
    return res.json({ message: 'Username set successfully.' });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// Update profile (whitelisted fields)
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const allowed = ['displayName', 'settings', 'subscription', 'entitlements', 'plan'];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0) return res.status(400).json({ message: 'Nothing to update.' });

    await db.collection('users').doc(req.user.uid).set(patch, { merge: true });
    return res.json({ message: 'Profile updated.' });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

// ============================================================================
// Me
// ============================================================================

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.user.uid).get();
    if (!snap.exists) return res.status(404).json({ message: 'User not found.' });
    const d = snap.data() || {};

    return res.json({
      uid: req.user.uid,
      username: d.username || null,
      email: d.email || null,
      displayName: d.displayName || d.username || null,
      // prefer normalized avatar field; fallback to any legacy field
      avatar: d.avatarURL || d.photoURL || null,

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
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Logout (stateless JWT -> client just drops the token)
// ============================================================================

router.post('/logout', (_req, res) => res.status(200).json({ message: 'Logged out' }));

module.exports = router;
