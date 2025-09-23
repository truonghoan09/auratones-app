// src/config/google.js
const { OAuth2Client } = require('google-auth-library');

function reqEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v.trim();
}

const GOOGLE_CLIENT_ID = reqEnv('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = reqEnv('GOOGLE_CLIENT_SECRET');
const GOOGLE_REDIRECT_URI = reqEnv('GOOGLE_REDIRECT_URI');

function getOAuthClient() {
  return new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_REDIRECT_URI,
  });
}

function getAuthUrl(state) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',                 // để refresh_token (tuỳ chính sách)
    scope: ['openid', 'email', 'profile'],
    state,                             // chống CSRF
  });
}

async function exchangeCodeForTokens(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens; // {access_token, id_token, refresh_token?}
}

async function fetchUserInfo(accessToken) {
  // Dùng Google OIDC userinfo endpoint
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google userinfo');
  return await res.json(); // { sub, email, name, picture, ... }
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  fetchUserInfo,
};
