    // src/routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth'); // Import router từ file auth.js
const chordsRoutes = require('./chords'); 

// Định nghĩa các đường dẫn
router.use('/auth', authRoutes); // Tất cả các đường dẫn trong auth.js sẽ có tiền tố là /auth
router.use('/chords', chordsRoutes); 

// Bạn có thể thêm các file router khác ở đây
// router.use('/users', usersRoutes);
// router.use('/songs', songsRoutes);

module.exports = router;