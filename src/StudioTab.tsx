import { SequencerTrack } from "../types/app";

interface StudioTabProps {
  tracks: SequencerTrack[];
  recordedEventsCount: number;
  bpm: number;
  quantize: "off" | "1/4" | "1/8" | "1/16";
  loopBars: number;
  isPlaying: boolean;
  isRecording: boolean;
  playheadStep: number;
  onPlayToggle: () => void;
  onRecordToggle: () => void;
  onBpmChange: (bpm: number) => void;
  onQuantizeChange: (quantize: StudioTabProps["quantize"]) => void;
  onLoopBarsChange: (bars: number) => void;
  onTrackMixChange: (trackId: string, key: "volume" | "pan", value: number) => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onClearPattern: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function StudioTab({
  tracks,
  recordedEventsCount,
  bpm,
  quantize,
  loopBars,
  isPlaying,
  isRecording,
  playheadStep,
  onPlayToggle,
  onRecordToggle,
  onBpmChange,
  onQuantizeChange,
  onLoopBarsChange,
  onTrackMixChange,
  onSaveProject,
  onLoadProject,
  onClearPattern,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}: StudioTabProps) {
  const bars = Array.from({ length: loopBars }, (_, index) => index);
  const playheadBar = Math.floor(playheadStep / 16);

  return (
    <div className="tab-content studio-tab">
      <section className="card studio-controls">
        <div className="row">
          <button className="primary-btn" onClick={onPlayToggle} type="button" title="Space shortcut">
            {isPlaying ? "Stop" : "Play"}
          </button>
          <button
            className={`toggle-btn ${isRecording ? "rec" : ""}`}
            onClick={onRecordToggle}
            type="button"
            title="R shortcut"
          >
            {isRecording ? "Overdub On" : "Overdub Off"}
          </button>
          <label>
            BPM
            <input
              type="number"
              min={50}
              max={200}
              value={bpm}
              onChange={(event) => onBpmChange(Number(event.target.value))}
            />
          </label>
          <label>
            Quantize
            <select value={quantize} onChange={(event) => onQuantizeChange(event.target.value as StudioTabProps["quantize"])}>
              <option value="off">Off</option>
              <option value="1/4">1/4</option>
              <option value="1/8">1/8</option>
              <option value="1/16">1/16</option>
            </select>
          </label>
          <label>
            Loop Length
            <select value={loopBars} onChange={(event) => onLoopBarsChange(Number(event.target.value))}>
              {Array.from({ length: 8 }, (_, index) => index + 1).map((bar) => (
                <option key={bar} value={bar}>
                  {bar} bars
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-btn" disabled={!canUndo} onClick={onUndo} type="button">
            Undo
          </button>
          <button className="secondary-btn" disabled={!canRedo} onClick={onRedo} type="button">
            Redo
          </button>
          <span className="chip">Glove Events: {recordedEventsCount}</span>
        </div>
        <div className="row">
          <button className="secondary-btn" onClick={onSaveProject} type="button">
            Save Project
          </button>
          <button className="secondary-btn" onClick={onLoadProject} type="button">
            Load Project
          </button>
          <button className="secondary-btn danger" onClick={onClearPattern} type="button">
            Clear Pattern
          </button>
        </div>
      </section>

      <section className="card sequencer">
        <div className="card-header">
          <h3>FL-style Playlist</h3>
          <p>Patterns are generated only from glove flex hits while recording is enabled.</p>
        </div>
        <div className="playlist-header">
          {bars.map((bar) => (
            <div key={`bar-${bar}`} className={`playlist-bar ${playheadBar === bar ? "playhead" : ""}`}>
              Bar {bar + 1}
            </div>
          ))}
        </div>
        <div className="playlist-grid">
          {tracks.map((track) => (
            <div className="track-row" key={track.id}>
              <div className="track-meta">
                <strong>{track.name}</strong>
                <small>{track.mode + " / " + track.targetId}</small>
                <label>
                  Vol
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={track.volume}
                    onChange={(event) =>
                      onTrackMixChange(track.id, "volume", Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  Pan
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={track.pan}
                    onChange={(event) => onTrackMixChange(track.id, "pan", Number(event.target.value))}
                  />
                </label>
              </div>
              <div className="playlist-lane">
                {bars.map((bar) => {
                  const start = bar * 16;
                  const end = start + 16;
                  const isActive = track.steps.slice(start, end).some(Boolean);
                  const isPlayhead = playheadBar === bar;
                  return (
                    <div
                      key={`${track.id}-bar-${bar}`}
                      className={`clip-cell ${isActive ? "active" : ""} ${isPlayhead ? "playhead" : ""}`}
                      title={`Bar ${bar + 1} ${isActive ? "contains glove-recorded notes" : "empty"}`}
                    >
                      {isActive ? "Clip" : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
