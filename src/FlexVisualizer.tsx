import { FINGERS, Finger, FingerTriggerConfig } from "../types/app";
import { clamp } from "../lib/utils";

interface FlexVisualizerProps {
  flex: Record<Finger, number>;
  triggerConfig: Record<Finger, FingerTriggerConfig>;
  histories: Record<Finger, number[]>;
  triggeredFinger: Finger | null;
}

const toPercent = (value: number, max: number) => clamp(value / max, 0, 1) * 100;

export function FlexVisualizer({
  flex,
  triggerConfig,
  histories,
  triggeredFinger
}: FlexVisualizerProps) {
  return (
    <section className="card flex-visualizer">
      <div className="card-header">
        <h3>Flex Sensors</h3>
        <p>Threshold + hysteresis armed triggers</p>
      </div>
      <div className="flex-grid">
        {FINGERS.map((finger) => {
          const value = flex[finger];
          const config = triggerConfig[finger];
          const thresholdPercent = toPercent(config.threshold, config.velocityMax);
          const percent = toPercent(value, config.velocityMax);
          const points = histories[finger]
            .map((entry, index) => {
              const x = (index / Math.max(histories[finger].length - 1, 1)) * 96 + 2;
              const y = 28 - clamp(entry / config.velocityMax, 0, 1) * 24;
              return `${x},${y}`;
            })
            .join(" ");

          return (
            <article
              className={`finger-card ${triggeredFinger === finger ? "hit" : ""}`}
              key={finger}
              aria-label={`${finger} flex`}
            >
              <header>
                <strong>{finger}</strong>
                <span>{Math.round(value)}</span>
              </header>
              <div className="meter">
                <div className="threshold" style={{ left: `${thresholdPercent}%` }} />
                <div className="meter-fill" style={{ width: `${percent}%` }} />
              </div>
              <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
                <polyline points={points} />
              </svg>
            </article>
          );
        })}
      </div>
    </section>
  );
}
