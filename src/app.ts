export const FINGERS = ["thumb", "index", "middle", "ring", "pinky"] as const;
export type Finger = (typeof FINGERS)[number];

export const IMU_AXES = ["roll", "pitch", "yaw", "gx", "gy", "gz"] as const;
export type ImuAxis = (typeof IMU_AXES)[number];

export interface SensorPacket {
  t: number;
  flex: Record<Finger, number>;
  imu: {
    roll: number;
    pitch: number;
    yaw: number;
    gx: number;
    gy: number;
    gz: number;
  };
}

export interface FingerTriggerConfig {
  threshold: number;
  hysteresis: number;
  debounceMs: number;
  velocityMax: number;
}

export type MappingMode = "none" | "piano" | "drum" | "sample";

export interface FingerMapping {
  finger: Finger;
  mode: MappingMode;
  targetId: string;
}

export interface SampleItem {
  id: string;
  name: string;
  source: "builtin" | "user";
  tags: string[];
  description: string;
}

export type DrumId = "kick" | "snare" | "hat" | "clap";

export interface MotionMapping {
  id: string;
  axis: ImuAxis;
  parameter: MotionParameter;
  sensitivity: number;
  deadzone: number;
  smoothing: number;
}

export type MotionParameter =
  | "filterCutoff"
  | "pitchBend"
  | "reverbMix"
  | "pan"
  | "volume"
  | "playbackRate"
  | "delayFeedback";

export interface PerformanceState {
  bpm: number;
  quantize: "off" | "1/4" | "1/8" | "1/16";
  metronomeOn: boolean;
  isRecording: boolean;
  isArmed: boolean;
}

export interface DeviceState {
  mode: "disconnected" | "connecting" | "connected" | "demo";
  wsUrl: string;
  messageRate: number;
  lastPacket: SensorPacket | null;
  lastReceivedAt: number;
}

export interface CalibrationState {
  openHand: Record<Finger, number> | null;
  closedFist: Record<Finger, number> | null;
}

export interface GestureMacro {
  id: string;
  name: string;
  enabled: boolean;
  type: "shake" | "spin";
  action: "stutter" | "tapeStop";
}

export interface SequencerTrack {
  id: string;
  name: string;
  mode: Exclude<MappingMode, "none">;
  targetId: string;
  volume: number;
  pan: number;
  steps: boolean[];
}

export interface RecordedEvent {
  id: string;
  trackId: string;
  step: number;
  velocity: number;
}

export interface SequencerProject {
  bpm: number;
  quantize: PerformanceState["quantize"];
  loopBars: number;
  tracks: SequencerTrack[];
  recordedEvents: RecordedEvent[];
}

export interface ImportedSettings {
  wsUrl: string;
  triggerConfig: Record<Finger, FingerTriggerConfig>;
  fingerMappings: Record<Finger, FingerMapping>;
  motionMappings: MotionMapping[];
  calibration: CalibrationState;
}
