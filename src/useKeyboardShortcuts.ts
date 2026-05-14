import { useEffect } from "react";

interface Shortcuts {
  onPlayToggle: () => void;
  onRecordToggle: () => void;
  onMetronomeToggle: () => void;
  onTabSwitch: (index: number) => void;
}

export function useKeyboardShortcuts({
  onPlayToggle,
  onRecordToggle,
  onMetronomeToggle,
  onTabSwitch
}: Shortcuts) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true";
      if (isInput) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        onPlayToggle();
        return;
      }

      if (event.key.toLowerCase() === "r") {
        onRecordToggle();
        return;
      }

      if (event.key.toLowerCase() === "m") {
        onMetronomeToggle();
        return;
      }

      const num = Number(event.key);
      if (Number.isInteger(num) && num >= 1 && num <= 5) {
        onTabSwitch(num - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onMetronomeToggle, onPlayToggle, onRecordToggle, onTabSwitch]);
}
