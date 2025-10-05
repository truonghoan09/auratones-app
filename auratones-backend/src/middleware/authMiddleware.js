const jwt = require('jsonwebtoken');
const { secret } = require('../config/jwt'); // phải cùng file/SECRET với chỗ sign()

/**
 * Đọc token từ:
 *  - Authorization: Bearer <token>
 *  - Authorization: <token> (fallback)
 *  - ?token=<token> (chỉ để debug/dev)
 */
module.exports = function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  let token = null;

  if (auth && typeof auth === 'string') {
    const parts = auth.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    } else {
      // fallback: nếu ai đó gửi raw token trong Authorization
      token = auth;
    }
  }

  if (!token && process.env.NODE_ENV !== 'production' && req.query && typeof req.query.token === 'string') {
    token = req.query.token; // chỉ cho phép ở dev
``}

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (!payload || !payload.uid) {
      return res.status(401).json({ message: 'Invalid token: missing uid' });
    }
    req.user = payload; // { uid, email, role, plan, ... }
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token', detail: e.message });
  }
};
