import { BrainCircuit, Maximize2 } from 'lucide-react';

interface LogoBarProps {
  setWindowMode: (mode: 'toolbar' | 'panel' | 'stealth' | 'aihere' | 'logo') => void;
}

/**
 * LogoBar provides an ultra-compact floating interface mode for Blinky.
 * It shrinks the entire window down to just the brand logo and title, allowing minimal screen space usage.
 */
export function LogoBar({ setWindowMode }: LogoBarProps) {
  return (
    <div className="logo-bar-container">
      <div className="logo-bar-brand">
        <BrainCircuit size={16} className="logo-icon-pulse" color="var(--accent-purple)" />
        <span className="logo-bar-title">BLINKY</span>
        <span className="logo-online-dot" title="Blinky AI Active" />
      </div>
      <button
        className="logo-bar-expand-btn"
        onClick={() => setWindowMode('panel')}
        title="Expand to Assistant Panel"
      >
        <Maximize2 size={13} />
      </button>
    </div>
  );
}
