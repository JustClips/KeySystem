const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Create MySQL connection using env vars
const db = mysql.createPool({
  host: process.env.DB_HOST,       // e.g. w1ckllon.davs8.dreamhosters.com
  user: process.env.DB_USER,       // e.g. eps1llon
  password: process.env.DB_PASS,   // from Railway Variables (secret)
  database: process.env.DB_NAME    // e.g. w1ckllon
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Example register route
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing fields' });

  db.query(
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, password],
    (err, results) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Username exists' });
        }
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ uid: results.insertId, username });
    }
  );
});

// Example login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.query(
    'SELECT id, username FROM users WHERE username = ? AND password = ?',
    [username, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

      res.json({ uid: results[0].id, username: results[0].username });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
