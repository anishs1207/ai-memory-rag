"use client";

import React from "react";
import { Terminal, MousePointerClick, Laptop } from "lucide-react";

/**
 * Interface properties for the BlinkyDesktopSimulator component.
 */
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

/**
 * Minimalist desktop simulator component.
 */
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
    <div id="simulator" className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Simulator
        </h3>
      </div>

      <div className="relative flex flex-col h-[400px] rounded-3xl border border-border/40 bg-zinc-950 overflow-hidden shadow-2xl">
        {/* Window header chrome */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/50 px-5 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              Desktop Overlay
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <Laptop className="h-3 w-3 text-muted-foreground" />
              <span>Opacity: {simOpacity}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              value={simOpacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              aria-label="Opacity"
              className="w-20 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>

        {/* Work Area */}
        <div
          className="relative flex-1 p-5 bg-zinc-950/80 backdrop-blur-sm transition-opacity duration-200"
          style={{ opacity: simOpacity / 100 }}
        >
          <div className="h-full rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4 font-mono text-xs text-zinc-300 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5 text-[11px] text-zinc-400">
              <div className="flex items-center gap-2 font-medium">
                <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                <span>VS Code</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onTriggerGuide("typecheck")}
                  className="rounded-full bg-zinc-800 px-3 py-1 text-[10px] font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Guide TypeCheck
                </button>
                <button
                  onClick={() => onTriggerGuide("settings")}
                  className="rounded-full bg-zinc-800 px-3 py-1 text-[10px] font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Highlight Settings
                </button>
              </div>
            </div>

            <div className="space-y-1 font-mono text-[11px] text-zinc-400">
              {terminalOutput.map((line, idx) => (
                <p
                  key={idx}
                  className={
                    line.startsWith("✓")
                      ? "text-emerald-400 font-medium"
                      : "text-zinc-300"
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
              className="absolute h-12 w-12 rounded-full border border-white/60 bg-white/10 animate-ping pointer-events-none transition-all duration-300"
              style={{
                left: `${focusRing.x}%`,
                top: `${focusRing.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}

          {/* Pointer */}
          <div
            className={`absolute pointer-events-none transition-all duration-500 ${
              isMoving ? "scale-105" : "scale-100"
            }`}
            style={{
              left: `${cursorPos.x}%`,
              top: `${cursorPos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-[10px] font-semibold text-background shadow-lg">
              <MousePointerClick className="h-3 w-3" />
              <span>Blinky Pointer</span>
            </div>
          </div>

          {/* Tooltip */}
          {tooltip.visible && (
            <div
              className="absolute rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1 text-[11px] text-zinc-200 shadow-xl pointer-events-none transition-all duration-300"
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
    </div>
  );
};

export default BlinkyDesktopSimulator;


