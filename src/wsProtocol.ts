export type FingerIndex = 1 | 2 | 3 | 4 | 5;

export type ParsedWsMessage =
  | { type: "finger"; finger: FingerIndex; on: boolean }
  | { type: "button"; on: boolean }
  | { type: "raw"; values: [number, number, number, number, number]; button?: number }
  | { type: "base"; values: [number, number, number, number, number] }
  | { type: "pitch"; pitch: number; volume?: number }
  | { type: "unknown"; raw: string };

const toNumbers = (text: string): number[] =>
  text
    .split(",")
    .map((piece) => Number(piece.trim()))
    .filter((value) => Number.isFinite(value));

export function parseWsMessage(rawInput: string): ParsedWsMessage[] {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedWsMessage[] = [];

  for (const line of lines) {
    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        const data = JSON.parse(line) as { pitch?: unknown; volume?: unknown };
        if (typeof data.pitch === "number" && Number.isFinite(data.pitch)) {
          const volume =
            typeof data.volume === "number" && Number.isFinite(data.volume) ? data.volume : undefined;
          parsed.push({ type: "pitch", pitch: data.pitch, volume });
          continue;
        }
      } catch {
        // Keep parsing other supported line formats.
      }
    }

    const pitchMatch = line.match(/^PITCH\s*:\s*(-?\d+(\.\d+)?)$/i);
    if (pitchMatch) {
      parsed.push({ type: "pitch", pitch: Number(pitchMatch[1]) });
      continue;
    }

    const fingerMatch = line.match(/^F([1-5])\s*:\s*([01])$/i);
    if (fingerMatch) {
      parsed.push({
        type: "finger",
        finger: Number(fingerMatch[1]) as FingerIndex,
        on: fingerMatch[2] === "1"
      });
      continue;
    }

    const buttonMatch = line.match(/^BTN\s*:\s*([01])$/i);
    if (buttonMatch) {
      parsed.push({
        type: "button",
        on: buttonMatch[1] === "1"
      });
      continue;
    }

    const rawMatch = line.match(/^RAW\s*:\s*(.+)$/i);
    if (rawMatch) {
      const values = toNumbers(rawMatch[1]);
      if (values.length >= 5) {
        parsed.push({
          type: "raw",
          values: [values[0], values[1], values[2], values[3], values[4]],
          button: values[5]
        });
        continue;
      }
    }

    const baseMatch = line.match(/^BASE\s*:\s*(.+)$/i);
    if (baseMatch) {
      const values = toNumbers(baseMatch[1]);
      if (values.length >= 5) {
        parsed.push({
          type: "base",
          values: [values[0], values[1], values[2], values[3], values[4]]
        });
        continue;
      }
    }

    parsed.push({ type: "unknown", raw: line });
  }

  return parsed;
}
