import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioEngine } from "./audio/AudioEngine";
import { parseWsMessage } from "./lib/wsProtocol";

type Tab = "home" | "presets" | "studio" | "upload" | "calibration" | "settings";
type Preset = "drum" | "piano" | "custom";
type FingerKey = "F1" | "F2" | "F3" | "F4" | "F5";

interface CustomSampleMeta {
  name: string;
  dataUrl: string;
}

interface StudioClip {
  id: string;
  sampleId: string;
  lane: number;
  start: number;
  length: number;
}

type FingerMap = Record<FingerKey, string>;
type CustomSampleMap = Record<FingerKey, CustomSampleMeta | null>;
type FingerStateMap = Record<FingerKey, boolean>;
type FingerStepLatch = Record<FingerKey, number>;

const FINGERS: FingerKey[] = ["F1", "F2", "F3", "F4", "F5"];
const LS_WS_URL = "rythmwear_ws_url_v1";
const LS_PRESET = "rythmwear_preset_v1";
const LS_CUSTOM = "rythmwear_custom_samples_v1";
const LS_AUTO_RECONNECT = "rythmwear_auto_reconnect_v1";

const RAW_TRIGGER_OFFSET = 80;
const RAW_TRIGGER_HYSTERESIS = 40;
const STUDIO_STEPS = 32;
const STUDIO_LANES = 5;
const DEFAULT_CLIP_LENGTH = 4;
const STUDIO_MIN_AUDIBLE_VOLUME = 0.2;

const defaultWsUrl = () =>
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/`;

const normalizeWsUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return defaultWsUrl();
  }
  try {
    if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
      return new URL(trimmed).toString();
    }
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const httpUrl = new URL(trimmed);
      httpUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
      return httpUrl.toString();
    }
    return new URL(`ws://${trimmed}`).toString();
  } catch {
    return defaultWsUrl();
  }
};

const emptyRaw = (): [number, number, number, number, number] => [0, 0, 0, 0, 0];
const emptyFingerState = (): FingerStateMap => ({ F1: false, F2: false, F3: false, F4: false, F5: false });
const emptyCustomSamples = (): CustomSampleMap => ({ F1: null, F2: null, F3: null, F4: null, F5: null });
const emptyFingerStepLatch = (): FingerStepLatch => ({ F1: -1, F2: -1, F3: -1, F4: -1, F5: -1 });

const drumMap: FingerMap = {
  F1: "kick",
  F2: "snare",
  F3: "hihat",
  F4: "clap",
  F5: "tom"
};

const pianoMap: FingerMap = {
  F1: "piano-c4",
  F2: "piano-d4",
  F3: "piano-e4",
  F4: "piano-g4",
  F5: "piano-a4"
};

const customMap: FingerMap = {
  F1: "custom-f1",
  F2: "custom-f2",
  F3: "custom-f3",
  F4: "custom-f4",
  F5: "custom-f5"
};

const customIdToFinger = (sampleId: string): FingerKey | null => {
  const match = sampleId.match(/^custom-(f[1-5])$/i);
  if (!match) {
    return null;
  }
  return match[1].toUpperCase() as FingerKey;
};

function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [connection, setConnection] = useState<"disconnected" | "connecting" | "connected">(
    "disconnected"
  );
  const [wsInput, setWsInput] = useState(() =>
    normalizeWsUrl(window.localStorage.getItem(LS_WS_URL) ?? defaultWsUrl())
  );
  const [autoReconnect, setAutoReconnect] = useState(() =>
    (window.localStorage.getItem(LS_AUTO_RECONNECT) ?? "1") === "1"
  );
  const [preset, setPreset] = useState<Preset>(
    () => (window.localStorage.getItem(LS_PRESET) as Preset | null) ?? "drum"
  );
  const [audioArmed, setAudioArmed] = useState(false);
  const [rawValues, setRawValues] = useState<[number, number, number, number, number]>(emptyRaw());
  const [baselineValues, setBaselineValues] = useState<[number, number, number, number, number] | null>(
    null
  );
  const [buttonState, setButtonState] = useState(false);
  const [fingerStates, setFingerStates] = useState<FingerStateMap>(emptyFingerState());
  const [lastMessage, setLastMessage] = useState("None");
  const [lastTrigger, setLastTrigger] = useState("None");
  const [pitchDegrees, setPitchDegrees] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [studioPlaying, setStudioPlaying] = useState(false);
  const [studioStep, setStudioStep] = useState(0);
  const [studioBpm, setStudioBpm] = useState(120);
  const [defaultClipLength, setDefaultClipLength] = useState(DEFAULT_CLIP_LENGTH);
  const [studioClips, setStudioClips] = useState<StudioClip[]>([]);
  const [studioRecording, setStudioRecording] = useState(false);
  const [recordLane, setRecordLane] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const [customSamples, setCustomSamples] = useState<CustomSampleMap>(() => {
    const saved = window.localStorage.getItem(LS_CUSTOM);
    if (!saved) {
      return emptyCustomSamples();
    }
    try {
      const parsed = JSON.parse(saved) as CustomSampleMap;
      return {
        F1: parsed.F1 ?? null,
        F2: parsed.F2 ?? null,
        F3: parsed.F3 ?? null,
        F4: parsed.F4 ?? null,
        F5: parsed.F5 ?? null
      };
    } catch {
      return emptyCustomSamples();
    }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const wsInputRef = useRef(wsInput);
  const reconnectTimerRef = useRef<number | null>(null);
  const manualDisconnectRef = useRef(false);
  const activeWsUrlRef = useRef(wsInput);
  const autoReconnectRef = useRef(autoReconnect);
  const audioArmedRef = useRef(audioArmed);
  const baselineValuesRef = useRef<[number, number, number, number, number] | null>(baselineValues);
  const audioRef = useRef(new AudioEngine());
  const customHydratedRef = useRef(false);
  const activeMapRef = useRef<FingerMap>(drumMap);
  const sawFingerEventsRef = useRef(false);
  const rawLatchedRef = useRef<FingerStateMap>(emptyFingerState());
  const rawMinRef = useRef<[number, number, number, number, number]>([
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY
  ]);
  const studioStepRef = useRef(0);
  const studioClipsRef = useRef<StudioClip[]>([]);
  const studioPlayingRef = useRef(studioPlaying);
  const studioRecordingRef = useRef(studioRecording);
  const recordLaneRef = useRef(recordLane);
  const recordedStepLatchRef = useRef<FingerStepLatch>(emptyFingerStepLatch());

  useEffect(() => {
    autoReconnectRef.current = autoReconnect;
  }, [autoReconnect]);

  useEffect(() => {
    wsInputRef.current = wsInput;
  }, [wsInput]);

  useEffect(() => {
    audioArmedRef.current = audioArmed;
  }, [audioArmed]);

  useEffect(() => {
    baselineValuesRef.current = baselineValues;
  }, [baselineValues]);

  useEffect(() => {
    studioStepRef.current = studioStep;
  }, [studioStep]);

  useEffect(() => {
    studioClipsRef.current = studioClips;
  }, [studioClips]);

  useEffect(() => {
    studioPlayingRef.current = studioPlaying;
  }, [studioPlaying]);

  useEffect(() => {
    studioRecordingRef.current = studioRecording;
  }, [studioRecording]);

  useEffect(() => {
    recordLaneRef.current = recordLane;
  }, [recordLane]);

  const activeMap = useMemo(() => {
    if (preset === "drum") {
      return drumMap;
    }
    if (preset === "piano") {
      return pianoMap;
    }
    return customMap;
  }, [preset]);

  useEffect(() => {
    activeMapRef.current = activeMap;
  }, [activeMap]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const armAudio = useCallback(async () => {
    await audioRef.current.initialize();
    audioRef.current.setMasterVolume(masterVolume);
    setAudioArmed(true);
    if (!customHydratedRef.current) {
      for (const finger of FINGERS) {
        const meta = customSamples[finger];
        if (!meta?.dataUrl) {
          continue;
        }
        try {
          const buffer = await audioRef.current.decodeDataUrl(meta.dataUrl);
          audioRef.current.registerSample(`custom-${finger.toLowerCase()}`, buffer);
        } catch {
          // Ignore bad persisted sample payloads.
        }
      }
      customHydratedRef.current = true;
    }
  }, [customSamples, masterVolume]);

  const fireTrigger = useCallback((fingerKey: FingerKey, source: "event" | "raw") => {
    const mappedId = activeMapRef.current[fingerKey];
    let soundId = mappedId;

    if (!audioRef.current.hasSample(soundId)) {
      // If a custom slot is missing/unreadable, fall back to a guaranteed built-in note.
      soundId = pianoMap[fingerKey];
    }

    if (audioArmedRef.current && soundId && audioRef.current.hasSample(soundId)) {
      audioRef.current.playSample(soundId, 0.95);
      const triggerText = soundId === mappedId ? `${fingerKey} -> ${mappedId}` : `${fingerKey} -> ${mappedId} (fallback ${soundId})`;
      setLastTrigger(triggerText);
    } else {
      setLastTrigger(`${fingerKey} detected (${source}) - click Arm Audio`);
    }

    if (!studioRecordingRef.current || !soundId) {
      return;
    }

    const currentStep = studioStepRef.current;
    const lastStep = recordedStepLatchRef.current[fingerKey];
    if (lastStep === currentStep) {
      return;
    }
    recordedStepLatchRef.current[fingerKey] = currentStep;

    const lane = recordLaneRef.current;
    setStudioClips((prev) => [
      ...prev,
      {
        id: `${soundId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        sampleId: soundId,
        lane,
        start: currentStep,
        length: 1
      }
    ]);
  }, []);

  const handleIncomingData = useCallback(
    (raw: string) => {
      setLastMessage(raw);
      const parsed = parseWsMessage(raw);
      if (!parsed.length) {
        return;
      }

      for (const message of parsed) {
        if (message.type === "raw") {
          setRawValues(message.values);
          if (typeof message.button === "number") {
            setButtonState(message.button === 1);
          }

          if (!sawFingerEventsRef.current) {
            const nextFingerStates: FingerStateMap = { ...rawLatchedRef.current };
            for (let i = 0; i < FINGERS.length; i += 1) {
              const finger = FINGERS[i];
              const value = message.values[i];
              rawMinRef.current[i] = Math.min(rawMinRef.current[i], value);

              const baseline = baselineValuesRef.current?.[i] ?? rawMinRef.current[i];
              const threshold = baseline + RAW_TRIGGER_OFFSET;
              const release = threshold - RAW_TRIGGER_HYSTERESIS;
              const isLatched = rawLatchedRef.current[finger];

              if (!isLatched && value >= threshold) {
                rawLatchedRef.current[finger] = true;
                nextFingerStates[finger] = true;
                fireTrigger(finger, "raw");
              } else if (isLatched && value <= release) {
                rawLatchedRef.current[finger] = false;
                nextFingerStates[finger] = false;
              } else {
                nextFingerStates[finger] = isLatched;
              }
            }
            setFingerStates(nextFingerStates);
          }
          continue;
        }

        if (message.type === "base") {
          setBaselineValues(message.values);
          continue;
        }

        if (message.type === "button") {
          setButtonState(message.on);
          continue;
        }

        if (message.type === "pitch") {
          const pitch = message.pitch;
          const computedVolume = message.volume ?? Math.max(0, Math.min(1, (pitch + 60) / 120));
          const inStudioPlaybackOnly = tab === "studio" && studioPlayingRef.current && !studioRecordingRef.current;
          const safeVolume = inStudioPlaybackOnly
            ? Math.max(computedVolume, STUDIO_MIN_AUDIBLE_VOLUME)
            : computedVolume;
          setPitchDegrees(pitch);
          setMasterVolume(safeVolume);
          if (audioArmedRef.current) {
            audioRef.current.setMasterVolume(safeVolume);
          }
          continue;
        }

        if (message.type === "finger") {
          sawFingerEventsRef.current = true;
          const fingerKey = `F${message.finger}` as FingerKey;
          rawLatchedRef.current[fingerKey] = message.on;
          setFingerStates((prev) => {
            const wasOn = prev[fingerKey];
            if (message.on && !wasOn) {
              fireTrigger(fingerKey, "event");
            }
            if (message.on === wasOn) {
              return prev;
            }
            return { ...prev, [fingerKey]: message.on };
          });
          continue;
        }
      }
    },
    [fireTrigger, tab]
  );

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    clearReconnectTimer();
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnection("disconnected");
  }, [clearReconnectTimer]);

  const connect = useCallback(
    (input?: string) => {
      clearReconnectTimer();
      const normalized = normalizeWsUrl(input ?? wsInputRef.current);
      activeWsUrlRef.current = normalized;
      setWsInput(normalized);
      manualDisconnectRef.current = false;

      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      setConnection("connecting");
      sawFingerEventsRef.current = false;
      rawLatchedRef.current = emptyFingerState();
      rawMinRef.current = [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY
      ];
      const socket = new WebSocket(normalized);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnection("connected");
      };

      socket.onmessage = (event) => {
        const text = typeof event.data === "string" ? event.data : String(event.data);
        handleIncomingData(text);
      };

      socket.onerror = () => {
        // Close handler will manage reconnect.
      };

      socket.onclose = () => {
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        setConnection("disconnected");
        if (!manualDisconnectRef.current && autoReconnectRef.current) {
          reconnectTimerRef.current = window.setTimeout(() => {
            connect(activeWsUrlRef.current);
          }, 1500);
        }
      };
    },
    [clearReconnectTimer, handleIncomingData]
  );

  useEffect(() => {
    window.localStorage.setItem(LS_WS_URL, wsInput);
  }, [wsInput]);

  useEffect(() => {
    window.localStorage.setItem(LS_PRESET, preset);
  }, [preset]);

  useEffect(() => {
    window.localStorage.setItem(LS_AUTO_RECONNECT, autoReconnect ? "1" : "0");
  }, [autoReconnect]);

  useEffect(() => {
    window.localStorage.setItem(LS_CUSTOM, JSON.stringify(customSamples));
  }, [customSamples]);

  useEffect(() => {
    connect(activeWsUrlRef.current);
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const handleUpload = useCallback(
    async (finger: FingerKey, file: File) => {
      await armAudio();
      const buffer = await audioRef.current.decodeAudioFile(file);
      const sampleId = `custom-${finger.toLowerCase()}`;
      audioRef.current.registerSample(sampleId, buffer);

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      setCustomSamples((prev) => ({
        ...prev,
        [finger]: {
          name: file.name,
          dataUrl
        }
      }));
    },
    [armAudio]
  );

  const previewCustom = useCallback(
    async (finger: FingerKey) => {
      await armAudio();
      const id = `custom-${finger.toLowerCase()}`;
      if (audioRef.current.hasSample(id)) {
        audioRef.current.playSample(id, 0.95);
      }
    },
    [armAudio]
  );

  const baselineDelta = useMemo(() => {
    if (!baselineValues) {
      return null;
    }
    return rawValues.map((value, index) => value - baselineValues[index]) as [
      number,
      number,
      number,
      number,
      number
    ];
  }, [baselineValues, rawValues]);

  const soundLibrary = useMemo(() => {
    const unique = new Map<string, { sampleId: string; label: string }>();
    for (const sampleId of Object.values(activeMap)) {
      unique.set(sampleId, { sampleId, label: sampleId });
    }
    for (const finger of FINGERS) {
      const custom = customSamples[finger];
      if (custom) {
        const id = `custom-${finger.toLowerCase()}`;
        unique.set(id, { sampleId: id, label: `${finger} - ${custom.name}` });
      }
    }
    return [...unique.values()];
  }, [activeMap, customSamples]);

  const playStudioStep = useCallback((step: number) => {
    if (!audioArmedRef.current) {
      return;
    }
    for (const clip of studioClipsRef.current) {
      if (clip.start !== step) {
        continue;
      }

      let sampleId = clip.sampleId;
      if (!audioRef.current.hasSample(sampleId)) {
        const fingerKey = customIdToFinger(sampleId);
        if (fingerKey) {
          sampleId = pianoMap[fingerKey];
        }
      }

      if (audioRef.current.hasSample(sampleId)) {
        audioRef.current.playSample(sampleId, 0.9);
      }
    }
  }, []);

  useEffect(() => {
    if (!studioPlaying) {
      return;
    }
    const stepMs = (60_000 / studioBpm) / 4;

    // Fire the current playhead step immediately so playback starts audibly on press.
    playStudioStep(studioStepRef.current);

    const timer = window.setInterval(() => {
      const next = (studioStepRef.current + 1) % STUDIO_STEPS;
      studioStepRef.current = next;
      setStudioStep(next);
      playStudioStep(next);
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [studioPlaying, studioBpm, playStudioStep]);

  useEffect(() => {
    if (studioPlaying) {
      return;
    }
    if (studioRecording) {
      setStudioRecording(false);
    }
  }, [studioPlaying, studioRecording]);

  const createClip = useCallback((sampleId: string, lane: number, start: number) => {
    setStudioClips((prev) => [
      ...prev,
      {
        id: `${sampleId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        sampleId,
        lane,
        start,
        length: defaultClipLength
      }
    ]);
  }, [defaultClipLength]);

  const moveClip = useCallback((clipId: string, lane: number, start: number) => {
    setStudioClips((prev) =>
      prev.map((clip) => (clip.id === clipId ? { ...clip, lane, start } : clip))
    );
  }, []);

  const removeClip = useCallback((clipId: string) => {
    setStudioClips((prev) => prev.filter((clip) => clip.id !== clipId));
    setSelectedClipId((prev) => (prev === clipId ? null : prev));
  }, []);

  const startStudioPlayback = useCallback(
    async (resetStep: boolean) => {
      await armAudio();
      const safeVolume = Math.max(masterVolume, STUDIO_MIN_AUDIBLE_VOLUME);
      if (safeVolume !== masterVolume) {
        setMasterVolume(safeVolume);
        audioRef.current.setMasterVolume(safeVolume);
      }

      if (resetStep) {
        studioStepRef.current = 0;
        setStudioStep(0);
      }
      setStudioPlaying(true);
    },
    [armAudio, masterVolume]
  );

  const toggleStudioRecording = useCallback(async () => {
    if (studioRecordingRef.current) {
      setStudioRecording(false);
      const safeVolume = Math.max(masterVolume, STUDIO_MIN_AUDIBLE_VOLUME);
      if (safeVolume !== masterVolume) {
        setMasterVolume(safeVolume);
        if (audioArmedRef.current) {
          audioRef.current.setMasterVolume(safeVolume);
        }
      }
      return;
    }

    recordedStepLatchRef.current = emptyFingerStepLatch();
    await startStudioPlayback(true);
    setStudioRecording(true);
  }, [startStudioPlayback]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (tab !== "studio") {
        return;
      }
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (!selectedClipId) {
        return;
      }
      event.preventDefault();
      removeClip(selectedClipId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab, selectedClipId, removeClip]);

  return (
    <div className="app">
      <header className="header">
        <h1>RythmWear</h1>
        <p>Live flex-triggered audio demo with FL-style playlist studio.</p>
      </header>

      <nav className="tabs">
        <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")} type="button">
          Home
        </button>
        <button className={tab === "presets" ? "active" : ""} onClick={() => setTab("presets")} type="button">
          Presets
        </button>
        <button className={tab === "studio" ? "active" : ""} onClick={() => setTab("studio")} type="button">
          Studio
        </button>
        <button className={tab === "upload" ? "active" : ""} onClick={() => setTab("upload")} type="button">
          Upload Samples
        </button>
        <button className={tab === "calibration" ? "active" : ""} onClick={() => setTab("calibration")} type="button">
          Calibration
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")} type="button">
          Settings
        </button>
      </nav>

      {tab === "home" && (
        <section className="panel">
          <div className="row">
            <button onClick={() => void armAudio()} type="button">
              {audioArmed ? "Audio Armed" : "Arm Audio"}
            </button>
            <span className={`badge ${connection}`}>{connection.toUpperCase()}</span>
            <span className="muted">Preset: {preset}</span>
            <span className="muted">BTN: {buttonState ? "ON" : "OFF"}</span>
            <span className="muted">Pitch: {pitchDegrees.toFixed(1)} deg</span>
            <span className="muted">Volume: {masterVolume.toFixed(2)}</span>
          </div>
          {!audioArmed && <div className="muted">Sound is locked by browser until you click Arm Audio once.</div>}

          <div className="grid-5">
            {FINGERS.map((finger, index) => (
              <div className={`sensor-card ${fingerStates[finger] ? "active" : ""}`} key={finger}>
                <strong>{finger}</strong>
                <span>{rawValues[index]}</span>
                <small>{activeMap[finger]}</small>
              </div>
            ))}
          </div>

          <div className="stack">
            <div>Last trigger: {lastTrigger}</div>
            <div className="mono">Last message: {lastMessage}</div>
          </div>
        </section>
      )}

      {tab === "presets" && (
        <section className="panel">
          <div className="row">
            <button className={preset === "drum" ? "active" : ""} onClick={() => setPreset("drum")} type="button">
              Drum Kit
            </button>
            <button className={preset === "piano" ? "active" : ""} onClick={() => setPreset("piano")} type="button">
              Piano
            </button>
            <button className={preset === "custom" ? "active" : ""} onClick={() => setPreset("custom")} type="button">
              Custom
            </button>
          </div>

          <div className="mapping-table">
            {FINGERS.map((finger) => (
              <div className="mapping-row" key={finger}>
                <span>{finger}</span>
                <span>{activeMap[finger]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "studio" && (
        <section className="panel">
          <div className="row">
            <button
              onClick={() => {
                if (studioPlaying) {
                  setStudioPlaying(false);
                } else {
                  void startStudioPlayback(true);
                }
              }}
              type="button"
            >
              {studioPlaying ? "Stop" : "Play"}
            </button>
            <button
              className={studioRecording ? "recording" : ""}
              onClick={() => {
                void toggleStudioRecording();
              }}
              type="button"
            >
              {studioRecording ? "Stop Record" : "Record"}
            </button>
            <label>
              BPM
              <input
                type="number"
                min={60}
                max={180}
                value={studioBpm}
                onChange={(event) =>
                  setStudioBpm(Math.max(60, Math.min(180, Number(event.target.value) || 120)))
                }
              />
            </label>
            <label>
              Clip Length
              <select value={defaultClipLength} onChange={(event) => setDefaultClipLength(Number(event.target.value))}>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
            </label>
            <label>
              Record Lane
              <select value={recordLane} onChange={(event) => setRecordLane(Number(event.target.value))}>
                {Array.from({ length: STUDIO_LANES }, (_, lane) => (
                  <option key={`record-lane-${lane}`} value={lane}>
                    Lane {lane + 1}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                setStudioClips([]);
                setSelectedClipId(null);
              }}
              type="button"
            >
              Clear Playlist
            </button>
            <span className="muted">Step: {studioStep + 1}/{STUDIO_STEPS}</span>
            <span className="muted">
              {selectedClipId ? "Backspace/Delete removes selected clip" : "Select a clip, then Backspace/Delete"}
            </span>
          </div>

          <div className="studio-layout">
            <aside className="channel-rack">
              <h3>Channel Rack</h3>
              <p className="muted">Drag sounds into playlist lanes. Double click to preview.</p>
              <div className="rack-list">
                {soundLibrary.map((sound) => (
                  <div
                    key={sound.sampleId}
                    className="rack-item"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "text/plain",
                        JSON.stringify({ type: "new", sampleId: sound.sampleId })
                      );
                    }}
                    onDoubleClick={() => {
                      if (audioArmedRef.current && audioRef.current.hasSample(sound.sampleId)) {
                        audioRef.current.playSample(sound.sampleId, 0.9);
                      }
                    }}
                  >
                    {sound.label}
                  </div>
                ))}
              </div>
            </aside>

            <div className="playlist-roll">
              <div className="timeline">
                {Array.from({ length: STUDIO_STEPS }, (_, step) => (
                  <div key={`time-${step}`} className={`time-cell ${studioStep === step ? "playhead" : ""}`}>
                    {step % 4 === 0 ? step + 1 : ""}
                  </div>
                ))}
              </div>
              {Array.from({ length: STUDIO_LANES }, (_, lane) => (
                <div
                  key={`lane-${lane}`}
                  className="playlist-lane"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const data = event.dataTransfer.getData("text/plain");
                    const target = event.target as HTMLElement;
                    const stepText = target.getAttribute("data-step");
                    if (!stepText || !data) {
                      return;
                    }
                    const start = Math.max(0, Math.min(STUDIO_STEPS - 1, Number(stepText)));
                    try {
                      const payload = JSON.parse(data) as
                        | { type: "new"; sampleId: string }
                        | { type: "move"; clipId: string };
                      if (payload.type === "new") {
                        createClip(payload.sampleId, lane, start);
                      } else {
                        moveClip(payload.clipId, lane, start);
                      }
                    } catch {
                      // Ignore invalid drag payloads.
                    }
                  }}
                >
                  {Array.from({ length: STUDIO_STEPS }, (_, step) => (
                    <div
                      key={`lane-${lane}-step-${step}`}
                      data-step={step}
                      className={`lane-cell ${studioStep === step ? "playhead" : ""}`}
                    />
                  ))}
                  {studioClips
                    .filter((clip) => clip.lane === lane)
                    .map((clip) => (
                      <div
                        key={clip.id}
                        className={`clip ${selectedClipId === clip.id ? "selected" : ""}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({ type: "move", clipId: clip.id })
                          );
                        }}
                        onClick={() => setSelectedClipId(clip.id)}
                        onDoubleClick={() => removeClip(clip.id)}
                        title="Double click to delete clip"
                        style={{
                          gridColumn: `${clip.start + 1} / span ${Math.min(clip.length, STUDIO_STEPS - clip.start)}`
                        }}
                      >
                        {clip.sampleId}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "upload" && (
        <section className="panel">
          <p>Upload one custom sample per finger. Data is persisted in browser localStorage.</p>
          <div className="upload-list">
            {FINGERS.map((finger) => (
              <div className="upload-row" key={finger}>
                <span>{finger}</span>
                <span>{customSamples[finger]?.name ?? "No sample uploaded"}</span>
                <label className="file-btn">
                  Upload
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUpload(finger, file);
                      }
                    }}
                  />
                </label>
                <button onClick={() => void previewCustom(finger)} type="button">
                  Preview
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "calibration" && (
        <section className="panel">
          <h3>RAW Values</h3>
          <div className="mapping-table">
            {FINGERS.map((finger, index) => (
              <div className="mapping-row" key={finger}>
                <span>{finger}</span>
                <span>{rawValues[index]}</span>
              </div>
            ))}
          </div>

          <h3>Baseline (BASE)</h3>
          <div className="mapping-table">
            {FINGERS.map((finger, index) => (
              <div className="mapping-row" key={finger}>
                <span>{finger}</span>
                <span>{baselineValues ? baselineValues[index] : "-"}</span>
              </div>
            ))}
          </div>

          <h3>Delta (RAW - BASE)</h3>
          <div className="mapping-table">
            {FINGERS.map((finger, index) => (
              <div className="mapping-row" key={finger}>
                <span>{finger}</span>
                <span>{baselineDelta ? baselineDelta[index] : "-"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="panel">
          <div className="stack">
            <label>
              WebSocket URL
              <input value={wsInput} onChange={(event) => setWsInput(event.target.value)} />
            </label>
            <div className="row">
              <button
                onClick={() => {
                  void armAudio();
                  connect(wsInput);
                }}
                type="button"
              >
                Connect
              </button>
              <button onClick={disconnect} type="button">
                Disconnect
              </button>
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={autoReconnect}
                onChange={(event) => setAutoReconnect(event.target.checked)}
              />
              Auto reconnect
            </label>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
