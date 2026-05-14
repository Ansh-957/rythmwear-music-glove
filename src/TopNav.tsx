import { TabId } from "../lib/constants";

interface TopNavProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

const tabs: Array<{ id: TabId; label: string; hint: string }> = [
  { id: "play", label: "Play", hint: "Live performance view" },
  { id: "sampler", label: "Sampler", hint: "Manage sounds and mappings" },
  { id: "studio", label: "Studio", hint: "Step sequencing and loops" },
  { id: "motion", label: "Motion FX", hint: "Gyro-to-effect mapping" },
  { id: "settings", label: "Settings", hint: "Connection, calibration, export" }
];

export function TopNav({ activeTab, onChange }: TopNavProps) {
  return (
    <nav className="top-nav" aria-label="Primary tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onChange(tab.id)}
          title={tab.hint}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
