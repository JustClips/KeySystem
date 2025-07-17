const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));

// Key system logic
let keys = {};

// Load key count (for 'Keys Generated')
let generated = { count: 0 };
try {
  if (fs.existsSync("generated.json")) {
    generated = JSON.parse(fs.readFileSync("generated.json"));
  }
} catch (e) {
  generated = { count: 0 };
}
function saveGenerated() {
  fs.writeFileSync("generated.json", JSON.stringify(generated));
}

// ---- API Endpoints ----

// Used by frontend to increment keys generated
app.post("/api/increment-keys", express.json(), (req, res) => {
  generated.count++;
  saveGenerated();
  // Notify all WebSocket clients about new count
  broadcastCounts();
  res.json({ success: true, count: generated.count });
});

// Used by frontend to get initial counts
app.get("/api/counters", (req, res) => {
  res.json({
    keysGenerated: generated.count,
    onlineUsers: wss ? wss.clients.size : 1
  });
});

// Serve main page (optional if static)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---- WebSocket User Counter ----

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcastCounts() {
  const msg = JSON.stringify({
    keysGenerated: generated.count,
    onlineUsers: wss.clients.size
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}
wss.on("connection", function (ws) {
  broadcastCounts();
  ws.on("close", () => setTimeout(broadcastCounts, 100));
});

server.listen(PORT, () =>
  console.log(`Eps1llon Hub Key System API running on port ${PORT}`)
);
