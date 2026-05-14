interface OnboardingModalProps {
  onClose: () => void;
}

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Welcome to RythmWear">
      <div className="modal">
        <h2>Welcome to RythmWear</h2>
        <p>
          Browser-based glove-controlled music studio. Start in <strong>Settings</strong> to connect
          to your glove or enable demo mode.
        </p>
        <ul>
          <li>
            <kbd>Space</kbd> Play/Stop sequencer
          </li>
          <li>
            <kbd>R</kbd> Toggle recording
          </li>
          <li>
            <kbd>M</kbd> Toggle metronome
          </li>
          <li>
            <kbd>1-5</kbd> Switch tabs
          </li>
        </ul>
        <button className="primary-btn" onClick={onClose} type="button">
          Launch Studio
        </button>
      </div>
    </div>
  );
}
