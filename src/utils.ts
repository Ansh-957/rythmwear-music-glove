export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const noteToFrequency = (note: string): number => {
  const noteMap: Record<string, number> = {
    C: 0,
    "C#": 1,
    D: 2,
    "D#": 3,
    E: 4,
    F: 5,
    "F#": 6,
    G: 7,
    "G#": 8,
    A: 9,
    "A#": 10,
    B: 11
  };

  const match = note.match(/^([A-G]#?)(-?\d)$/);
  if (!match) {
    return 440;
  }
  const [, pitch, octaveText] = match;
  const octave = Number(octaveText);
  const semitone = noteMap[pitch];
  const midi = semitone + (octave + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

export const randomInRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const uid = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

export const formatMs = (value: number): string => `${value.toFixed(1)} ms`;
