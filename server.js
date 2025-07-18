// server.js
const express  = require('express');
const cors     = require('cors');
const mysql    = require('mysql2/promise');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// 1) OPEN CORS for your front‑end
app.use(cors());
app.use(express.json());

// 2) Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

// 3) Multer setup for avatar and script thumbnail uploads - add timestamp for cache busting
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:  (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random()*1E9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// 4) Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// 5) Initialize MySQL pool
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// 6) Ensure users table exists with avatar and is_admin columns
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id       INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar   VARCHAR(255) NULL,
        is_admin BOOLEAN DEFAULT FALSE
      )
    `);
    console.log('Users table ready');
  } catch (e) {
    console.error('Error creating users table:', e);
  }
})();

// 7) Ensure scripts table exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scripts (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        placeId     VARCHAR(50) NOT NULL,
        thumbnail   VARCHAR(255) NOT NULL,
        uploader_id INT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploader_id) REFERENCES users(id)
      )
    `);
    console.log('Scripts table ready');
  } catch (e) {
    console.error('Error creating scripts table:', e);
  }
})();

// 8) Registration endpoint
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing fields' });
  try {
    const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length)
      return res.status(409).json({ error: 'Username exists' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
    res.json({ success: true });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// 9) Login endpoint with cache-busting avatar URL
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await pool.query('SELECT id, password, avatar, is_admin FROM users WHERE username = ?', [username]);
    if (!rows.length)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    const avatarUrl = user.avatar
      ? `${req.protocol}://${req.get('host')}/uploads/${user.avatar}?v=${Date.now()}`
      : null;

    res.json({ uid: user.id, username, avatarUrl, is_admin: !!user.is_admin });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// 10) Avatar upload endpoint
app.post('/api/avatar', upload.single('avatar'), async (req, res) => {
  const { uid } = req.body;
  if (!req.file || !uid) {
    return res.status(400).json({ error: 'Missing file or uid' });
  }
  try {
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [req.file.filename, uid]);
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}?v=${Date.now()}`;
    res.json({ avatarUrl: url });
  } catch (e) {
    console.error('Avatar upload error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// 11) Admin-only script upload endpoint
app.post('/api/upload-script', upload.single('thumbnail'), async (req, res) => {
  const { uid, title, placeId } = req.body;
  if (!uid || !title || !placeId || !req.file) {
    return res.status(400).json({ error: 'Missing fields or file' });
  }

  try {
    // Verify user is admin
    const [users] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [uid]);
    if (!users.length) return res.status(401).json({ error: 'Invalid user' });
    if (!users[0].is_admin) return res.status(403).json({ error: 'Forbidden: Admins only' });

    // Insert script into DB
    const filename = req.file.filename;
    await pool.query(
      'INSERT INTO scripts (title, placeId, thumbnail, uploader_id) VALUES (?, ?, ?, ?)',
      [title, placeId, filename, uid]
    );

    const thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}?v=${Date.now()}`;
    res.json({ success: true, thumbnailUrl });
  } catch (e) {
    console.error('Upload script error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// 12) Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
