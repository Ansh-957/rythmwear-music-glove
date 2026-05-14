import { DEFAULT_WS_URL } from "../lib/constants";
import { clamp, randomInRange } from "../lib/utils";
import { DeviceState, FINGERS, Finger, SensorPacket } from "../types/app";

type PacketListener = (packet: SensorPacket, receivedAt: number) => void;
type StateListener = (state: DeviceState) => void;

const emptyFlex = (): Record<Finger, number> => ({
  thumb: 700,
  index: 820,
  middle: 840,
  ring: 760,
  pinky: 640
});

const normalizeSocketUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_WS_URL;
  }
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice(7)}`;
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice(8)}`;
  }
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }
  return `ws://${trimmed}`;
};

class DemoDataGenerator {
  private flex: Record<Finger, number> = emptyFlex();
  private imu = {
    roll: 0,
    pitch: 0,
    yaw: 0,
    gx: 0,
    gy: 0,
    gz: 0
  };

  private burstFinger: Finger | null = null;
  private burstLeft = 0;
  private tick = 0;

  next(): SensorPacket {
    this.tick += 1;
    if (!this.burstFinger && Math.random() > 0.88) {
      this.burstFinger = FINGERS[Math.floor(Math.random() * FINGERS.length)];
      this.burstLeft = Math.floor(randomInRange(2, 8));
    }

    for (const finger of FINGERS) {
      const drift = randomInRange(-35, 35);
      const base = this.flex[finger] + drift;
      let target = clamp(base, 400, 1200);
      if (this.burstFinger === finger && this.burstLeft > 0) {
        target = clamp(randomInRange(1700, 3000), 1600, 3200);
      }
      this.flex[finger] = target;
    }

    if (this.burstLeft > 0) {
      this.burstLeft -= 1;
      if (this.burstLeft <= 0) {
        this.burstFinger = null;
      }
    }

    this.imu.roll = clamp(this.imu.roll + randomInRange(-1.3, 1.3), -35, 35);
    this.imu.pitch = clamp(this.imu.pitch + randomInRange(-1.1, 1.1), -25, 25);
    this.imu.yaw = clamp(this.imu.yaw + randomInRange(-2.1, 2.1), -75, 75);
    this.imu.gx = clamp(randomInRange(-0.22, 0.22), -0.35, 0.35);
    this.imu.gy = clamp(randomInRange(-0.22, 0.22), -0.35, 0.35);
    this.imu.gz = clamp(randomInRange(-0.28, 0.28), -0.45, 0.45);

    return {
      t: this.tick,
      flex: { ...this.flex },
      imu: { ...this.imu }
    };
  }
}

export class DeviceManager {
  private ws: WebSocket | null = null;
  private demoTimer: number | null = null;
  private state: DeviceState = {
    mode: "disconnected",
    wsUrl: DEFAULT_WS_URL,
    messageRate: 0,
    lastPacket: null,
    lastReceivedAt: 0
  };
  private packetListeners = new Set<PacketListener>();
  private stateListeners = new Set<StateListener>();
  private messageTimes: number[] = [];
  private demoGenerator = new DemoDataGenerator();

  getState(): DeviceState {
    return this.state;
  }

  setWsUrl(url: string): void {
    this.state = { ...this.state, wsUrl: normalizeSocketUrl(url) };
    this.emitState();
  }

  connect(url = this.state.wsUrl): void {
    this.stopDemo();
    this.disconnectSocket();
    const normalized = normalizeSocketUrl(url);
    this.setWsUrl(normalized);
    this.state = { ...this.state, mode: "connecting", messageRate: 0 };
    this.emitState();

    this.ws = new WebSocket(normalized);
    this.ws.onopen = () => {
      this.state = { ...this.state, mode: "connected" };
      this.emitState();
    };
    this.ws.onclose = () => {
      if (this.state.mode !== "demo") {
        this.state = { ...this.state, mode: "disconnected", messageRate: 0 };
        this.emitState();
      }
    };
    this.ws.onerror = () => {
      this.state = { ...this.state, mode: "disconnected", messageRate: 0 };
      this.emitState();
    };
    this.ws.onmessage = (event) => {
      this.handleIncoming(event.data);
    };
  }

  disconnect(): void {
    this.stopDemo();
    this.disconnectSocket();
    this.state = { ...this.state, mode: "disconnected", messageRate: 0 };
    this.emitState();
  }

  startDemo(): void {
    this.disconnectSocket();
    this.stopDemo();
    this.state = { ...this.state, mode: "demo", messageRate: 0 };
    this.emitState();

    this.demoTimer = window.setInterval(() => {
      const packet = this.demoGenerator.next();
      this.publishPacket(packet);
    }, 33);
  }

  stopDemo(): void {
    if (this.demoTimer !== null) {
      window.clearInterval(this.demoTimer);
      this.demoTimer = null;
    }
  }

  onPacket(listener: PacketListener): () => void {
    this.packetListeners.add(listener);
    return () => this.packetListeners.delete(listener);
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  destroy(): void {
    this.disconnect();
    this.packetListeners.clear();
    this.stateListeners.clear();
  }

  private disconnectSocket(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private handleIncoming(raw: string): void {
    try {
      const packet = JSON.parse(raw) as SensorPacket;
      if (!packet.flex || !packet.imu || typeof packet.t !== "number") {
        return;
      }
      this.publishPacket(packet);
    } catch {
      // Ignore malformed packets from unstable streams.
    }
  }

  private publishPacket(packet: SensorPacket): void {
    const receivedAt = performance.now();
    this.messageTimes.push(receivedAt);
    const cutoff = receivedAt - 1000;
    while (this.messageTimes.length && this.messageTimes[0] < cutoff) {
      this.messageTimes.shift();
    }

    this.state = {
      ...this.state,
      messageRate: this.messageTimes.length,
      lastPacket: packet,
      lastReceivedAt: receivedAt
    };
    this.emitState();
    for (const listener of this.packetListeners) {
      listener(packet, receivedAt);
    }
  }

  private emitState(): void {
    for (const listener of this.stateListeners) {
      listener(this.state);
    }
  }
}
