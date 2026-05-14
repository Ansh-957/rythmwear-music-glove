import { FlexVisualizer } from "../components/FlexVisualizer";
import { GyroVisualizer } from "../components/GyroVisualizer";
import { DRUM_TARGETS, PIANO_NOTES } from "../lib/constants";
import {
  Finger,
  FingerMapping,
  FingerTriggerConfig,
  PerformanceState,
  SampleItem,
  SensorPacket
} from "../types/app";

interface PlayTabProps {
  performance: PerformanceState;
  activePreset: string;
  onPresetChange: (preset: string) => void;
  onToggleArmed: () => void;
  onBpmChange: (bpm: number) => void;
  onQuantizeChange: (quantize: PerformanceState["quantize"]) => void;
  onToggleMetronome: () => void;
  onToggleRecording: () => void;
  fingerMappings: Record<Finger, FingerMapping>;
  onMappingChange: (finger: Finger, mode: FingerMapping["mode"], targetId: string) => void;
  packet: SensorPacket | null;
  flexHistories: Record<Finger, number[]>;
  triggerConfig: Record<Finger, FingerTriggerConfig>;
  triggeredFinger: Finger | null;
  gyroHistory: Array<{ raw: number; smoothed: number }>;
  activeGyroAxisLabel: string;
  samples: SampleItem[];
}

const PRESETS = ["Basic Drum Kit", "Piano", "Sampler Pack"];

export function PlayTab({
  performance,
  activePreset,
  onPresetChange,
  onToggleArmed,
  onBpmChange,
  onQuantizeChange,
  onToggleMetronome,
  onToggleRecording,
  fingerMappings,
  onMappingChange,
  packet,
  flexHistories,
  triggerConfig,
  triggeredFinger,
  gyroHistory,
  activeGyroAxisLabel,
  samples
}: PlayTabProps) {
  return (
    <div className="tab-content play-tab">
      <section className="card ready-card">
        <div className="ready-controls">
          <button
            className={`arm-btn ${performance.isArmed ? "armed" : ""}`}
            onClick={onToggleArmed}
            type="button"
            title="Arms audio context and live glove triggering"
          >
            {performance.isArmed ? "Armed / Ready" : "Arm Audio + Ready"}
          </button>
          <label>
            Active Preset
            <select value={activePreset} onChange={(event) => onPresetChange(event.target.value)}>
              {PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="hud" role="status" aria-label="Performance HUD">
          <div>
            <span>BPM</span>
            <input
              type="number"
              min={50}
              max={200}
              value={performance.bpm}
              onChange={(event) => onBpmChange(Number(event.target.value))}
            />
          </div>
          <div>
            <span>Quantize</span>
            <select
              value={performance.quantize}
              onChange={(event) =>
                onQuantizeChange(event.target.value as PerformanceState["quantize"])
              }
            >
              <option value="off">Off</option>
              <option value="1/4">1/4</option>
              <option value="1/8">1/8</option>
              <option value="1/16">1/16</option>
            </select>
          </div>
          <button
            className={`toggle-btn ${performance.metronomeOn ? "on" : ""}`}
            onClick={onToggleMetronome}
            type="button"
            title="M keyboard shortcut"
          >
            Metronome {performance.metronomeOn ? "On" : "Off"}
          </button>
          <button
            className={`toggle-btn ${performance.isRecording ? "rec" : ""}`}
            onClick={onToggleRecording}
            type="button"
            title="R keyboard shortcut"
          >
            {performance.isRecording ? "Recording" : "Record"}
          </button>
        </div>
      </section>

      <section className="card mapping-card">
        <div className="card-header">
          <h3>Finger Mapping</h3>
          <p>Assign each finger to piano notes, drum hits, or samples.</p>
        </div>
        <div className="mapping-grid">
          {Object.entries(fingerMappings).map(([finger, mapping]) => (
            <article className="mapping-item" key={finger}>
              <strong>{finger}</strong>
              <select
                value={mapping.mode}
                onChange={(event) =>
                  onMappingChange(finger as Finger, event.target.value as FingerMapping["mode"], "")
                }
              >
                <option value="none">None</option>
                <option value="piano">Piano</option>
                <option value="drum">Drum</option>
                <option value="sample">Sample</option>
              </select>

              {mapping.mode === "piano" && (
                <select
                  value={mapping.targetId}
                  onChange={(event) => onMappingChange(finger as Finger, "piano", event.target.value)}
                >
                  {PIANO_NOTES.map((note) => (
                    <option key={note} value={note}>
                      {note}
                    </option>
                  ))}
                </select>
              )}

              {mapping.mode === "drum" && (
                <select
                  value={mapping.targetId}
                  onChange={(event) => onMappingChange(finger as Finger, "drum", event.target.value)}
                >
                  {DRUM_TARGETS.map((drum) => (
                    <option key={drum} value={drum}>
                      {drum}
                    </option>
                  ))}
                </select>
              )}

              {mapping.mode === "sample" && (
                <select
                  value={mapping.targetId}
                  onChange={(event) => onMappingChange(finger as Finger, "sample", event.target.value)}
                >
                  {samples.map((sample) => (
                    <option key={sample.id} value={sample.id}>
                      {sample.name}
                    </option>
                  ))}
                </select>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="play-telemetry">
        <FlexVisualizer
          flex={packet?.flex ?? { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 }}
          triggerConfig={triggerConfig}
          histories={flexHistories}
          triggeredFinger={triggeredFinger}
        />
        <GyroVisualizer packet={packet} history={gyroHistory} axisLabel={activeGyroAxisLabel} />
      </div>
    </div>
  );
}
