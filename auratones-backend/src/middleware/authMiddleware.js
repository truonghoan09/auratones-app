// src/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const { secret } = require('../config/jwt');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided.' });

  const token = authHeader.split(' ')[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ message: 'Token missing.' });

  jwt.verify(token, secret, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token.' });
    req.user = decoded; // decoded = { uid, username, iat, exp }
    next();
  });
}

module.exports = authMiddleware;
