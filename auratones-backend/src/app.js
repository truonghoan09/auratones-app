// app.js (hoặc src/app.js)
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const routes = require('./routes'); // hoặc './routes/index'

const app = express();
const PORT = process.env.PORT || 3001;

const allowed = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",");
const corsOpts = {
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

// ❌ Đừng gọi app.options("*", ...) trên Express v5
app.use(cors(corsOpts));      // 1 lần duy nhất, KHÔNG thêm app.use(cors()) trần nữa
app.use(cookieParser());
app.use(express.json());

// Optional health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', routes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
