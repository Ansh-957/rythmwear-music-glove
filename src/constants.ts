import {
  Finger,
  FingerMapping,
  FingerTriggerConfig,
  GestureMacro,
  MotionMapping,
  SampleItem,
  SequencerTrack
} from "../types/app";

export const DEFAULT_WS_URL = "http://10.69.59.117:3000";

export const DEFAULT_TRIGGER_CONFIG: Record<Finger, FingerTriggerConfig> = {
  thumb: { threshold: 1200, hysteresis: 120, debounceMs: 120, velocityMax: 3200 },
  index: { threshold: 1400, hysteresis: 120, debounceMs: 120, velocityMax: 3400 },
  middle: { threshold: 1400, hysteresis: 120, debounceMs: 120, velocityMax: 3400 },
  ring: { threshold: 1200, hysteresis: 120, debounceMs: 120, velocityMax: 3200 },
  pinky: { threshold: 1000, hysteresis: 120, debounceMs: 130, velocityMax: 3000 }
};

export const DEFAULT_FINGER_MAPPINGS: Record<Finger, FingerMapping> = {
  thumb: { finger: "thumb", mode: "drum", targetId: "kick" },
  index: { finger: "index", mode: "drum", targetId: "snare" },
  middle: { finger: "middle", mode: "drum", targetId: "hat" },
  ring: { finger: "ring", mode: "piano", targetId: "C4" },
  pinky: { finger: "pinky", mode: "sample", targetId: "sampler-vox-hit" }
};

export const PIANO_NOTES = [
  "C3",
  "D3",
  "E3",
  "F3",
  "G3",
  "A3",
  "B3",
  "C4",
  "D4",
  "E4",
  "F4",
  "G4",
  "A4",
  "B4",
  "C5"
];

export const DRUM_TARGETS = ["kick", "snare", "hat", "clap"] as const;

export const BUILTIN_SAMPLES: SampleItem[] = [
  {
    id: "sampler-vox-hit",
    name: "Vox Hit",
    source: "builtin",
    tags: ["vocal", "hit", "sampler-pack"],
    description: "Bright synthetic vox stab."
  },
  {
    id: "sampler-fx-rise",
    name: "FX Rise",
    source: "builtin",
    tags: ["fx", "riser", "sampler-pack"],
    description: "Noise riser swell."
  },
  {
    id: "sampler-pluck",
    name: "Pluck",
    source: "builtin",
    tags: ["instrument", "pluck", "sampler-pack"],
    description: "Short pluck synth tone."
  },
  {
    id: "sampler-bass-one",
    name: "Bass One",
    source: "builtin",
    tags: ["bass", "sampler-pack"],
    description: "Low mono bass hit."
  }
];

export const DEFAULT_MOTION_MAPPINGS: MotionMapping[] = [
  {
    id: "map-roll-filter",
    axis: "roll",
    parameter: "filterCutoff",
    sensitivity: 0.75,
    deadzone: 0.05,
    smoothing: 0.35
  },
  {
    id: "map-pitch-reverb",
    axis: "pitch",
    parameter: "reverbMix",
    sensitivity: 0.7,
    deadzone: 0.05,
    smoothing: 0.3
  },
  {
    id: "map-yaw-pan",
    axis: "yaw",
    parameter: "pan",
    sensitivity: 0.65,
    deadzone: 0.05,
    smoothing: 0.28
  },
  {
    id: "map-gz-delay",
    axis: "gz",
    parameter: "delayFeedback",
    sensitivity: 1,
    deadzone: 0.03,
    smoothing: 0.2
  }
];

export const DEFAULT_GESTURE_MACROS: GestureMacro[] = [
  {
    id: "macro-shake",
    name: "Shake = Stutter",
    enabled: true,
    type: "shake",
    action: "stutter"
  },
  {
    id: "macro-spin",
    name: "Spin = Tape Stop",
    enabled: true,
    type: "spin",
    action: "tapeStop"
  }
];

export const DEFAULT_LOOP_BARS = 2;
export const STEPS_PER_BAR = 16;

export const createDefaultTracks = (bars = DEFAULT_LOOP_BARS): SequencerTrack[] => {
  const totalSteps = bars * STEPS_PER_BAR;
  const blank = () => new Array<boolean>(totalSteps).fill(false);

  return [
    {
      id: "track-kick",
      name: "Kick",
      mode: "drum",
      targetId: "kick",
      volume: 0.9,
      pan: 0,
      steps: blank()
    },
    {
      id: "track-snare",
      name: "Snare",
      mode: "drum",
      targetId: "snare",
      volume: 0.85,
      pan: 0,
      steps: blank()
    },
    {
      id: "track-hat",
      name: "Hi-Hat",
      mode: "drum",
      targetId: "hat",
      volume: 0.8,
      pan: 0.05,
      steps: blank()
    },
    {
      id: "track-clap",
      name: "Clap",
      mode: "drum",
      targetId: "clap",
      volume: 0.75,
      pan: -0.05,
      steps: blank()
    }
  ];
};

export const TAB_IDS = ["play", "sampler", "studio", "motion", "settings"] as const;
export type TabId = (typeof TAB_IDS)[number];
