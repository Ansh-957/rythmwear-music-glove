import WebSocket from "ws";

const WS_URL = process.env.WS_URL || "ws://127.0.0.1:3000/";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rand = (min, max) => min + Math.random() * (max - min);
const randint = (min, max) => Math.floor(rand(min, max + 1));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * ESP32 glove simulator.
 *
 * Data flow:
 * 1) Simulated sensor state is generated in loops (flex, raw analog values, pitch, button).
 * 2) Each loop emits protocol messages over WebSocket:
 *    - F#:1 / F#:0 for finger events
 *    - RAW:v1,v2,v3,v4,v5,btn for live analog stream
 *    - {"pitch":N} JSON for arm pitch/volume control
 *    - BTN:1 / BTN:0 for button toggles
 * 3) Node server forwards those messages to browser clients.
 * 4) Browser updates notes + volume from the forwarded stream.
 */
class Esp32GloveSimulator {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.stopped = false;

    // Finger bend state: true means currently bent.
    this.fingersBent = [false, false, false, false, false];
    this.fingerLevels = [0, 0, 0, 0, 0];

    // Baseline raw values per flex sensor.
    this.base = [420, 500, 530, 470, 450];
    this.btn = 0;

    this.pitchPhase = 0;
    this.nextFinger = 0;
  }

  start() {
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.connected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  connect() {
    if (this.stopped) {
      return;
    }
    console.log(`[SIM] Connecting to ${this.url}`);
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      this.connected = true;
      console.log("[SIM] Connected");
      this.send("HELLO:ESP32_GLOVE");
      this.send(`BASE:${this.base.map((v) => Math.round(v)).join(",")}`);
      this.startLoops();
    });

    this.ws.on("close", () => {
      const wasConnected = this.connected;
      this.connected = false;
      if (wasConnected) {
        console.log("[SIM] Disconnected");
      }
      if (!this.stopped) {
        setTimeout(() => this.connect(), 1200);
      }
    });

    this.ws.on("error", (err) => {
      console.error("[SIM] WebSocket error:", err.message);
    });
  }

  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(message);
  }

  async startLoops() {
    this.rawLoop();
    this.pitchLoop();
    this.fingerLoop();
    this.buttonLoop();
  }

  // Continuously emits RAW values with small noise and finger bend contributions.
  async rawLoop() {
    while (this.connected && !this.stopped) {
      for (let i = 0; i < 5; i += 1) {
        // Smooth in/out for each finger bend to avoid robotic steps.
        const target = this.fingersBent[i] ? rand(780, 1250) : rand(0, 20);
        this.fingerLevels[i] += (target - this.fingerLevels[i]) * 0.28;

        // Tiny baseline drift + analog noise.
        this.base[i] += rand(-0.15, 0.15);
        const noise = rand(-12, 12);

        this.fingerLevels[i] = clamp(this.fingerLevels[i], 0, 1800);
        this.base[i] = clamp(this.base[i], 300, 900);
      }

      const values = this.base.map((b, i) => Math.round(b + this.fingerLevels[i] + rand(-8, 8)));
      const rawMessage = `RAW:${values.join(",")},${this.btn}`;
      this.send(rawMessage);

      await sleep(randint(65, 95));
    }
  }

  // Emits smooth pitch changes as JSON.
  async pitchLoop() {
    while (this.connected && !this.stopped) {
      this.pitchPhase += 0.11;
      const pitch = 34 * Math.sin(this.pitchPhase) + 9 * Math.sin(this.pitchPhase * 0.37);
      this.send(JSON.stringify({ pitch: Number(pitch.toFixed(2)) }));
      await sleep(randint(120, 180));
    }
  }

  // Sequential finger taps with human-like delays.
  async fingerLoop() {
    while (this.connected && !this.stopped) {
      const finger = this.nextFinger;
      this.nextFinger = (this.nextFinger + 1) % 5;

      // Random slight gap between taps.
      await sleep(randint(280, 680));
      await this.tapFinger(finger);
    }
  }

  // Occasional button toggles.
  async buttonLoop() {
    while (this.connected && !this.stopped) {
      await sleep(randint(4500, 9000));
      this.btn = this.btn ? 0 : 1;
      this.send(`BTN:${this.btn}`);
    }
  }

  async tapFinger(index) {
    if (!this.connected || this.stopped) {
      return;
    }
    this.fingersBent[index] = true;
    this.send(`F${index + 1}:1`);

    // Hold duration (finger stays bent briefly).
    await sleep(randint(90, 220));

    this.fingersBent[index] = false;
    this.send(`F${index + 1}:0`);
  }
}

const simulator = new Esp32GloveSimulator(WS_URL);
simulator.start();

process.on("SIGINT", () => {
  console.log("\n[SIM] Stopping...");
  simulator.stop();
  process.exit(0);
});

