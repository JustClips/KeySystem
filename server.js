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
// No longer need nodemailer

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===== UPLOADS =====
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));

// ===== MYSQL POOL =====
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// ===== ENSURE TABLES =====
(async () => {
  try {
    // MODIFIED: email is now optional and not unique
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

  // REMOVED: No longer need the password_resets table
})();

// ===== AUTH & USER ROUTES =====

// Register user
app.post('/api/register', async (req, res) => {
  // MODIFIED: Only username and password are required
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    // MODIFIED: Only check for existing username
    const [exists] = await pool.query(
      'SELECT id FROM users WHERE username = ?', [username]
    );
    if (exists.length)
      return res.status(409).json({ error: 'Username exists' });

    const hash = await bcrypt.hash(password, 10);

    // MODIFIED: Insert only username and password
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

// Login
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

// Avatar upload
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

// ===== SCRIPTS =====

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

// ===== COUNTERS =====

app.get('/api/counters', async (req, res) => {
  try {
    // Example logic for onlineUsers; replace with your real logic if needed
    const onlineUsers = 42;

    // Count generated keys
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM `keys`');
    const keysGenerated = row.total;

    res.json({ onlineUsers, keysGenerated });
  } catch {
    res.json({ onlineUsers: 0, keysGenerated: 0 });
  }
});

// ===== KEY SYSTEM =====

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

// Key verification endpoint
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

// ===== SUPPORT TICKETS =====

// Create a new ticket
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

// List all tickets (admins only)
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

// Get one ticket + its replies
app.get('/api/tickets/:id', async (req, res) => {
  const ticketId = req.params.id;
  try {
    // fetch ticket
    const [[ticket]] = await pool.query(`
      SELECT t.id, t.subject, t.message, t.created_at, u.username
      FROM tickets t
      JOIN users u ON t.uid = u.id
      WHERE t.id = ?
    `, [ticketId]);
    if (!ticket) return res.status(404).json({ error: 'Not found.' });

    // fetch replies
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

// Post a reply to a ticket (admins only)
app.post('/api/tickets/:id/reply', async (req, res) => {
  const ticketId = req.params.id;
  const { uid, message } = req.body;
  if (!uid || !message) {
    return res.status(400).json({ success: false, error: 'Missing fields.' });
  }
  try {
    // Verify user is admin
    const [users] = await pool.query(
      'SELECT is_admin FROM users WHERE id = ?', [uid]
    );
    if (!users.length) return res.status(401).json({ success: false, error: 'Invalid user.' });
    if (!users[0].is_admin) return res.status(403).json({ success: false, error: 'Admins only.' });

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


// REMOVED: All password reset functionality has been deleted.


// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
