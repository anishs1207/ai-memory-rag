"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  Github,
  ChevronRight,
  Bot,
  MousePointerClick,
  Settings,
  Laptop,
  Activity,
  Sparkles,
  Terminal,
  Sun,
  Moon,
} from "lucide-react";

// Platform packages configuration
const downloads = [
  {
    platform: "macOS",
    kind: "Universal DMG package",
    detail: "Apple Silicon & Intel desktop binary.",
    href: "/downloads/blinkity-macos-arm64.dmg",
    status: "Dev Build",
    available: false,
  },
  {
    platform: "Windows",
    kind: "Portable ZIP / MSI",
    detail: "Direct execution or managed installer.",
    href: "/downloads/blinkity-windows-portable.zip",
    status: "Dev Build",
    available: false,
  },
  {
    platform: "Linux",
    kind: "AppImage wrapper",
    detail: "Standalone executable package.",
    href: "/downloads/blinkity-linux-x64.AppImage",
    status: "Dev Build",
    available: false,
  },
  {
    platform: "Source Code",
    kind: "Monorepo workspace bundle",
    detail: "Complete package bundle compiled from this workspace.",
    href: "/downloads/blinkity-source.zip",
    status: "Ready",
    available: true,
  },
];

// Features configuration
const features = [
  {
    icon: Bot,
    title: "Visual Assistant",
    text: "Captures local screen frames and interprets active code context or mockups.",
  },
  {
    icon: MousePointerClick,
    title: "Guided Highlights",
    text: "Draws coordinates focus rings above standard OS windows to direct attention.",
  },
  {
    icon: Settings,
    title: "Overlay Customizer",
    text: "Features click-through, custom translucency, and security blurs.",
  },
];

export default function Page() {
  // Theme state settings
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  // App interactive states
  const [activeTab, setActiveTab] = useState<"assist" | "guide" | "overlay">("assist");
  const [assistPrompt, setAssistPrompt] = useState("");
  const [assistResponse, setAssistResponse] = useState("Ask Blinkity about your workspace to begin...");
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Simulated desktop settings
  const [mockOpacity, setMockOpacity] = useState(90);
  const [mockBlur, setMockBlur] = useState(false);
  const [mockClickThrough, setMockClickThrough] = useState(false);
  
  // Interactive page guide overlay
  const [guideActive, setGuideActive] = useState(false);

  // Initialize theme from storage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("blinkity-theme") as "light" | "dark" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.className = savedTheme;
    } else {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const defaultTheme = systemPrefersDark ? "dark" : "light";
      setTheme(defaultTheme);
      document.documentElement.className = defaultTheme;
    }
    setMounted(true);
  }, []);

  // Toggle active theme
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("blinkity-theme", nextTheme);
    document.documentElement.className = nextTheme;
  };

  const simulateResponse = (promptText: string) => {
    if (!promptText.trim() || isStreaming) return;
    setIsStreaming(true);
    setAssistResponse("");
    
    let targetText = "";
    const lowerPrompt = promptText.toLowerCase();
    if (lowerPrompt.includes("explain") || lowerPrompt.includes("screen")) {
      targetText = "Analyzing screen context... Detected VS Code workspace. Active file: App.tsx (Line 42). The page code contains standard layouts. Recommended action: Synchronize dependencies and run 'npm run dev' to start the local developer server.";
    } else if (lowerPrompt.includes("guide") || lowerPrompt.includes("source")) {
      targetText = "Activating guide overlay. Directing attention to 'Source Code' module below. Guidance indicators active on main viewport.";
      setGuideActive(true);
    } else {
      targetText = `Processing screen query: "${promptText}". Workspace parsed. System state healthy. Ready for interaction.`;
    }

    let characterIndex = 0;
    const interval = setInterval(() => {
      if (characterIndex < targetText.length) {
        setAssistResponse((prev) => prev + targetText.charAt(characterIndex));
        characterIndex++;
      } else {
        clearInterval(interval);
        setIsStreaming(false);
      }
    }, 12);
  };

  const samplePrompts = [
    "Explain my screen context",
    "Where is the source installer?",
    "Check system state",
  ];

  return (
    <main className="min-h-screen bg-background text-foreground grid-bg relative overflow-x-hidden flex flex-col justify-between transition-colors duration-300">
      {/* Decorative top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-accent-blue/5 via-accent-violet/5 to-transparent blur-3xl pointer-events-none opacity-60 dark:opacity-100" />

      {/* Guide Overlay Portal */}
      {guideActive && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute -top-1.5 -left-1.5 size-4 rounded-full bg-accent-blue animate-ping opacity-75" />
            <div className="absolute -top-1.5 -left-1.5 size-4 rounded-full bg-accent-blue flex items-center justify-center text-white font-bold text-[9px]">
              !
            </div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
              <MousePointerClick className="text-accent-blue size-4" />
              Blinkity Guide Active
            </h4>
            <p className="text-xs text-muted leading-relaxed mb-6">
              You triggered a mock Guidance Overlay. In a real desktop workspace, Blinkity projects absolute guidance focus rings directly over target OS layouts:
            </p>
            <div className="bg-background border border-card-border rounded-lg p-4 mb-6 text-xs text-center">
              <span className="inline-flex items-center gap-2 text-accent-blue font-mono font-medium">
                <span className="size-1.5 rounded-full bg-accent-blue animate-pulse" />
                Target Lock: Source Code package (apps/blinky)
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setGuideActive(false);
                  const el = document.getElementById("downloads");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="bg-accent-blue hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-semibold transition"
              >
                Go to Target
              </button>
              <button
                onClick={() => setGuideActive(false)}
                className="bg-card-hover border border-card-border text-foreground px-4 py-2 rounded-lg text-xs font-semibold transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav Header */}
      <nav className="mx-auto w-full max-w-5xl flex items-center justify-between px-6 py-5 border-b border-card-border/60 relative z-10">
        <a className="flex items-center gap-2.5 font-bold tracking-tight text-foreground" href="#">
          <span className="grid size-7 place-items-center rounded-lg bg-card border border-card-border text-foreground transition-all duration-200">
            <Sparkles size={14} />
          </span>
          <span className="font-mono text-xs tracking-widest font-semibold">BLINKITY</span>
        </a>
        <div className="flex items-center gap-6 text-[11px] text-muted">
          <a href="#features" className="hover:text-foreground transition-colors">capabilities</a>
          <a href="#quickstart" className="hover:text-foreground transition-colors">installation</a>
          <a href="#downloads" className="hover:text-foreground transition-colors">packages</a>
          <a
            href="https://github.com/anishs1207/ai-memory"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <Github size={11} />
            github
          </a>
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-card hover:bg-card-hover border border-card-border text-foreground transition-all duration-200 cursor-pointer"
            aria-label="Toggle Theme"
          >
            {!mounted ? (
              <div className="size-3.5 animate-pulse rounded bg-muted/20" />
            ) : theme === "dark" ? (
              <Sun size={13} className="text-amber-500" />
            ) : (
              <Moon size={13} className="text-accent-blue" />
            )}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-12 grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center relative z-10">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-blue/15 bg-accent-blue/5 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-accent-blue font-medium">
            <Activity size={10} className="animate-pulse" />
            ambient desktop assistant
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-[1.15] mb-6 font-display">
            an intelligent overlay<br />
            for your workspace.
          </h1>
          <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-lg mb-8">
            Blinkity is a lightweight, semi-transparent desktop utility. It captures active application frames to analyze workflows, suggest helper coordinates, and render overlay cues directly beside your cursor.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent-blue px-5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition duration-150"
              href="/downloads/blinkity-source.zip"
            >
              <Download size={13} />
              download source code
            </a>
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-card-border bg-card px-5 text-xs font-semibold text-foreground hover:bg-card-hover transition duration-150"
              href="#downloads"
            >
              supported platforms
            </a>
          </div>
        </div>

        {/* Interactive Mockup Container */}
        <div 
          className="glass-card surface-shadow relative overflow-hidden rounded-2xl p-5 border border-card-border"
          style={{ 
            opacity: mockOpacity / 100,
            cursor: mockClickThrough ? "crosshair" : "default"
          }}
        >
          {/* Top window bar */}
          <div className="mb-5 flex items-center justify-between border-b border-card-border/60 pb-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-card-border" />
              <span className="size-2 rounded-full bg-card-border" />
              <span className="size-2 rounded-full bg-card-border" />
            </div>
            <span className="font-mono text-[9px] text-muted tracking-widest uppercase font-medium">
              blinkity-overlay
            </span>
          </div>

          {/* Grid Layout inside overlay app */}
          <div className="grid gap-4 sm:grid-cols-[130px_1fr]">
            {/* Sidebar selection */}
            <div className="flex flex-row gap-1 sm:flex-col sm:gap-1.5">
              {[
                { id: "assist", label: "AI Assist", icon: Bot },
                { id: "guide", label: "Guide Mode", icon: MousePointerClick },
                { id: "overlay", label: "Settings", icon: Settings },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as "assist" | "guide" | "overlay")}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[10px] font-semibold transition-all duration-200 w-full ${
                      activeTab === tab.id
                        ? "bg-accent-blue text-white shadow-sm"
                        : "bg-card-hover/40 text-muted hover:bg-card-hover hover:text-foreground"
                    }`}
                  >
                    <Icon size={11} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Simulated Workspace */}
            <div className={`rounded-xl border border-card-border bg-background p-4 min-h-[180px] flex flex-col justify-between transition-all duration-300 ${mockBlur ? 'blur-sm select-none pointer-events-none' : ''}`}>
              {activeTab === "assist" && (
                <div className="flex flex-col h-full justify-between gap-3 text-left">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-mono text-accent-blue flex items-center gap-1 font-semibold">
                        <span className="size-1 rounded-full bg-accent-blue animate-pulse" />
                        AI Agent
                      </span>
                    </div>
                    <div className="bg-card border border-card-border rounded-lg p-2.5 text-[10px] text-muted font-mono leading-relaxed h-[80px] overflow-y-auto">
                      {assistResponse}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-1 flex-wrap">
                      {samplePrompts.map((p) => (
                        <button
                          key={p}
                          disabled={isStreaming}
                          onClick={() => {
                            setAssistPrompt(p);
                            simulateResponse(p);
                          }}
                          className="text-[8px] bg-card hover:bg-card-hover border border-card-border px-2 py-0.5 rounded text-foreground transition disabled:opacity-55 cursor-pointer"
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={assistPrompt}
                        onChange={(e) => setAssistPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            simulateResponse(assistPrompt);
                            setAssistPrompt("");
                          }
                        }}
                        placeholder="ask query..."
                        className="flex-1 bg-card border border-card-border rounded-lg px-2.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-accent-blue/30"
                      />
                      <button
                        onClick={() => {
                          simulateResponse(assistPrompt);
                          setAssistPrompt("");
                        }}
                        disabled={isStreaming || !assistPrompt.trim()}
                        className="bg-accent-blue hover:opacity-90 disabled:opacity-50 text-white text-[10px] px-2.5 rounded-lg font-semibold transition cursor-pointer"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "guide" && (
                <div className="flex flex-col h-full justify-between gap-3 text-left">
                  <div>
                    <span className="text-[9px] font-mono text-accent-green flex items-center gap-1 mb-1 font-semibold">
                      <span className="size-1 bg-accent-green rounded-full animate-pulse" />
                      Coordinate Pointer
                    </span>
                    <p className="text-[10px] text-muted leading-relaxed">
                      Launches pulsing layout cues above specified UI components. Click below to test.
                    </p>
                  </div>
                  <button
                    onClick={() => setGuideActive(true)}
                    className="w-full bg-accent-green hover:opacity-90 text-white rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer"
                  >
                    Trigger Guide Overlay
                  </button>
                </div>
              )}

              {activeTab === "overlay" && (
                <div className="flex flex-col h-full justify-between gap-3 text-left">
                  <div className="space-y-3">
                    {/* Opacity Control */}
                    <div>
                      <div className="flex justify-between text-[9px] mb-1 text-muted">
                        <span>Opacity</span>
                        <span className="font-mono text-foreground font-semibold">{mockOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min="25"
                        max="100"
                        value={mockOpacity}
                        onChange={(e) => setMockOpacity(Number(e.target.value))}
                        className="w-full h-1 bg-card-border rounded-lg appearance-none cursor-pointer accent-accent-blue"
                      />
                    </div>

                    {/* Click-Through Toggle */}
                    <label className="flex items-center justify-between cursor-pointer p-1.5 rounded bg-card/40 border border-card-border">
                      <span className="text-[10px] text-foreground font-medium">Click-Through</span>
                      <input
                        type="checkbox"
                        checked={mockClickThrough}
                        onChange={(e) => setMockClickThrough(e.target.checked)}
                        className="size-3 bg-card border-card-border rounded accent-accent-blue cursor-pointer"
                      />
                    </label>

                    {/* Privacy Blur Mode */}
                    <label className="flex items-center justify-between cursor-pointer p-1.5 rounded bg-card/40 border border-card-border">
                      <span className="text-[10px] text-foreground font-medium">Privacy Blur</span>
                      <input
                        type="checkbox"
                        checked={mockBlur}
                        onChange={(e) => setMockBlur(e.target.checked)}
                        className="size-3 bg-card border-card-border rounded accent-accent-blue cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom context indicator */}
          <div className="mt-5 border-t border-card-border/60 pt-3 flex items-center justify-between text-[9px] text-muted">
            <span className="flex items-center gap-1 font-mono">
              <Laptop size={9} />
              shortcut: Alt+Space
            </span>
            <span className="flex items-center gap-1 font-mono">
              <span className="size-1 rounded-full bg-accent-green" />
              active
            </span>
          </div>
        </div>
      </section>

      {/* Capabilities / Features */}
      <section className="border-t border-card-border bg-card/30 py-16 transition-colors duration-300" id="features">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="mb-10 text-left max-w-xl">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider font-mono">capabilities</h3>
            <p className="text-xs text-muted mt-1">Blinkity features local visual models and contextual triggers.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  className="bg-background border border-card-border rounded-xl p-5 hover:border-accent-blue/30 transition-all duration-300 shadow-sm"
                  key={feature.title}
                >
                  <Icon className="mb-4 text-accent-blue size-4" />
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono">{feature.title}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {feature.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Developer installation quickstart */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16" id="quickstart">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] items-center">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider font-mono">installation</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Blinkity is configured inside an npm workspace. Launch a local build in three steps.
            </p>
          </div>

          <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-card-hover border-b border-card-border px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-card-border" />
                <span className="size-2 rounded-full bg-card-border" />
                <span className="size-2 rounded-full bg-card-border" />
              </div>
              <span className="text-[9px] font-mono text-muted flex items-center gap-1 font-semibold">
                <Terminal size={9} />
                zsh - local-dev
              </span>
            </div>
            
            <div className="p-4 bg-background font-mono text-[10px] text-foreground space-y-3.5 text-left border-t border-card-border/10">
              <div>
                <p className="text-muted/50 font-normal"># clone repo</p>
                <p className="text-muted"><span className="select-none font-semibold text-accent-blue">$ </span>git clone https://github.com/anishs1207/ai-memory.git</p>
              </div>

              <div>
                <p className="text-muted/50 font-normal"># install workspaces</p>
                <p className="text-muted"><span className="select-none font-semibold text-accent-blue">$ </span>npm install</p>
              </div>

              <div>
                <p className="text-muted/50 font-normal"># run desktop client</p>
                <p className="text-muted"><span className="select-none font-semibold text-accent-blue">$ </span>npm run dev --filter=desktop-app</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Packages / Downloads grid */}
      <section className="border-t border-card-border bg-card/30 py-16 transition-colors duration-300" id="downloads">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div className="mb-10 text-left">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider font-mono">platform packages</h3>
            <p className="text-xs text-muted mt-1">Select a workspace target to fetch release builds.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {downloads.map((d) => (
              <div
                key={d.platform}
                className="bg-background border border-card-border rounded-xl p-5 flex items-center justify-between hover:border-accent-blue/30 transition-all duration-300 shadow-sm"
              >
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono">{d.platform}</h4>
                  <p className="text-xs text-muted mt-0.5">{d.kind}</p>
                </div>
                {d.available ? (
                  <a
                    href={d.href}
                    className="bg-accent-blue hover:opacity-90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1.5"
                  >
                    <Download size={11} />
                    download
                  </a>
                ) : (
                  <span className="text-[9px] uppercase font-mono tracking-wider text-accent-amber bg-accent-amber/5 border border-accent-amber/15 px-2 py-0.5 rounded-md font-medium">
                    {d.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border bg-background transition-colors duration-300">
        <div className="mx-auto w-full max-w-5xl flex flex-col gap-4 px-6 py-6 text-[10px] text-muted sm:flex-row sm:items-center sm:justify-between relative z-10">
          <span>&copy; 2026 Blinkity. All rights reserved.</span>
          <a
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-semibold"
            href="https://github.com/anishs1207/ai-memory"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github size={11} />
            Source Repository
            <ChevronRight size={10} />
          </a>
        </div>
      </footer>
    </main>
  );
}


