"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowUp, Sparkles, Download, Play } from "lucide-react";
import { BlinkyHeader } from "@/components/blinky/BlinkyHeader";
import { BlinkyDownloads } from "@/components/blinky/BlinkyDownloads";
import { BlinkyFeatures } from "@/components/blinky/BlinkyFeatures";
import { BlinkyChatSidebar } from "@/components/blinky/BlinkyChatSidebar";
import { BlinkyVoiceSettings } from "@/components/blinky/BlinkyVoiceSettings";
import { BlinkyDesktopSimulator } from "@/components/blinky/BlinkyDesktopSimulator";
import { BlinkyChatSession, BlinkyMessage } from "@/types";

/**
 * Root workspace landing & assistant page component for Blinky served at '/'.
 */
export default function BlinkyPage() {
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  // Chat sessions state
  const [sessions, setSessions] = useState<BlinkyChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [assistPrompt, setAssistPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice TTS & STT state
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [voiceVolume, setVoiceVolume] = useState(0.8);
  const [voicesList, setVoicesList] = useState<SpeechSynthesisVoice[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Desktop Simulator state
  const [cursorPos, setCursorPos] = useState({ x: 45, y: 35 });
  const [focusRing, setFocusRing] = useState({ visible: false, x: 0, y: 0 });
  const [tooltip, setTooltip] = useState({ visible: false, text: "", x: 0, y: 0 });
  const [simOpacity, setSimOpacity] = useState(90);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "inqora@workspace:~$ python apps/web/app/blinky/scripts/build_binaries.py",
    "✓ Built: desktop-app 0.0.0.exe (Windows Executable)",
  ]);
  const [isMoving, setIsMoving] = useState(false);

  // Theme initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem("blinkity-theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    document.documentElement.className = initialTheme;
    setMounted(true);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("blinkity-theme", nextTheme);
    document.documentElement.className = nextTheme;
  };

  // Load chat sessions from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("blinkity-chats");
      if (saved) {
        try {
          const parsed: BlinkyChatSession[] = JSON.parse(saved);
          setSessions(parsed);
          if (parsed.length > 0 && parsed[0]) {
            setActiveSessionId(parsed[0].id);
          }
        } catch (e) {
          console.error("Failed to parse chat sessions", e);
        }
      } else {
        const defaultSession: BlinkyChatSession = {
          id: "default",
          title: "Workspace Chat",
          messages: [
            {
              id: "msg-1",
              role: "assistant",
              content: "Hello! I am Blinky. How can I assist with your workspace?",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ],
          updatedAt: new Date().toISOString(),
        };
        setSessions([defaultSession]);
        setActiveSessionId(defaultSession.id);
        localStorage.setItem("blinkity-chats", JSON.stringify([defaultSession]));
      }
    }
  }, []);

  // Fetch TTS system voices
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setVoicesList(voices);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Initialize Speech-To-Text Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setAssistPrompt(transcript);
          setIsListening(false);
        };
        rec.onerror = () => setIsListening(false);
        rec.onend = () => setIsListening(false);
        setRecognition(rec);
      }
    }
  }, []);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeSessionId, isStreaming]);

  // Voice Speech synthesis trigger
  const speakText = (text: string) => {
    if (!ttsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) {
      const voiceObj = voicesList.find((v) => v.voiceURI === selectedVoice);
      if (voiceObj) utterance.voice = voiceObj;
    }
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    utterance.volume = voiceVolume;
    window.speechSynthesis.speak(utterance);
  };

  // STT Toggle
  const handleToggleListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  // Session handlers
  const handleNewSession = () => {
    const newSession: BlinkyChatSession = {
      id: `session-${Date.now()}`,
      title: `Session ${sessions.length + 1}`,
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: "New session started.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    setActiveSessionId(newSession.id);
    localStorage.setItem("blinkity-chats", JSON.stringify(updated));
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) return;
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    if (activeSessionId === id && updated[0]) {
      setActiveSessionId(updated[0].id);
    }
    localStorage.setItem("blinkity-chats", JSON.stringify(updated));
  };

  // Trigger guide demo animation in simulator
  const handleTriggerGuideDemo = (action: string) => {
    setIsMoving(true);
    if (action === "typecheck") {
      setCursorPos({ x: 80, y: 25 });
      setFocusRing({ visible: true, x: 80, y: 25 });
      setTooltip({ visible: true, text: "TypeScript validation...", x: 80, y: 25 });
      setTerminalOutput((prev) => [
        ...prev,
        "inqora@workspace:~$ npx tsc --noEmit",
        "✓ 0 type errors found.",
      ]);
    } else {
      setCursorPos({ x: 50, y: 60 });
      setFocusRing({ visible: true, x: 50, y: 60 });
      setTooltip({ visible: true, text: "Adjusting overlay...", x: 50, y: 60 });
    }
    setTimeout(() => {
      setIsMoving(false);
      setFocusRing({ visible: false, x: 0, y: 0 });
      setTooltip({ visible: false, text: "", x: 0, y: 0 });
    }, 2500);
  };

  // Handle prompt submit
  const handleSendMessage = () => {
    if (!assistPrompt.trim() || isStreaming) return;
    const activeSession = sessions.find((s) => s.id === activeSessionId);
    if (!activeSession) return;

    const userMessage: BlinkyMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: assistPrompt.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...activeSession.messages, userMessage];
    const updatedSession = { ...activeSession, messages: updatedMessages, updatedAt: new Date().toISOString() };
    const updatedSessions = sessions.map((s) => (s.id === activeSessionId ? updatedSession : s));

    setSessions(updatedSessions);
    setAssistPrompt("");
    setIsStreaming(true);

    // Simulate AI response
    setTimeout(() => {
      const responseText = `Analyzed: "${userMessage.content}". Blinky desktop overlays active.`;
      const assistantMessage: BlinkyMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      const finalSession = { ...updatedSession, messages: finalMessages, updatedAt: new Date().toISOString() };
      const finalSessions = sessions.map((s) => (s.id === activeSessionId ? finalSession : s));

      setSessions(finalSessions);
      localStorage.setItem("blinkity-chats", JSON.stringify(finalSessions));
      setIsStreaming(false);

      speakText(responseText);
    }, 800);
  };

  if (!mounted) return null;

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
      {/* Floating Pill Header */}
      <BlinkyHeader theme={theme} onToggleTheme={handleToggleTheme} />

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-6">
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            Context-aware AI overlay for desktop.
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed font-normal">
            Captures screen state, directs focus, and integrates seamlessly with your workspace.
          </p>

          {/* Action CTAs */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <a
              href="/api/download/win"
              download="desktop-app-0.0.0.exe"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-xs font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download for Windows</span>
            </a>
            <a
              href="#simulator"
              className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-6 py-3 text-xs font-medium text-foreground backdrop-blur-2xl transition-colors hover:bg-accent"
            >
              <Play className="h-3 w-3" />
              <span>Simulator</span>
            </a>
          </div>
        </div>
      </section>

      {/* Main Workspace Container */}
      <main className="flex-1 px-6 pb-24 space-y-16 max-w-5xl mx-auto w-full">
        {/* Core Capabilities */}
        <BlinkyFeatures />

        {/* Desktop Simulator & Voice Engine */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            <BlinkyDesktopSimulator
              cursorPos={cursorPos}
              focusRing={focusRing}
              tooltip={tooltip}
              simOpacity={simOpacity}
              onOpacityChange={setSimOpacity}
              terminalOutput={terminalOutput}
              isMoving={isMoving}
              onTriggerGuide={handleTriggerGuideDemo}
            />

            <BlinkyVoiceSettings
              ttsEnabled={ttsEnabled}
              onToggleTts={() => setTtsEnabled(!ttsEnabled)}
              selectedVoice={selectedVoice}
              onSelectVoice={setSelectedVoice}
              voiceRate={voiceRate}
              onChangeRate={setVoiceRate}
              voicePitch={voicePitch}
              onChangePitch={setVoicePitch}
              voiceVolume={voiceVolume}
              onChangeVolume={setVoiceVolume}
              voicesList={voicesList}
              isListening={isListening}
              onToggleListening={handleToggleListening}
            />
          </div>

          {/* Chat Assistant */}
          <div id="chat" className="flex h-[530px] rounded-3xl border border-border/40 bg-card/30 backdrop-blur-2xl overflow-hidden">
            <BlinkyChatSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSessionId}
              onNewSession={handleNewSession}
              onDeleteSession={handleDeleteSession}
            />

            <div className="flex-1 flex flex-col justify-between p-4 bg-background/20">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {currentSession?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col space-y-1 ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2 text-xs max-w-[88%] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-foreground text-background font-medium"
                          : "bg-card border border-border/40 text-foreground"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isStreaming && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-2">
                    <Sparkles className="h-3 w-3" />
                    <span>Thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask assistant..."
                  value={assistPrompt}
                  onChange={(e) => setAssistPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  aria-label="Ask assistant"
                  className="flex-1 rounded-2xl border border-border/40 bg-background/50 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!assistPrompt.trim() || isStreaming}
                  aria-label="Send message"
                  className="flex h-8 w-8 items-center justify-center rounded-2xl bg-foreground text-background disabled:opacity-30 transition-opacity"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Payload Downloads */}
        <BlinkyDownloads />
      </main>

      {/* Minimalist Footer */}
      <footer className="border-t border-border/40 py-8 px-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <p>© 2026 Blinky</p>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#simulator" className="hover:text-foreground transition-colors">Simulator</a>
            <a href="#downloads" className="hover:text-foreground transition-colors">Downloads</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

