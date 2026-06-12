# RhythmWear: Wearable Web-Audio Interface


RhythmWear is a full-stack, real-time wearable music interface. It translates physical hand gestures into audio playback by streaming flex sensor data from an ESP32 microcontroller over WebSockets to a custom browser-based audio engine.

[![RhythmWear Hardware Demo](https://github.com/user-attachments/assets/ef3241e9-ee29-4498-8256-929b6aa91f64)](https://youtube.com/shorts/3LRIszfKmoY)

*Physical glove demo*

---

## Technical Architecture

The system bridges low-level embedded hardware with a modern web stack:

**1. Hardware & Firmware (Edge)**
* **ESP32 Microcontroller:** Programmed in C++ to rapidly poll analog flex sensors and pushbuttons.
* **Signal Processing:** Implemented custom filtering and delay logic directly on the ESP32 to solve sensor noise, improving trigger reliability and entirely eliminating double-fire events in live performance.
* **Data Formatting:** Packages raw ADC values (`RAW:v1,v2,v3,v4,v5,btn`) and triggered states (`F1:1`) into lightweight payloads.

**2. Network & Backend (Transport)**
* **WebSocket Server:** A Node.js/Express backend running locally (or on a Raspberry Pi) hosts the WS server on port 3000.
* **Real-Time Broadcasting:** Instantly broadcasts any incoming serial traffic from the ESP32 to all connected browser clients.

**3. Frontend Synthesis (Application)**
* **React + TypeScript UI:** Features live connection status, baseline sensor calibration, and real-time delta displays.
* **Web Audio API:** Immediately processes incoming `F*:1` WebSocket triggers to fire pre-loaded audio buffers.
* **Dynamic Presets:** Supports dynamic instrument switching (Drum Kit, Piano-C4 to A4) and custom user-uploaded `.wav` samples per finger.

---

## Repository Structure

* `/firmware` - ESP32 C++ source code, sensor polling, and filtering logic.
* `/web` - Full React/Vite frontend and Node.js WebSocket server.
* `/hardware` - Schematics and wiring diagrams for the flex sensor glove.

---

## Local Development & Deployment

To run the web engine and WebSocket server locally:

```bash
# Navigate to the web directory and install dependencies
cd web
npm install

# Run the Node.js Server (HTTP + WS on port 3000)
npm start

# In a separate terminal, run the Vite React frontend
npm run dev
```
---

## Authors
Ansh Shah · Mohammed Zayed · Kishore Ramesh · Ayaz Hasan
