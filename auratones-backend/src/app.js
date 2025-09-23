require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const routes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use('/api', routes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
