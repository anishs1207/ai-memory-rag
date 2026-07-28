"use client";

import React from "react";
import { Bot, Github, Moon, Sun } from "lucide-react";

export interface BlinkyHeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export const BlinkyHeader: React.FC<BlinkyHeaderProps> = ({
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            Blinky AI
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
              v1.2.0 Desktop
            </span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Context-Aware Cross-Platform Overlay Assistant
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-accent"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-500" />
          )}
        </button>

        <a
          href="https://github.com/anishs1207/ai-memory"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Github className="h-4 w-4" />
          <span>GitHub</span>
        </a>
      </div>
    </header>
  );
};

export default BlinkyHeader;
