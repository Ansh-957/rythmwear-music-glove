import { IMU_AXES, GestureMacro, MotionMapping, MotionParameter } from "../types/app";

interface MotionFxTabProps {
  mappings: MotionMapping[];
  selectedMappingId: string;
  onSelectMapping: (id: string) => void;
  onMappingUpdate: <K extends keyof MotionMapping>(
    id: string,
    key: K,
    value: MotionMapping[K]
  ) => void;
  onAddMapping: () => void;
  onRemoveMapping: (id: string) => void;
  curve: Array<{ raw: number; smoothed: number }>;
  gestureMacros: GestureMacro[];
  onMacroUpdate: <K extends keyof GestureMacro>(id: string, key: K, value: GestureMacro[K]) => void;
}

const PARAMETERS: MotionParameter[] = [
  "filterCutoff",
  "pitchBend",
  "reverbMix",
  "pan",
  "volume",
  "playbackRate",
  "delayFeedback"
];

export function MotionFxTab({
  mappings,
  selectedMappingId,
  onSelectMapping,
  onMappingUpdate,
  onAddMapping,
  onRemoveMapping,
  curve,
  gestureMacros,
  onMacroUpdate
}: MotionFxTabProps) {
  const rawPoints = curve
    .map((entry, index) => `${(index / Math.max(curve.length - 1, 1)) * 380},${60 - entry.raw * 52}`)
    .join(" ");
  const smoothPoints = curve
    .map(
      (entry, index) =>
        `${(index / Math.max(curve.length - 1, 1)) * 380},${60 - entry.smoothed * 52}`
    )
    .join(" ");

  return (
    <div className="tab-content motion-tab">
      <section className="card">
        <div className="card-header">
          <h3>Gyro Mappings</h3>
          <p>Map IMU axes to effect parameters with deadzone and smoothing.</p>
        </div>
        <div className="mapping-table">
          {mappings.map((mapping) => (
            <article
              key={mapping.id}
              className={`motion-row ${selectedMappingId === mapping.id ? "active" : ""}`}
              onClick={() => onSelectMapping(mapping.id)}
            >
              <label>
                Axis
                <select
                  value={mapping.axis}
                  onChange={(event) =>
                    onMappingUpdate(mapping.id, "axis", event.target.value as MotionMapping["axis"])
                  }
                >
                  {IMU_AXES.map((axis) => (
                    <option key={axis} value={axis}>
                      {axis}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Parameter
                <select
                  value={mapping.parameter}
                  onChange={(event) =>
                    onMappingUpdate(
                      mapping.id,
                      "parameter",
                      event.target.value as MotionMapping["parameter"]
                    )
                  }
                >
                  {PARAMETERS.map((parameter) => (
                    <option key={parameter} value={parameter}>
                      {parameter}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sensitivity
                <input
                  type="range"
                  min={0.1}
                  max={1.5}
                  step={0.01}
                  value={mapping.sensitivity}
                  onChange={(event) =>
                    onMappingUpdate(mapping.id, "sensitivity", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Deadzone
                <input
                  type="range"
                  min={0}
                  max={0.5}
                  step={0.01}
                  value={mapping.deadzone}
                  onChange={(event) =>
                    onMappingUpdate(mapping.id, "deadzone", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Smoothing
                <input
                  type="range"
                  min={0}
                  max={0.95}
                  step={0.01}
                  value={mapping.smoothing}
                  onChange={(event) =>
                    onMappingUpdate(mapping.id, "smoothing", Number(event.target.value))
                  }
                />
              </label>
              <button className="secondary-btn danger" type="button" onClick={() => onRemoveMapping(mapping.id)}>
                Remove
              </button>
            </article>
          ))}
        </div>
        <button className="secondary-btn" type="button" onClick={onAddMapping}>
          Add Mapping
        </button>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Raw vs Smoothed Curve</h3>
          <p>Live display of selected mapping axis stream.</p>
        </div>
        <svg className="motion-curve" viewBox="0 0 380 120" preserveAspectRatio="none">
          <polyline className="raw" points={rawPoints} />
          <polyline className="smooth" points={smoothPoints} />
        </svg>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Gesture Macros</h3>
          <p>Define motion gestures for expressive actions.</p>
        </div>
        <div className="macro-grid">
          {gestureMacros.map((macro) => (
            <article className="macro-card" key={macro.id}>
              <header>
                <strong>{macro.name}</strong>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={macro.enabled}
                    onChange={(event) => onMacroUpdate(macro.id, "enabled", event.target.checked)}
                  />
                  <span>{macro.enabled ? "Enabled" : "Disabled"}</span>
                </label>
              </header>
              <p>Gesture: {macro.type}</p>
              <label>
                Action
                <select
                  value={macro.action}
                  onChange={(event) =>
                    onMacroUpdate(macro.id, "action", event.target.value as GestureMacro["action"])
                  }
                >
                  <option value="stutter">stutter</option>
                  <option value="tapeStop">tapeStop</option>
                </select>
              </label>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
