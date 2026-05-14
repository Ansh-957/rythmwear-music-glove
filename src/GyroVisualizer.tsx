import { SensorPacket } from "../types/app";
import { clamp } from "../lib/utils";

interface GyroVisualizerProps {
  packet: SensorPacket | null;
  history: Array<{ raw: number; smoothed: number }>;
  axisLabel: string;
}

export function GyroVisualizer({ packet, history, axisLabel }: GyroVisualizerProps) {
  const roll = packet?.imu.roll ?? 0;
  const pitch = packet?.imu.pitch ?? 0;
  const yaw = packet?.imu.yaw ?? 0;
  const tx = clamp(roll / 30, -1, 1) * 22;
  const ty = clamp(-pitch / 30, -1, 1) * 22;

  const rawPoints = history
    .map((entry, index) => {
      const x = (index / Math.max(history.length - 1, 1)) * 280;
      const y = 48 - clamp(entry.raw, -1, 1) * 40;
      return `${x},${y}`;
    })
    .join(" ");
  const smoothPoints = history
    .map((entry, index) => {
      const x = (index / Math.max(history.length - 1, 1)) * 280;
      const y = 48 - clamp(entry.smoothed, -1, 1) * 40;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="card gyro-visualizer">
      <div className="card-header">
        <h3>Gyro / IMU</h3>
        <p>Active axis: {axisLabel}</p>
      </div>
      <div className="gyro-layout">
        <div className="tilt-pad">
          <div className="pad-center" />
          <div className="pad-dot" style={{ transform: `translate(${tx}px, ${ty}px)` }} />
        </div>
        <dl className="imu-values">
          <div>
            <dt>Roll</dt>
            <dd>{roll.toFixed(1)}°</dd>
          </div>
          <div>
            <dt>Pitch</dt>
            <dd>{pitch.toFixed(1)}°</dd>
          </div>
          <div>
            <dt>Yaw</dt>
            <dd>{yaw.toFixed(1)}°</dd>
          </div>
        </dl>
      </div>
      <svg className="gyro-curve" viewBox="0 0 280 96" preserveAspectRatio="none">
        <polyline className="raw" points={rawPoints} />
        <polyline className="smooth" points={smoothPoints} />
      </svg>
    </section>
  );
}
