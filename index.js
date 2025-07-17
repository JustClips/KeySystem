const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Serve static files from the public folder (your space website)
app.use(express.static("public"));

// Key system logic
let keys = {};

// Load keys from file on startup (for persistence)
try {
  if (fs.existsSync("keys.json")) {
    keys = JSON.parse(fs.readFileSync("keys.json"));
  }
} catch (e) {
  keys = {};
}

function saveKeys() {
  fs.writeFileSync("keys.json", JSON.stringify(keys));
}

function generateKey() {
  return Math.random().toString(36).substring(2, 14).toUpperCase();
}

// Main API endpoint for key
app.get("/get-key", (req, res) => {
  let user = req.ip;
  let now = Date.now();
  let last = keys[user]?.time || 0;
  if (now - last < 6 * 60 * 60 * 1000) {
    return res.json({
      error: "You already got a key. Try again later.",
      nextKeyAt: new Date(last + 6 * 60 * 60 * 1000),
    });
  }
  let key = generateKey();
  keys[user] = { key, time: now };
  saveKeys();
  res.json({ key });
});

// REMOVE this block! (No longer needed, as static site serves / automatically)
// app.get("/", (req, res) => {
//   res.send(
//     "Eps1llon Hub Key System API is up. Visit /get-key (after Linkvertise) to get your key."
//   );
// });

app.listen(PORT, () =>
  console.log(`Eps1llon Hub Key System API running on port ${PORT}`)
);
