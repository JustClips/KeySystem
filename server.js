const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Print DB_HOST to logs for troubleshooting
console.log('DB_HOST VALUE:', JSON.stringify(process.env.DB_HOST));

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1);
  } else {
    console.log('Connected to DreamHost MySQL!');
  }
});

app.use(cors({
  origin: ['https://davs8.dreamhosters.com'],
  credentials: false
}));
app.use(express.json());

// Registration endpoint
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing fields' });

  connection.query(
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, password],
    (err, results) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Username exists' });
        }
        return res.status(500).json({ error: 'Server error' });
      }
      return res.json({ uid: results.insertId, username });
    }
  );
});

// Login endpoint (marks user as online)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  connection.query(
    'SELECT id, username FROM users WHERE username=? AND password=?',
    [username, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.length === 0)
        return res.status(401).json({ error: 'Invalid credentials' });

      const userId = results[0].id;
      // Mark user as online
      connection.query(
        'REPLACE INTO online_users (user_id, last_active) VALUES (?, NOW())',
        [userId],
        () => {
          res.json({ uid: userId, username: results[0].username });
        }
      );
    }
  );
});

// "Keep Alive" ping endpoint (so users stay online as long as active)
app.post('/api/ping', (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'Missing uid' });
  connection.query(
    'REPLACE INTO online_users (user_id, last_active) VALUES (?, NOW())',
    [uid],
    () => res.json({ success: true })
  );
});

// Counters endpoint (real online users and total registered)
app.get('/api/counters', (req, res) => {
  connection.query('SELECT COUNT(*) AS userCount FROM users', (err, userResults) => {
    if (err) return res.json({ keysGenerated: 0, onlineUsers: 0 });

    connection.query(
      'SELECT COUNT(*) AS onlineCount FROM online_users WHERE last_active > (NOW() - INTERVAL 5 MINUTE)',
      (err, onlineResults) => {
        if (err) return res.json({ keysGenerated: userResults[0].userCount, onlineUsers: 0 });
        res.json({
          keysGenerated: userResults[0].userCount,
          onlineUsers: onlineResults[0].onlineCount
        });
      }
    );
  });
});

// Dashboard user info endpoint
app.get('/api/userinfo', (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ error: 'Missing uid' });

  connection.query(
    'SELECT id, username, regdate FROM users WHERE id=?',
    [uid],
    (err, results) => {
      if (err || results.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json({
        id: results[0].id,
        username: results[0].username,
        regdate: results[0].regdate
      });
    }
  );
});

// --- Optional: Create online_users table if not exists on startup ---
connection.query(`
  CREATE TABLE IF NOT EXISTS online_users (
    user_id INT PRIMARY KEY,
    last_active TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);

// --- Optional: Ensure users table has regdate column (otherwise run ALTER TABLE manually as above) ---

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
