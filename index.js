const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(cors());
app.use(express.static("public"));

// In-memory and file-persisted key count
let generated = { count: 0 };
try {
  if (fs.existsSync("generated.json")) {
    generated = JSON.parse(fs.readFileSync("generated.json"));
  }
} catch {
  generated = { count: 0 };
}
function saveGenerated() {
  fs.writeFileSync("generated.json", JSON.stringify(generated));
}

// REST API for increment and initial count
app.post("/api/increment-keys", express.json(), (req, res) => {
  generated.count++;
  saveGenerated();
  broadcastCounts();
  res.json({ success: true, count: generated.count });
});
app.get("/api/counters", (req, res) => {
  res.json({
    keysGenerated: generated.count,
    onlineUsers: wss ? wss.clients.size : 1,
  });
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// WebSocket server for live user counter
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcastCounts() {
  const msg = JSON.stringify({
    keysGenerated: generated.count,
    onlineUsers: wss.clients.size,
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}
wss.on("connection", function (ws) {
  broadcastCounts();
  ws.on("close", () => setTimeout(broadcastCounts, 100));
});

// IMPORTANT: Only use server.listen, NOT app.listen!
server.listen(PORT, () => {
  console.log(`Eps1llon Hub API running on port ${PORT}`);
});
