// server.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 1) CORS: allow your front‑end and this backend
app.use(cors({
  origin: [
    'https://w1ck1llon.com',                        // your actual front‑end URL
    'https://keysystem-production-3419.up.railway.app'
  ]
}));

app.use(express.json());

// 2) Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// 3) Multer setup for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:  (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.body.uid}${ext}`);
  }
});
const upload = multer({ storage });

// 4) Serve uploaded files statically
app.use('/uploads', express.static(UPLOAD_DIR));

// 5) Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// 6) Ensure users table exists (with avatar column)
;(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar   VARCHAR(255) NULL
      )
    `);
    console.log('Users table ensured');
  } catch (err) {
    console.error('Error creating users table:', err);
  }
})();

// 7) Register route
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length > 0) {
      return res.status(409).json({ error: 'Username exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
    res.json({ success: true });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 8) Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, password, avatar FROM users WHERE username = ?',
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const avatarUrl = user.avatar
      ? `${req.protocol}://${req.get('host')}/uploads/${user.avatar}`
      : null;

    res.json({ uid: user.id, username, avatarUrl });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 9) Avatar upload route
app.post('/api/avatar', upload.single('avatar'), async (req, res) => {
  const { uid } = req.body;
  if (!req.file || !uid) {
    return res.status(400).json({ error: 'Missing file or uid' });
  }

  try {
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [
      req.file.filename,
      uid
    ]);
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ avatarUrl: url });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 10) Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
