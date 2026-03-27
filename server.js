const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, "logs.json");

// In-memory store
let logs = [];

// Load existing logs from file if present
if (fs.existsSync(LOG_FILE)) {
  try {
    logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  } catch {
    logs = [];
  }
}

function saveLogs() {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

function sendJSON(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /log  — receive a log message
  if (req.method === "POST" && req.url === "/log") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return sendJSON(res, 400, { error: "Invalid JSON body" });
      }

      if (!payload.message) {
        return sendJSON(res, 400, { error: '"message" field is required' });
      }

      const entry = {
        id: logs.length + 1,
        timestamp: new Date().toISOString(),
        level: payload.level || "info",
        message: payload.message,
        meta: payload.meta || null,
      };

      logs.push(entry);
      saveLogs();

      console.log(`[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`);
      return sendJSON(res, 201, { ok: true, entry });
    });
    return;
  }

  // GET /logs  — retrieve all stored logs
  if (req.method === "GET" && req.url === "/logs") {
    return sendJSON(res, 200, { total: logs.length, logs });
  }

  // DELETE /logs  — clear all logs
  if (req.method === "DELETE" && req.url === "/logs") {
    logs = [];
    saveLogs();
    return sendJSON(res, 200, { ok: true, message: "All logs cleared" });
  }

  // GET /  — health check
  if (req.method === "GET" && req.url === "/") {
    return sendJSON(res, 200, {
      status: "running",
      endpoints: {
        "POST /log": "Send a log message",
        "GET /logs": "Retrieve all logs",
        "DELETE /logs": "Clear all logs",
      },
    });
  }

  sendJSON(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`\n✅  Log server running on http://localhost:${PORT}\n`);
});