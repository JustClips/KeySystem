const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// MySQL connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST,     // Railway will inject these
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1); // Stop the app if can't connect
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

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  connection.query(
    'SELECT id, username FROM users WHERE username=? AND password=?',
    [username, password],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.length === 0)
        return res.status(401).json({ error: 'Invalid credentials' });
      res.json({ uid: results[0].id, username: results[0].username });
    }
  );
});

// Counter endpoint for frontend
app.get('/api/counters', (req, res) => {
  connection.query('SELECT COUNT(*) AS userCount FROM users', (err, results) => {
    if (err) return res.json({ keysGenerated: 0, onlineUsers: 1 });
    res.json({ keysGenerated: results[0].userCount, onlineUsers: 1 + Math.floor(Math.random() * 4) });
  });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
