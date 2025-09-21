// src/config/jwt.js

module.exports = {
  secret: process.env.JWT_SECRET || 'dev_secret_key', // đổi trong .env khi lên production
  expiresIn: '7d' // thời hạn token
};
