import { DeviceState, Finger, FingerTriggerConfig, CalibrationState } from "../types/app";
import { FINGERS } from "../types/app";
import { formatMs } from "../lib/utils";

interface SettingsTabProps {
  device: DeviceState;
  wsUrl: string;
  onWsUrlChange: (url: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDemoMode: () => void;
  triggerConfig: Record<Finger, FingerTriggerConfig>;
  onTriggerUpdate: <K extends keyof FingerTriggerConfig>(
    finger: Finger,
    key: K,
    value: FingerTriggerConfig[K]
  ) => void;
  calibration: CalibrationState;
  onCaptureOpenHand: () => void;
  onCaptureClosedFist: () => void;
  onSuggestThresholds: () => void;
  latencyMs: number;
  onExportSettings: () => void;
  onImportSettings: (file: File) => void;
}

const stateTone: Record<DeviceState["mode"], string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  demo: "Demo Mode"
};

export function SettingsTab({
  device,
  wsUrl,
  onWsUrlChange,
  onConnect,
  onDisconnect,
  onDemoMode,
  triggerConfig,
  onTriggerUpdate,
  calibration,
  onCaptureOpenHand,
  onCaptureClosedFist,
  onSuggestThresholds,
  latencyMs,
  onExportSettings,
  onImportSettings
}: SettingsTabProps) {
  return (
    <div className="tab-content settings-tab">
      <section className="card">
        <div className="card-header">
          <h3>Device Connection</h3>
          <p>Single connection endpoint for ESP32 stream or Raspberry Pi relay.</p>
        </div>
        <div className="connection-row">
          <label>
            WebSocket URL
            <input
              value={wsUrl}
              onChange={(event) => onWsUrlChange(event.target.value)}
              placeholder="http://10.69.59.117:3000"
            />
          </label>
          <button className="primary-btn" onClick={onConnect} type="button">
            Connect
          </button>
          <button className="secondary-btn" onClick={onDisconnect} type="button">
            Disconnect
          </button>
          <button className="secondary-btn" onClick={onDemoMode} type="button">
            Demo Mode
          </button>
        </div>
        <dl className="device-stats">
          <div>
            <dt>Status</dt>
            <dd>{stateTone[device.mode]}</dd>
          </div>
          <div>
            <dt>Message Rate</dt>
            <dd>{device.messageRate} msg/s</dd>
          </div>
          <div>
            <dt>Last Packet</dt>
            <dd>{device.lastPacket ? "Received" : "None yet"}</dd>
          </div>
        </dl>
        <pre className="packet-preview">
          {device.lastPacket ? JSON.stringify(device.lastPacket, null, 2) : "No packet yet."}
        </pre>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Trigger Tuning</h3>
          <p>Threshold + hysteresis + debounce + velocity scaling for each finger.</p>
        </div>
        <div className="trigger-grid">
          {FINGERS.map((finger) => {
            const config = triggerConfig[finger];
            return (
              <article key={finger} className="trigger-card">
                <h4>{finger}</h4>
                <label>
                  Threshold
                  <input
                    type="range"
                    min={300}
                    max={3500}
                    step={10}
                    value={config.threshold}
                    onChange={(event) =>
                      onTriggerUpdate(finger, "threshold", Number(event.target.value))
                    }
                  />
                  <span>{Math.round(config.threshold)}</span>
                </label>
                <label>
                  Hysteresis
                  <input
                    type="range"
                    min={10}
                    max={500}
                    step={5}
                    value={config.hysteresis}
                    onChange={(event) =>
                      onTriggerUpdate(finger, "hysteresis", Number(event.target.value))
                    }
                  />
                  <span>{Math.round(config.hysteresis)}</span>
                </label>
                <label>
                  Debounce (ms)
                  <input
                    type="range"
                    min={20}
                    max={500}
                    step={5}
                    value={config.debounceMs}
                    onChange={(event) =>
                      onTriggerUpdate(finger, "debounceMs", Number(event.target.value))
                    }
                  />
                  <span>{Math.round(config.debounceMs)}</span>
                </label>
                <label>
                  Velocity Max
                  <input
                    type="range"
                    min={1200}
                    max={4095}
                    step={10}
                    value={config.velocityMax}
                    onChange={(event) =>
                      onTriggerUpdate(finger, "velocityMax", Number(event.target.value))
                    }
                  />
                  <span>{Math.round(config.velocityMax)}</span>
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Calibration Wizard</h3>
          <p>Capture open and closed hand values for auto-threshold suggestions.</p>
        </div>
        <div className="row">
          <button className="secondary-btn" type="button" onClick={onCaptureOpenHand}>
            Capture Open Hand
          </button>
          <button className="secondary-btn" type="button" onClick={onCaptureClosedFist}>
            Capture Closed Fist
          </button>
          <button className="secondary-btn" type="button" onClick={onSuggestThresholds}>
            Apply Suggested Thresholds
          </button>
        </div>
        <div className="calibration-preview">
          <div>
            <strong>Open baseline</strong>
            <pre>{calibration.openHand ? JSON.stringify(calibration.openHand, null, 2) : "Not captured"}</pre>
          </div>
          <div>
            <strong>Closed baseline</strong>
            <pre>{calibration.closedFist ? JSON.stringify(calibration.closedFist, null, 2) : "Not captured"}</pre>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Latency + Config Export</h3>
          <p>Message receive to audio estimate: {formatMs(latencyMs)}</p>
        </div>
        <div className="row">
          <button className="secondary-btn" onClick={onExportSettings} type="button">
            Export Settings JSON
          </button>
          <label className="secondary-btn">
            Import Settings JSON
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onImportSettings(file);
                }
              }}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
