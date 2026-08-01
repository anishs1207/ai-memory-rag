"use client";

import React from "react";
import { Bot, Github, Moon, Sun } from "lucide-react";

/**
 * Interface properties for the BlinkyHeader component.
 */
export interface BlinkyHeaderProps {
  /** Currently active color theme ('light' or 'dark') */
  theme: "light" | "dark";
  /** Callback function to toggle theme */
  onToggleTheme: () => void;
}

/**
 * Ultra-minimalist floating glass pill navbar for Blinky.
 */
export const BlinkyHeader: React.FC<BlinkyHeaderProps> = ({
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-4 z-50 mx-auto max-w-5xl px-4">
      <div className="flex items-center justify-between rounded-full border border-border/40 bg-background/70 px-5 py-2.5 backdrop-blur-2xl shadow-xl shadow-black/5 transition-all duration-300">
        {/* Brand logo & title */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
            <Bot className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Blinky
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              v1.2
            </span>
          </div>
        </div>

        {/* Minimalist navigation links */}
        <nav className="hidden sm:flex items-center gap-8 text-xs font-medium text-muted-foreground">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#simulator" className="transition-colors hover:text-foreground">
            Simulator
          </a>
          <a href="#downloads" className="transition-colors hover:text-foreground">
            Downloads
          </a>
        </nav>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-card/40 text-foreground transition-colors hover:bg-accent focus:outline-none"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-indigo-500" />
            )}
          </button>

          <a
            href="https://github.com/anishs1207/ai-memory"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-card/40 text-foreground transition-colors hover:bg-accent focus:outline-none"
          >
            <Github className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>
      </div>
    </header>
  );
};

export default BlinkyHeader;


