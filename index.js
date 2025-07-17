const express = require("express");
const fs = require("fs");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

let keys = {};

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

app.get("/", (req, res) => {
  res.send(
    "Eps1llon Hub Key System API is up. Visit /get-key (after Linkvertise) to get your key."
  );
});

app.listen(PORT, () => console.log(`API running on ${PORT}`));
