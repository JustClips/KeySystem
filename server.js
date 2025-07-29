// Only load dotenv in local development (not on Railway)
if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch {}
}

const express      = require('express');
const cors         = require('cors');
const mysql        = require('mysql2/promise');
const bcrypt       = require('bcryptjs');
const path         = require('path');
const fs           = require('fs');
const multer       = require('multer');
const crypto       = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===== STATIC FILE SERVING for uploads only =====
const UPLOAD_DIR = path.join(__dirname, 'Uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));

// ===== MYSQL POOL =====
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// ===== ENSURE TABLES ===== (Comment out if DB is already created to reduce startup load)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NULL, 
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(255) NULL,
        is_admin TINYINT(1) DEFAULT 0,
        regdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table ready');
  } catch (e) {
    console.error('Error creating users table:', e);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scripts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        placeId VARCHAR(50) NOT NULL,
        thumbnail VARCHAR(255) NOT NULL,
        scriptCode TEXT NOT NULL,
        uploader_id INT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploader_id) REFERENCES users(id)
      )
    `);
    console.log('Scripts table ready');
  } catch (e) {
    console.error('Error creating scripts table:', e);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`keys\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        key_value VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Keys table ready');
  } catch (e) {
    console.error('Error creating keys table:', e);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid INT NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uid) REFERENCES users(id)
      )
    `);
    console.log('Tickets table ready');
  } catch (e) {
    console.error('Error creating tickets table:', e);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_replies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        admin_uid INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (admin_uid) REFERENCES users(id)
      )
    `);
    console.log('Ticket replies table ready');
  } catch (e) {
    console.error('Error creating ticket_replies table:', e);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        script_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Comments table ready');
  } catch (e) {
    console.error('Error creating comments table:', e);
  }
})();

// ===== SLUGIFY HELPER =====
function slugify(str) {
  return str.toString().toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// =======================================================
// ===== API ROUTES =====
// =======================================================

// Health check route to test if server is up
app.get('/', (req, res) => {
  res.send('API is running');
});

// ===== AUTH & USER API ROUTES =====
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    const [exists] = await pool.query(
      'SELECT id FROM users WHERE username = ?', [username]
    );
    if (exists.length)
      return res.status(409).json({ error: 'Username exists' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hash]
    );
    res.json({ success: true, message: 'Registration successful.' });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

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

// ===== SCRIPTS API ROUTES =====
app.post('/api/upload-script', async (req, res) => {
  const { uid, title, placeId, thumbnail, scriptCode } = req.body;
  if (!uid || !title || !placeId || !thumbnail || !scriptCode) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const [users] = await pool.query(
      'SELECT is_admin FROM users WHERE id = ?',
      [uid]
    );
    if (!users.length || !users[0].is_admin) return res.status(403).json({ error: 'Admins only' });

    let slug = slugify(title);
    // Ensure unique slug (append random if exists)
    let trySlug = slug, count = 1;
    while (true) {
      const [exists] = await pool.query('SELECT id FROM scripts WHERE slug = ?', [trySlug]);
      if (!exists.length) break;
      trySlug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
      count++;
      if (count > 10) { return res.status(500).json({ error: 'Could not generate unique slug.' }); }
    }
    slug = trySlug;

    await pool.query(
      `INSERT INTO scripts (title, slug, placeId, thumbnail, scriptCode, uploader_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, slug, placeId, thumbnail, scriptCode, uid]
    );
    res.json({ success: true, slug });
  } catch (e) {
    console.error('Upload script error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/scripts', async (req, res) => {
  try {
    const [scripts] = await pool.query(`
      SELECT id, title, slug, placeId, thumbnail, scriptCode, uploader_id, uploaded_at
      FROM scripts
      ORDER BY uploaded_at DESC
    `);
    res.json(scripts);
  } catch (e) {
    console.error('Fetch scripts error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// New endpoint: get a script by slug
app.get('/api/script', async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  try {
    const [rows] = await pool.query(
      'SELECT id, title, slug, placeId, thumbnail, scriptCode, uploader_id, uploaded_at FROM scripts WHERE slug = ? LIMIT 1',
      [slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Fetch script by slug error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// New: Comments API routes
app.get('/api/comments', async (req, res) => {
  const { script_id } = req.query;
  if (!script_id) return res.status(400).json({ error: 'Missing script_id' });
  try {
    const [comments] = await pool.query(`
      SELECT c.id, c.comment, c.created_at, u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.script_id = ?
      ORDER BY c.created_at DESC
    `, [script_id]);
    res.json(comments);
  } catch (e) {
    console.error('Fetch comments error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/comments', async (req, res) => {
  const { script_id, uid, comment } = req.body;
  if (!script_id || !uid || !comment) return res.status(400).json({ error: 'Missing fields' });
  try {
    // Optional: Check if user exists
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [uid]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });

    await pool.query(
      'INSERT INTO comments (script_id, user_id, comment) VALUES (?, ?, ?)',
      [script_id, uid, comment]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Post comment error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== COUNTERS API ROUTES =====
app.get('/api/counters', async (req, res) => {
  try {
    const onlineUsers = 42; // Placeholder, replace with your logic
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM `keys`');
    const keysGenerated = row.total;
    res.json({ onlineUsers, keysGenerated });
  } catch {
    res.json({ onlineUsers: 0, keysGenerated: 0 });
  }
});

// ===== KEY SYSTEM API ROUTES =====
app.post('/api/generate-key', async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'Missing user ID' });
  const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000);
  try {
    const [existing] = await pool.query(
      'SELECT key_value, expires_at FROM `keys` WHERE user_id = ? AND expires_at > NOW()',
      [uid]
    );
    if (existing.length) {
      return res.json({ key: existing[0].key_value, expires_at: existing[0].expires_at });
    }
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
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== SUPPORT TICKETS API ROUTES =====
app.post('/api/tickets', async (req, res) => {
  const { uid, subject, message } = req.body;
  if (!uid || !subject || !message) {
    return res.status(400).json({ success: false, error: 'Missing fields.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO tickets (uid, subject, message) VALUES (?, ?, ?)',
      [uid, subject, message]
    );
    res.json({ success: true, ticketId: result.insertId });
  } catch (err) {
    console.error('INSERT TICKET ERR', err);
    res.status(500).json({ success: false, error: 'Database error.' });
  }
});

app.get('/api/tickets', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.id, t.subject, t.created_at, u.username
      FROM tickets t
      JOIN users u ON t.uid = u.id
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('FETCH TICKETS ERR', err);
    res.status(500).json({ success: false, error: 'Database error.' });
  }
});

app.get('/api/tickets/:id', async (req, res) => {
  const ticketId = req.params.id;
  try {
    const [[ticket]] = await pool.query(`
      SELECT t.id, t.subject, t.message, t.created_at, u.username
      FROM tickets t
      JOIN users u ON t.uid = u.id
      WHERE t.id = ?
    `, [ticketId]);
    if (!ticket) return res.status(404).json({ error: 'Not found.' });

    const [replies] = await pool.query(`
      SELECT r.id, r.message, r.created_at, u.username AS admin_username
      FROM ticket_replies r
      JOIN users u ON r.admin_uid = u.id
      WHERE r.ticket_id = ?
      ORDER BY r.created_at ASC
    `, [ticketId]);
    res.json({ ...ticket, replies });
  } catch (err) {
    console.error('FETCH TICKET DETAIL ERR', err);
    res.status(500).json({ success: false, error: 'Database error.' });
  }
});

app.post('/api/tickets/:id/reply', async (req, res) => {
  const ticketId = req.params.id;
  const { uid, message } = req.body;
  if (!uid || !message) {
    return res.status(400).json({ success: false, error: 'Missing fields.' });
  }
  try {
    const [users] = await pool.query(
      'SELECT is_admin FROM users WHERE id = ?', [uid]
    );
    if (!users.length || !users[0].is_admin) return res.status(403).json({ success: false, error: 'Admins only.' });
    await pool.query(
      'INSERT INTO ticket_replies (ticket_id, admin_uid, message) VALUES (?, ?, ?)',
      [ticketId, uid, message]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('INSERT REPLY ERR', err);
    res.status(500).json({ success: false, error: 'Database error.' });
  }
});

// Global error handler for better debugging
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).send('Internal Server Error - Check server logs for details.');
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
