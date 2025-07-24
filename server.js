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

// ===== STATIC FILE SERVING =====
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// ===== MYSQL POOL =====
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ===== TEST DATABASE CONNECTION =====
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
})();

// ===== ENSURE TABLES =====
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
        description TEXT NULL,
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
  const { uid, title, placeId, thumbnail, scriptCode, description } = req.body;
  if (!uid || !title || !placeId || !thumbnail || !scriptCode) {
    return res.status(400).json({ error: 'Missing required fields' });
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
      `INSERT INTO scripts (title, slug, placeId, thumbnail, scriptCode, description, uploader_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, placeId, thumbnail, scriptCode, description || null, uid]
    );
    res.json({ success: true, slug });
  } catch (e) {
    console.error('Upload script error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/scripts', async (req, res) => {
  try {
    console.log('API: Fetching scripts from database...');
    const [scripts] = await pool.query(`
      SELECT id, title, slug, placeId, thumbnail, scriptCode, description, uploader_id, uploaded_at
      FROM scripts
      ORDER BY uploaded_at DESC
    `);
    console.log(`API: Found ${scripts.length} scripts`);
    res.json(scripts);
  } catch (e) {
    console.error('Fetch scripts error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a script by slug
app.get('/api/script/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  try {
    const [rows] = await pool.query(
      'SELECT id, title, slug, placeId, thumbnail, scriptCode, description, uploader_id, uploaded_at FROM scripts WHERE slug = ? LIMIT 1',
      [slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Script not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Fetch script by slug error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Alternative endpoint for backward compatibility
app.get('/api/script', async (req, res) => {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'Missing slug' });
  try {
    const [rows] = await pool.query(
      'SELECT id, title, slug, placeId, thumbnail, scriptCode, description, uploader_id, uploaded_at FROM scripts WHERE slug = ? LIMIT 1',
      [slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Script not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Fetch script by slug error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== COUNTERS API ROUTES =====
app.get('/api/counters', async (req, res) => {
  try {
    const onlineUsers = Math.floor(Math.random() * 50) + 20; // Random between 20-70
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM `keys`');
    const keysGenerated = row.total;
    res.json({ onlineUsers, keysGenerated });
  } catch (e) {
    console.error('Counters error:', e);
    res.json({ onlineUsers: 42, keysGenerated: 0 });
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
    res.status(500).json({ valid: false, error: 'Server error' });
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

// ===== HEALTH CHECK =====
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// =======================================================
// ===== FRONTEND PAGE-SERVING ROUTES =====
// =======================================================

// Helper function to safely serve files
function safeServeFile(res, filePath, fallbackPath = null) {
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else if (fallbackPath && fs.existsSync(fallbackPath)) {
    res.sendFile(fallbackPath);
  } else {
    res.status(404).send('Page not found');
  }
}

// Serve the main page (homepage) for the root URL
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  const viewsIndexPath = path.join(__dirname, 'views', 'index.html');
  safeServeFile(res, indexPath, viewsIndexPath);
});

// Serve the key generation page for the /generate-key URL
app.get('/generate-key', (req, res) => {
  const keyPath = path.join(__dirname, 'generate-key.html');
  const viewsKeyPath = path.join(__dirname, 'views', 'generate-key.html');
  safeServeFile(res, keyPath, viewsKeyPath);
});

// Serve the scripts page for both /scripts and /scripts/:slug URLs
app.get('/scripts/:slug?', (req, res) => {
  const scriptsPath = path.join(__dirname, 'scripts.html');
  const viewsScriptsPath = path.join(__dirname, 'views', 'scripts.html');
  const scriptPath = path.join(__dirname, 'script.html');
  const viewsScriptPath = path.join(__dirname, 'views', 'script.html');
  
  // Try scripts.html first, then script.html as fallback
  if (fs.existsSync(scriptsPath)) {
    res.sendFile(scriptsPath);
  } else if (fs.existsSync(viewsScriptsPath)) {
    res.sendFile(viewsScriptsPath);
  } else if (fs.existsSync(scriptPath)) {
    res.sendFile(scriptPath);
  } else if (fs.existsExists(viewsScriptPath)) {
    res.sendFile(viewsScriptPath);
  } else {
    res.status(404).send('Scripts page not found');
  }
});

// Handle reset password page
app.get('/reset-password', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  const viewsIndexPath = path.join(__dirname, 'views', 'index.html');
  safeServeFile(res, indexPath, viewsIndexPath);
});

// Dashboard route (if you have one)
app.get('/dashboard', (req, res) => {
  const dashboardPath = path.join(__dirname, 'dashboard.html');
  const viewsDashboardPath = path.join(__dirname, 'views', 'dashboard.html');
  const indexPath = path.join(__dirname, 'index.html');
  
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else if (fs.existsSync(viewsDashboardPath)) {
    res.sendFile(viewsDashboardPath);
  } else {
    res.sendFile(indexPath); // Fallback to index
  }
});

// A catch-all route for any other URL that doesn't match an API route or a page.
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  const viewsIndexPath = path.join(__dirname, 'views', 'index.html');
  safeServeFile(res, indexPath, viewsIndexPath);
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database host: ${process.env.DB_HOST || 'localhost'}`);
});
