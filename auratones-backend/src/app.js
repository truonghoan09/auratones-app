// app.js (hoặc src/app.js)
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const routes = require('./routes'); // hoặc './routes/index'

const app = express();
const PORT = process.env.PORT || 3001;

const allowed = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map(s => s.trim().replace(/\/+$/, "")); // bỏ dấu / cuối

const corsOpts = {
  origin: (origin, cb) => {
    const allowlist = allowed; // array
    const o = origin ? origin.replace(/\/+$/, "") : origin;
    console.log('[CORS] origin =', o, 'allowed =', allowlist);
    if (!origin) return cb(null, true); // curl/healthcheck/server-to-server
    return allowlist.includes(o) ? cb(null, true) : cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  // 👉 Khuyên bỏ dòng allowedHeaders để cors tự reflect headers FE yêu cầu
  // allowedHeaders: ['Content-Type','Authorization'],
};

// ❌ Đừng gọi app.options("*", ...) trên Express v5
app.use(cors(corsOpts));      // 1 lần duy nhất, KHÔNG thêm app.use(cors()) trần nữa
app.use(cookieParser());
app.use(express.json());

// Optional health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', routes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
