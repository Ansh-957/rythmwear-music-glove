import { DragEvent, useMemo, useState } from "react";
import { Finger, FingerMapping, SampleItem } from "../types/app";

interface GestureSampleTriggers {
  flickUp: string;
  flickDown: string;
}

interface SamplerTabProps {
  samples: SampleItem[];
  fingerMappings: Record<Finger, FingerMapping>;
  onMappingChange: (finger: Finger, mode: FingerMapping["mode"], targetId: string) => void;
  onImportFiles: (files: FileList | File[]) => void;
  onPreview: (sampleId: string) => void;
  gestureTriggers: GestureSampleTriggers;
  onGestureChange: (next: GestureSampleTriggers) => void;
}

export function SamplerTab({
  samples,
  fingerMappings,
  onMappingChange,
  onImportFiles,
  onPreview,
  gestureTriggers,
  onGestureChange
}: SamplerTabProps) {
  const [query, setQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return samples;
    }
    return samples.filter(
      (sample) =>
        sample.name.toLowerCase().includes(needle) ||
        sample.tags.some((tag) => tag.toLowerCase().includes(needle))
    );
  }, [query, samples]);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const files = event.dataTransfer.files;
    if (files.length) {
      onImportFiles(files);
    }
  };

  return (
    <div className="tab-content sampler-tab">
      <section className="card">
        <div className="card-header">
          <h3>Sound Library</h3>
          <p>Built-in presets + your uploaded samples. Drag and drop files to import.</p>
        </div>
        <div
          className={`drop-zone ${dragActive ? "active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <p>Drop `.wav` / `.mp3` files here</p>
          <label className="secondary-btn">
            Import Files
            <input
              type="file"
              multiple
              accept="audio/*"
              onChange={(event) => {
                if (event.target.files?.length) {
                  onImportFiles(event.target.files);
                }
              }}
            />
          </label>
        </div>
        <div className="search-row">
          <input
            placeholder="Search by name or tag (kick, snare, vocal, fx)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="sample-grid">
          {filtered.map((sample) => (
            <article className="sample-card" key={sample.id}>
              <header>
                <strong>{sample.name}</strong>
                <span>{sample.source}</span>
              </header>
              <p>{sample.description}</p>
              <div className="tag-row">
                {sample.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => onPreview(sample.id)}
                title="Preview in browser audio engine"
              >
                Preview
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Sample Mapping</h3>
          <p>Assign samples directly to fingers for performance mode.</p>
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
                <option value="sample">Sample</option>
                <option value="drum">Drum</option>
                <option value="piano">Piano</option>
              </select>
              <select
                disabled={mapping.mode !== "sample"}
                value={mapping.mode === "sample" ? mapping.targetId : ""}
                onChange={(event) => onMappingChange(finger as Finger, "sample", event.target.value)}
              >
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.name}
                  </option>
                ))}
              </select>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Gesture Triggers</h3>
          <p>Optional: use quick wrist flicks to fire extra samples.</p>
        </div>
        <div className="gesture-grid">
          <label>
            Flick Up
            <select
              value={gestureTriggers.flickUp}
              onChange={(event) =>
                onGestureChange({ ...gestureTriggers, flickUp: event.target.value })
              }
            >
              <option value="">Disabled</option>
              {samples.map((sample) => (
                <option key={sample.id} value={sample.id}>
                  {sample.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Flick Down
            <select
              value={gestureTriggers.flickDown}
              onChange={(event) =>
                onGestureChange({ ...gestureTriggers, flickDown: event.target.value })
              }
            >
              <option value="">Disabled</option>
              {samples.map((sample) => (
                <option key={sample.id} value={sample.id}>
                  {sample.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
