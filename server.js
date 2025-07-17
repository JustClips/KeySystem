const express = require('express');
const mysql = require('mysql2/promise'); // promise-based mysql
const cors = require('cors');
const bcrypt = require('bcryptjs'); // use bcryptjs instead of bcrypt

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(cors({
  origin: ['https://w1ckllon.com'], // replace with your frontend domain
  credentials: false
}));
app.use(express.json());

// Create online_users table if not exists
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS online_users (
        user_id INT PRIMARY KEY,
        last_active TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    conn.release();
    console.log('Checked/created online_users table');
  } catch (err) {
    console.error('Error creating online_users table:', err);
  }
})();

// Registration endpoint
app.post('/api/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Missing fields' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const [results] = await pool.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );

    res.json({ uid: results.insertId, username });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username exists' });
    }
    next(err);
  }
});

// Login endpoint
app.post('/api/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const [results] = await pool.query(
      'SELECT id, username, password FROM users WHERE username=?',
      [username]
    );
    if (results.length === 0)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Mark user as online
    await pool.query(
      'REPLACE INTO online_users (user_id, last_active) VALUES (?, NOW())',
      [user.id]
    );

    res.json({ uid: user.id, username: user.username });
  } catch (err) {
    next(err);
  }
});

// Keep Alive ping endpoint
app.post('/api/ping', async (req, res, next) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'Missing uid' });

    await pool.query(
      'REPLACE INTO online_users (user_id, last_active) VALUES (?, NOW())',
      [uid]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Counters endpoint
app.get('/api/counters', async (req, res, next) => {
  try {
    const [[userCount]] = await pool.query('SELECT COUNT(*) AS userCount FROM users');
    const [[onlineCount]] = await pool.query(
      'SELECT COUNT(*) AS onlineCount FROM online_users WHERE last_active > (NOW() - INTERVAL 5 MINUTE)'
    );
    res.json({ keysGenerated: userCount.userCount, onlineUsers: onlineCount.onlineCount });
  } catch (err) {
    res.json({ keysGenerated: 0, onlineUsers: 0 });
  }
});

// Dashboard user info endpoint
app.get('/api/userinfo', async (req, res, next) => {
  try {
    const uid = req.query.uid;
    if (!uid) return res.status(400).json({ error: 'Missing uid' });

    const [results] = await pool.query(
      'SELECT id, username, regdate FROM users WHERE id=?',
      [uid]
    );

    if (results.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json(results[0]);
  } catch (err) {
    next(err);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
