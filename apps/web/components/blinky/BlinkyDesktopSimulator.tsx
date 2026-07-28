"use client";

import React from "react";
import { Terminal, MousePointerClick, Activity, Laptop } from "lucide-react";

export interface BlinkyDesktopSimulatorProps {
  cursorPos: { x: number; y: number };
  focusRing: { visible: boolean; x: number; y: number };
  tooltip: { visible: boolean; text: string; x: number; y: number };
  simOpacity: number;
  onOpacityChange: (val: number) => void;
  terminalOutput: string[];
  isMoving: boolean;
  onTriggerGuide: (action: string) => void;
}

export const BlinkyDesktopSimulator: React.FC<BlinkyDesktopSimulatorProps> = ({
  cursorPos,
  focusRing,
  tooltip,
  simOpacity,
  onOpacityChange,
  terminalOutput,
  isMoving,
  onTriggerGuide,
}) => {
  return (
    <div className="relative flex flex-col h-[420px] rounded-xl border border-border bg-slate-950 overflow-hidden shadow-2xl">
      {/* Top Simulated Window Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-amber-500/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Blinky Simulated OS Desktop Overlay
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Laptop className="h-3.5 w-3.5 text-primary" />
            <span>Opacity: {simOpacity}%</span>
          </div>
          <input
            type="range"
            min="30"
            max="100"
            value={simOpacity}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className="w-20 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      {/* Simulated Desktop Work Area */}
      <div
        className="relative flex-1 p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        style={{ opacity: simOpacity / 100 }}
      >
        {/* Simulated Code Editor Window */}
        <div className="h-full rounded-lg border border-slate-800 bg-slate-950/90 p-4 font-mono text-xs text-slate-300 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span>VS Code - apps/web/app/blinky/page.tsx</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onTriggerGuide("typecheck")}
                className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/30"
              >
                Guide TypeCheck
              </button>
              <button
                onClick={() => onTriggerGuide("settings")}
                className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 hover:bg-indigo-500/30"
              >
                Highlight Settings
              </button>
            </div>
          </div>

          {/* Terminal Console Output */}
          <div className="space-y-1 font-mono text-[11px] text-slate-400">
            {terminalOutput.map((line, idx) => (
              <p
                key={idx}
                className={
                  line.startsWith("✓")
                    ? "text-emerald-400 font-semibold"
                    : line.startsWith("!")
                    ? "text-amber-400"
                    : "text-slate-300"
                }
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Animated Focus Ring */}
        {focusRing.visible && (
          <div
            className="absolute h-12 w-12 rounded-full border-2 border-primary bg-primary/20 animate-ping pointer-events-none transition-all duration-300"
            style={{
              left: `${focusRing.x}%`,
              top: `${focusRing.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}

        {/* Coonay Animated Cursor */}
        <div
          className={`absolute pointer-events-none transition-all duration-500 ${
            isMoving ? "scale-110" : "scale-100"
          }`}
          style={{
            left: `${cursorPos.x}%`,
            top: `${cursorPos.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-lg">
            <MousePointerClick className="h-3.5 w-3.5 animate-bounce" />
            <span>Blinky Pointer</span>
          </div>
        </div>

        {/* Coonay Hover Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 shadow-xl pointer-events-none transition-all duration-300"
            style={{
              left: `${tooltip.x}%`,
              top: `${tooltip.y + 8}%`,
              transform: "translate(-50%, 0)",
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlinkyDesktopSimulator;
