import express from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

const publicDir = path.resolve(__dirname, "public");
const distDir = path.resolve(__dirname, "dist");
const preferredDir = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : publicDir;
const fallbackDir = pickStaticDir(preferredDir, distDir);

const app = express();
app.use(express.static(fallbackDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(fallbackDir, "index.html"));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/" });
const socketRoles = new Map();

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    const text = raw.toString();
    if (text.startsWith("HELLO:ESP32_GLOVE")) {
      socketRoles.set(socket, "esp32");
      console.log("[WS] Registered ESP32 glove");
      return;
    }

    const outgoing = normalizeMessageForBrowser(text);
    broadcastToOthers(socket, outgoing);
  });

  socket.on("close", () => {
    const role = socketRoles.get(socket);
    if (role === "esp32") {
      console.log("[WS] ESP32 disconnected");
    }
    socketRoles.delete(socket);
  });
});

function broadcastToOthers(sender, message) {
  for (const client of wss.clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function normalizeMessageForBrowser(rawText) {
  // gyrosound.ino sends pitch as: {"type":"pitch","p":<deg>}
  // Convert to browser format the frontend already understands:
  // {"pitch":<deg>,"volume":<0..1>}
  try {
    const parsed = JSON.parse(rawText);
    const pitchRaw =
      typeof parsed?.p === "number"
        ? parsed.p
        : typeof parsed?.pitch === "number"
          ? parsed.pitch
          : null;
    const isPitchType = parsed?.type === "pitch" || pitchRaw !== null;

    if (isPitchType && pitchRaw !== null && Number.isFinite(pitchRaw)) {
      const pitch = Number(pitchRaw);
      const volume = pitchToVolume(pitch);
      return JSON.stringify({
        pitch: Number(pitch.toFixed(2)),
        volume
      });
    }
  } catch {
    // Not JSON; keep original text protocol as-is.
  }
  return rawText;
}

function pitchToVolume(pitch) {
  // Map -60..+60 deg to 0..1 and clamp out-of-range values.
  const normalized = (pitch + 60) / 120;
  const clamped = Math.max(0, Math.min(1, normalized));
  return Number(clamped.toFixed(3));
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP + WS listening on :${PORT}`);
  console.log(`Serving static files from: ${fallbackDir}`);
});

function fsExists(targetPath) {
  try {
    return !!targetPath && fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function pickStaticDir(firstChoice, secondChoice) {
  const firstIndex = path.join(firstChoice, "index.html");
  const secondIndex = path.join(secondChoice, "index.html");
  if (fsExists(firstIndex)) {
    return firstChoice;
  }
  if (fsExists(secondIndex)) {
    return secondChoice;
  }
  return firstChoice;
}
