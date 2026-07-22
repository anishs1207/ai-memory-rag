import { BrainCircuit, Maximize2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface LogoBarProps {
  setWindowMode: (mode: 'toolbar' | 'panel' | 'stealth' | 'aihere' | 'logo') => void;
}

/**
 * LogoBar provides an ultra-compact floating interface mode for Blinky.
 * It shrinks the entire window down to just the brand logo and status badge, allowing minimal screen space usage.
 */
export function LogoBar({ setWindowMode }: LogoBarProps) {
  return (
    <div className="logo-bar-container flex items-center justify-between gap-3 px-3.5 py-1.5 bg-black/85 backdrop-blur-2xl border border-white/15 rounded-full shadow-2xl shadow-purple-900/30 pointer-events-auto transition-all duration-300 hover:border-purple-500/40">
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center">
          <BrainCircuit size={16} className="text-purple-400 animate-pulse" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
        </div>
        <span className="font-extrabold text-xs tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-300 to-white">
          BLINKY
        </span>
        <Badge variant="cyan" className="px-1.5 py-0 text-[9px] uppercase tracking-wider font-semibold">
          Active
        </Badge>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-full hover:bg-white/15 text-white/80 hover:text-white"
        onClick={() => setWindowMode('panel')}
        title="Expand to Assistant Panel"
      >
        <Maximize2 size={12} />
      </Button>
    </div>
  );
}
