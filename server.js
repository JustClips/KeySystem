const express  = require('express');
const cors     = require('cors');
const mysql    = require('mysql2/promise');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const crypto   = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve uploaded files (avatars only)
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));

// Initialize MySQL pool
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Ensure users table exists
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

// Ensure scripts table exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scripts (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        placeId     VARCHAR(50) NOT NULL,
        thumbnail   VARCHAR(255) NOT NULL,
        scriptCode  TEXT NOT NULL,
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

// Ensure keys table exists (for 6-hour key system)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`keys\` (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        key_value  VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (user_id)
      )
    `);
    console.log('Keys table ready');
  } catch (e) {
    console.error('Error creating keys table:', e);
  }
})();

// Registration endpoint
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing fields' });
  try {
    const [exists] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (exists.length)
      return res.status(409).json({ error: 'Username exists' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hash]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing fields' });
  try {
    const [rows] = await pool.query(
      'SELECT id, password, avatar, is_admin FROM users WHERE username = ?',
      [username]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    const avatarUrl = user.avatar
      ? `${req.protocol}://${req.get('host')}/uploads/${user.avatar}?v=${Date.now()}`
      : null;

    res.json({
      uid: user.id,
      username,
      avatarUrl,
      is_admin: !!user.is_admin
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Avatar upload endpoint
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:  (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random()*1E9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

app.post('/api/avatar', upload.single('avatar'), async (req, res) => {
  const { uid } = req.body;
  if (!req.file || !uid) {
    return res.status(400).json({ error: 'Missing file or uid' });
  }
  try {
    await pool.query(
      'UPDATE users SET avatar = ? WHERE id = ?',
      [req.file.filename, uid]
    );
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}?v=${Date.now()}`;
    res.json({ avatarUrl: url });
  } catch (e) {
    console.error('Avatar upload error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin-only script upload endpoint
app.post('/api/upload-script', async (req, res) => {
  const { uid, title, placeId, thumbnail, scriptCode } = req.body;
  if (!uid || !title || !placeId || !thumbnail || !scriptCode) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    // Verify user is admin
    const [users] = await pool.query(
      'SELECT is_admin FROM users WHERE id = ?',
      [uid]
    );
    if (!users.length) return res.status(401).json({ error: 'Invalid user' });
    if (!users[0].is_admin) return res.status(403).json({ error: 'Admins only' });

    await pool.query(
      `INSERT INTO scripts (title, placeId, thumbnail, scriptCode, uploader_id)
       VALUES (?, ?, ?, ?, ?)`,
      [title, placeId, thumbnail, scriptCode, uid]
    );

    res.json({ success: true });
  } catch (e) {
    console.error('Upload script error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all scripts endpoint
app.get('/api/scripts', async (req, res) => {
  try {
    const [scripts] = await pool.query(`
      SELECT id, title, placeId, thumbnail, scriptCode, uploader_id, uploaded_at
      FROM scripts
      ORDER BY uploaded_at DESC
    `);
    res.json(scripts);
  } catch (e) {
    console.error('Fetch scripts error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Online users & keys generated counters endpoint
app.get('/api/counters', async (req, res) => {
  try {
    // Example logic for onlineUsers; replace this with your real logic if needed
    const onlineUsers = 42;

    // Count generated keys (all rows in keys table)
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM `keys`');
    const keysGenerated = row.total;

    res.json({ onlineUsers, keysGenerated });
  } catch {
    res.json({ onlineUsers: 0, keysGenerated: 0 });
  }
});

/* ========== KEY SYSTEM ========== */

// Generate or return a unique 6-hour key for a user
app.post('/api/generate-key', async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'Missing user ID' });

  const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000);

  try {
    // Check for existing, unexpired key
    const [existing] = await pool.query(
      'SELECT key_value, expires_at FROM `keys` WHERE user_id = ? AND expires_at > NOW()',
      [uid]
    );
    if (existing.length) {
      return res.json({ key: existing[0].key_value, expires_at: existing[0].expires_at });
    }

    // Generate a new key
    const newKey = crypto.randomBytes(24).toString('hex');
    await pool.query(
      'INSERT INTO `keys` (user_id, key_value, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_value=?, expires_at=?',
      [uid, newKey, sixHoursFromNow, newKey, sixHoursFromNow]
    );
    res.json({ key: newKey, expires_at: sixHoursFromNow });
  } catch (e) {
    console.error('Generate key error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Key verification for Roblox/other (KEY: returns {valid: true/false})
app.post('/api/verify-key', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, error: 'No key provided' });

  try {
    const [rows] = await pool.query(
      'SELECT user_id FROM `keys` WHERE key_value = ? AND expires_at > NOW()',
      [key]
    );
    if (!rows.length) return res.json({ valid: false });
    res.json({ valid: true, user_id: rows[0].user_id });
  } catch (e) {
    console.error('Verify key error:', e);
    res.status(500).json({ valid: false, error: 'Server error' });
  }
});

/* ========== END KEY SYSTEM ========== */

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
