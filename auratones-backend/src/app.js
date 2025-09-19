// src/app.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json()); // Cho phép server đọc dữ liệu JSON từ request

// Định tuyến cơ bản
app.get('/', (req, res) => {
  res.send('Auratones Backend is running!');
});

// Lắng nghe cổng
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});