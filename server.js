const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite DB setup
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) console.error('DB Error:', err.message);
});

// Create users table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )
`);

// --- CORS SETUP ---
app.use(cors({
  origin: ['https://davs8.dreamhosters.com'], // your frontend domain
  credentials: false
}));

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Register Endpoint ---
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing fields' });

  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, password],
    function (err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ error: 'Username exists' });
        }
        return res.status(500).json({ error: 'Server error' });
      }
      return res.json({ uid: this.lastID, username });
    }
  );
});

// --- Login Endpoint ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(
    `SELECT id, username FROM users WHERE username=? AND password=?`,
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (!row) return res.status(401).json({ error: 'Invalid credentials' });
      res.json({ uid: row.id, username: row.username });
    }
  );
});

// --- Optional: Fake counters for testing ---
app.get('/api/counters', (req, res) => {
  res.json({ keysGenerated: 193, onlineUsers: Math.floor(Math.random() * 10) + 1 });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
