"use client";

import React, { useState, useEffect, useRef } from "react";
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
    Volume2,
    VolumeX,
    Plus,
    Trash2,
    MessageSquare,
    Mic,
    MicOff,
    Play,
    Info,
    AlertCircle,
    User,
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

// Message interface for Chat history
interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}

// Chat Session interface
interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
}

export default function Page() {
    // Theme state settings
    const [theme, setTheme] = useState<"light" | "dark">("dark");
    const [mounted, setMounted] = useState(false);

    // App interactive states
    const [activeTab, setActiveTab] = useState<"assist" | "guide" | "overlay">("assist");
    const [assistPrompt, setAssistPrompt] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);

    // Simulated desktop overlay settings
    const [mockOpacity, setMockOpacity] = useState(90);
    const [mockBlur, setMockBlur] = useState(false);
    const [mockClickThrough, setMockClickThrough] = useState(false);

    // Global guide modal portal (triggered by text requests)
    const [guideActive, setGuideActive] = useState(false);

    // Chat History states
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Voice assistant configuration states (TTS)
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [selectedVoice, setSelectedVoice] = useState<string>("");
    const [voiceRate, setVoiceRate] = useState(1.0);
    const [voicePitch, setVoicePitch] = useState(1.0);
    const [voiceVolume, setVoiceVolume] = useState(0.8);
    const [voicesList, setVoicesList] = useState<SpeechSynthesisVoice[]>([]);
    const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);

    // Speech-To-Text configurations (STT)
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);

    // Coonay (Clicky) Desktop simulation states
    const [coonayCursorPos, setCoonayCursorPos] = useState({ x: 50, y: 50 });
    const [coonayActiveGuide, setCoonayActiveGuide] = useState<string | null>(null);
    const [coonayTooltip, setCoonayTooltip] = useState({ visible: false, text: "", x: 0, y: 0 });
    const [coonayFocusRing, setCoonayFocusRing] = useState({ visible: false, x: 0, y: 0 });
    const [coonaySimOpacity, setCoonaySimOpacity] = useState(90);
    const [coonaySimVsCodeOpen, setCoonaySimVsCodeOpen] = useState(true);
    const [coonaySimTerminalOutput, setCoonaySimTerminalOutput] = useState<string[]>([
        "inqora@workspace:~$ npm run check-types",
        "✓ Types verified. Monorepo builds clean."
    ]);
    const [coonayIsMoving, setCoonayIsMoving] = useState(false);

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

    // Load Chat Sessions from localStorage on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("blinkity-chats");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setSessions(parsed);
                    if (parsed.length > 0) {
                        setActiveSessionId(parsed[0].id);
                    }
                } catch (e) {
                    console.error("Failed to parse chats data", e);
                }
            } else {
                // Initialize default chat session
                const defaultSession: ChatSession = {
                    id: "default",
                    title: "Workspace Chat",
                    messages: [
                        {
                            id: "msg-init",
                            role: "assistant",
                            content: "Ask Blinkity about your workspace to begin...",
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        }
                    ],
                    createdAt: new Date().toISOString()
                };
                setSessions([defaultSession]);
                setActiveSessionId(defaultSession.id);
                localStorage.setItem("blinkity-chats", JSON.stringify([defaultSession]));
            }
        }
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [sessions, activeSessionId, isStreaming]);

    // Fetch Speech Synthesis system voices
    useEffect(() => {
        const loadVoices = () => {
            if (typeof window !== "undefined" && window.speechSynthesis) {
                const list = window.speechSynthesis.getVoices();
                setVoicesList(list);
                if (list.length > 0 && !selectedVoice) {
                    // Try to default to en-US or English speaker
                    const englishVoice = list.find((v) => v.lang.includes("en-US") || v.lang.includes("en"));
                    setSelectedVoice(englishVoice ? englishVoice.name : (list[0]?.name ?? ""));
                }
            }
        };

        loadVoices();
        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            if (typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, [selectedVoice]);

    // Speech-To-Text implementation using web SpeechRecognition
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recInstance = new SpeechRecognition();
                recInstance.continuous = false;
                recInstance.interimResults = false;
                recInstance.lang = "en-US";

                recInstance.onstart = () => {
                    setIsListening(true);
                };

                recInstance.onend = () => {
                    setIsListening(false);
                };

                recInstance.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    setAssistPrompt(transcript);
                    handleSendMessage(transcript);
                };

                recInstance.onerror = (err: any) => {
                    console.error("Speech Recognition capture error:", err);
                    setIsListening(false);
                };

                setRecognition(recInstance);
            }
        }
    }, [sessions, activeSessionId]);

    // TTS speaker helper
    const speakText = (text: string) => {
        if (typeof window === "undefined" || !window.speechSynthesis || !ttsEnabled) return;

        window.speechSynthesis.cancel(); // Stop current speak immediately

        // Strip characters like markdown tags to make speech flow cleanly
        const cleanText = text.replace(/[*_#`~]/g, "");
        const utterance = new SpeechSynthesisUtterance(cleanText);

        const currentVoice = voicesList.find((v) => v.name === selectedVoice);
        if (currentVoice) {
            utterance.voice = currentVoice;
        }

        utterance.rate = voiceRate;
        utterance.pitch = voicePitch;
        utterance.volume = voiceVolume;

        utterance.onstart = () => {
            setIsPlayingSpeech(true);
        };
        utterance.onend = () => {
            setIsPlayingSpeech(false);
        };
        utterance.onerror = () => {
            setIsPlayingSpeech(false);
        };

        window.speechSynthesis.speak(utterance);
    };

    // Tab visibility change listeners: Cancel synthesis immediately
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
                setIsPlayingSpeech(false);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    // Stop speaking when mock tabs are swapped
    useEffect(() => {
        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsPlayingSpeech(false);
        }
    }, [activeTab]);

    // Toggle active theme
    const toggleTheme = () => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        localStorage.setItem("blinkity-theme", nextTheme);
        document.documentElement.className = nextTheme;
    };

    // Chat management helpers
    const createNewSession = () => {
        const newSession: ChatSession = {
            id: `session-${Date.now()}`,
            title: `Chat Session ${sessions.length + 1}`,
            messages: [
                {
                    id: `msg-${Date.now()}`,
                    role: "assistant",
                    content: "Hello! How can I assist you with your workspace parameters today?",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }
            ],
            createdAt: new Date().toISOString()
        };

        const updated = [...sessions, newSession];
        setSessions(updated);
        setActiveSessionId(newSession.id);
        localStorage.setItem("blinkity-chats", JSON.stringify(updated));
    };

    const deleteSession = (id: string) => {
        const filtered = sessions.filter((s) => s.id !== id);
        if (filtered.length === 0) {
            const defaultSession: ChatSession = {
                id: "default",
                title: "Workspace Chat",
                messages: [
                    {
                        id: `msg-${Date.now()}`,
                        role: "assistant",
                        content: "Ask Blinkity about your workspace to begin...",
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }
                ],
                createdAt: new Date().toISOString()
            };
            setSessions([defaultSession]);
            setActiveSessionId("default");
            localStorage.setItem("blinkity-chats", JSON.stringify([defaultSession]));
        } else {
            setSessions(filtered);
            localStorage.setItem("blinkity-chats", JSON.stringify(filtered));
            if (activeSessionId === id) {
                const firstSession = filtered[0];
                if (firstSession) {
                    setActiveSessionId(firstSession.id);
                }
            }
        }
    };

    // Chat Message execution logic
    const handleSendMessage = (textToSend: string) => {
        if (!textToSend.trim() || isStreaming || !activeSessionId) return;

        const userMsg: Message = {
            id: `msg-user-${Date.now()}`,
            role: "user",
            content: textToSend,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        // Append user message
        const updated = sessions.map((s) => {
            if (s.id === activeSessionId) {
                return {
                    ...s,
                    messages: [...s.messages, userMsg]
                };
            }
            return s;
        });

        setSessions(updated);
        localStorage.setItem("blinkity-chats", JSON.stringify(updated));
        setAssistPrompt("");
        setIsStreaming(true);

        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsPlayingSpeech(false);
        }

        // Generate response context
        let targetResponse = "";
        const lowerText = textToSend.toLowerCase();

        if (lowerText.includes("explain") || lowerText.includes("screen") || lowerText.includes("analyze")) {
            targetResponse = "Analyzing screen context... Detected VS Code workspace. Active file: App.tsx (Line 42). The page code contains standard layouts. Recommended action: Synchronize dependencies and run 'npm run dev' to start the local developer server.";
        } else if (lowerText.includes("guide") || lowerText.includes("source")) {
            targetResponse = "Activating guide overlay. Directing attention to 'Source Code' module below. Guidance indicators active on main viewport.";
            setGuideActive(true);
        } else if (lowerText.includes("close vs code") || lowerText.includes("close vscode") || lowerText.includes("close code")) {
            targetResponse = "Entering Coonay Cursor guide mode to show you how to close VS Code. Opening simulated workspace overlay...";
            setTimeout(() => {
                setActiveTab("guide");
                triggerCoonayGuide("close-vscode");
            }, 1200);
        } else if (lowerText.includes("terminal") || lowerText.includes("where is terminal") || lowerText.includes("console")) {
            targetResponse = "Locating bash terminal workspace console. Swapping tabs to Coonay guidance overlay...";
            setTimeout(() => {
                setActiveTab("guide");
                triggerCoonayGuide("find-terminal");
            }, 1200);
        } else if (lowerText.includes("opacity") || lowerText.includes("translucent") || lowerText.includes("change opacity")) {
            targetResponse = "Opening slider guides inside settings tab. Coonay cursor routing configured.";
            setTimeout(() => {
                setActiveTab("guide");
                triggerCoonayGuide("change-opacity");
            }, 1200);
        } else {
            targetResponse = `Processing screen query: "${textToSend}". Workspace parameters parsed. Active frame layout looks healthy. Ready for next commands.`;
        }

        // Stream simulation
        let index = 0;
        let streamedStr = "";

        const intervalId = setInterval(() => {
            if (index < targetResponse.length) {
                streamedStr += targetResponse.charAt(index);

                setSessions((prev) =>
                    prev.map((s) => {
                        if (s.id === activeSessionId) {
                            const hasStreamMsg = s.messages.some((m) => m.id === "streaming-msg");
                            let newMsgs = [...s.messages];
                            if (hasStreamMsg) {
                                newMsgs = newMsgs.map((m) =>
                                    m.id === "streaming-msg" ? { ...m, content: streamedStr } : m
                                );
                            } else {
                                newMsgs.push({
                                    id: "streaming-msg",
                                    role: "assistant",
                                    content: streamedStr,
                                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                });
                            }
                            return { ...s, messages: newMsgs };
                        }
                        return s;
                    })
                );
                index++;
            } else {
                clearInterval(intervalId);
                setIsStreaming(false);

                // Convert streaming message to finalized permanent message
                setSessions((prev) => {
                    const finalSessions = prev.map((s) => {
                        if (s.id === activeSessionId) {
                            const newMsgs = s.messages.map((m) =>
                                m.id === "streaming-msg"
                                    ? { ...m, id: `msg-resp-${Date.now()}` }
                                    : m
                            );
                            return { ...s, messages: newMsgs };
                        }
                        return s;
                    });
                    localStorage.setItem("blinkity-chats", JSON.stringify(finalSessions));
                    return finalSessions;
                });

                // Speak completed text
                speakText(targetResponse);
            }
        }, 10);
    };

    // Toggle voice recognition start/stop
    const toggleSpeechRecognition = () => {
        if (!recognition) {
            alert("Speech recognition API is not supported or active on this browser device.");
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            if (typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
                setIsPlayingSpeech(false);
            }
            recognition.start();
        }
    };

    // Coonay Clicky Interactive Guide Trigger
    const triggerCoonayGuide = (guideId: string) => {
        if (coonayIsMoving) return;
        setCoonayIsMoving(true);
        setCoonayActiveGuide(guideId);

        // Clear existing states
        setCoonayTooltip({ visible: false, text: "", x: 0, y: 0 });
        setCoonayFocusRing({ visible: false, x: 0, y: 0 });

        // Reset VS Code window if requested
        if (guideId === "close-vscode") {
            setCoonaySimVsCodeOpen(true);
        }

        let targetX = 50;
        let targetY = 50;
        let textIntro = "";
        let textOutro = "";
        let bubbleText = "";

        switch (guideId) {
            case "close-vscode":
                targetX = 7;
                targetY = 15;
                textIntro = "To close VS Code, let me guide your cursor to the red window close button in the top left corner.";
                bubbleText = "Click the red dot to close the active VS Code window frame.";
                textOutro = "Perfect! The simulated VS Code window frame has been closed.";
                break;
            case "find-terminal":
                targetX = 25;
                targetY = 80;
                textIntro = "Let's find the bash terminal console. Moving our pointer overlay down to the command shell window.";
                bubbleText = "This is the active command console workspace terminal.";
                textOutro = "Terminal located! Starting dev server filters.";
                break;
            case "change-opacity":
                targetX = 80;
                targetY = 46;
                textIntro = "To change the mock overlay opacity settings, we point to the opacity slider bar.";
                bubbleText = "Drag this slider to adjust overlay transparency values.";
                textOutro = "Opacity successfully updated to sixty percent.";
                break;
            case "download-source":
                targetX = 78;
                targetY = 22;
                textIntro = "Let's locate the desktop download folder containing the workspace source files.";
                bubbleText = "Double-click this folder shortcut to open source package paths.";
                textOutro = "Source workspace folder targeted and open.";
                break;
        }

        // Voice Intro
        speakText(textIntro);

        // Translate cursor coordinates
        setTimeout(() => {
            setCoonayCursorPos({ x: targetX, y: targetY });

            // Show highlights on arrival
            setTimeout(() => {
                setCoonayFocusRing({ visible: true, x: targetX, y: targetY });
                setCoonayTooltip({ visible: true, text: bubbleText, x: targetX, y: targetY });

                // Execute action change
                setTimeout(() => {
                    if (guideId === "close-vscode") {
                        setCoonaySimVsCodeOpen(false);
                    } else if (guideId === "find-terminal") {
                        setCoonaySimTerminalOutput((prev) => [
                            ...prev,
                            "inqora@workspace:~$ npm run dev --filter=desktop-app",
                            "⟳ Launching monorepo desktop-app package...",
                            "✓ Live local server running on port 3000"
                        ]);
                    } else if (guideId === "change-opacity") {
                        // Sim drag thumb left
                        setCoonayCursorPos({ x: 68, y: 46 });
                        setCoonaySimOpacity(60);
                        setMockOpacity(60);
                    }

                    // Voice Outro
                    speakText(textOutro);

                    setTimeout(() => {
                        setCoonayIsMoving(false);
                    }, 1400);

                }, 1800);

            }, 1200);

        }, 800);
    };

    const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    const samplePrompts = [
        "Explain screen context",
        "Where is the terminal?",
        "How do I close VS Code",
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
                            You triggered a workspace Guidance Overlay. In a real desktop environment, Blinkity projects absolute guidance focus rings directly over active OS layout boundaries:
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
                                className="bg-accent-blue hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                                Go to Target
                            </button>
                            <button
                                onClick={() => setGuideActive(false)}
                                className="bg-card-hover border border-card-border text-foreground px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
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
            <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-12 grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center relative z-10">
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
                    className="glass-card surface-shadow relative overflow-hidden rounded-2xl p-5 border border-card-border w-full"
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
                                { id: "guide", label: "Coonay Guide", icon: MousePointerClick },
                                { id: "overlay", label: "Settings", icon: Settings },
                            ].map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as "assist" | "guide" | "overlay")}
                                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[10px] font-semibold transition-all duration-200 w-full cursor-pointer ${activeTab === tab.id
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
                        <div className={`rounded-xl border border-card-border bg-background p-4 min-h-[380px] flex flex-col justify-between transition-all duration-300 ${mockBlur ? 'blur-sm select-none pointer-events-none' : ''}`}>
                            {activeTab === "assist" && (
                                <div className="grid grid-cols-[110px_1fr] h-[350px] gap-2 text-left">
                                    {/* Saved Chats Sidebar */}
                                    <div className="border-r border-card-border/60 pr-2 flex flex-col justify-between h-full">
                                        <div className="space-y-1 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin">
                                            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-card-border/40">
                                                <span className="text-[8px] font-bold text-muted uppercase tracking-wider font-mono">Saved Chats</span>
                                                <button
                                                    onClick={createNewSession}
                                                    className="p-1 rounded hover:bg-card-hover text-accent-blue transition cursor-pointer"
                                                    title="New Chat"
                                                >
                                                    <Plus size={10} />
                                                </button>
                                            </div>
                                            {sessions.map((s) => (
                                                <div
                                                    key={s.id}
                                                    onClick={() => setActiveSessionId(s.id)}
                                                    className={`group relative flex items-center justify-between rounded-md px-1.5 py-1 text-[8px] font-medium transition duration-150 cursor-pointer ${s.id === activeSessionId
                                                        ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                                                        : "hover:bg-card-hover text-muted hover:text-foreground border border-transparent"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-1 overflow-hidden w-full pr-3">
                                                        <MessageSquare size={8} className="shrink-0" />
                                                        <span className="truncate">{s.title}</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteSession(s.id);
                                                        }}
                                                        className="absolute right-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition p-0.5"
                                                    >
                                                        <Trash2 size={8} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Chat Message Window */}
                                    <div className="flex flex-col justify-between h-full overflow-hidden">
                                        {/* Chat Messages */}
                                        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 mb-2 max-h-[260px] scrollbar-thin">
                                            {activeSession?.messages.map((m) => (
                                                <div
                                                    key={m.id}
                                                    className={`flex flex-col max-w-[88%] ${m.role === "user" ? "ml-auto items-end" : "items-start"}`}
                                                >
                                                    <div className="flex items-center gap-1 mb-0.5">
                                                        <span className="text-[8px] text-muted font-mono">{m.role === "user" ? "You" : "Blinkity"}</span>
                                                        <span className="text-[7px] text-muted-foreground font-mono">{m.timestamp}</span>
                                                    </div>
                                                    <div
                                                        className={`rounded-lg px-2 py-1.5 text-[9px] leading-relaxed break-words font-mono ${m.role === "user"
                                                            ? "bg-accent-blue text-white"
                                                            : "bg-card border border-card-border text-muted"
                                                            }`}
                                                    >
                                                        {m.content}
                                                    </div>
                                                </div>
                                            ))}
                                            {isStreaming && (
                                                <div className="flex flex-col max-w-[88%] items-start">
                                                    <div className="flex items-center gap-1 mb-0.5">
                                                        <span className="text-[8px] text-muted font-mono">Blinkity</span>
                                                        <span className="text-[8px] text-accent-blue animate-pulse font-mono">typing...</span>
                                                    </div>
                                                    <div className="bg-card border border-card-border rounded-lg px-2 py-1.5 text-[9px] text-muted flex items-center gap-1.5">
                                                        <span className="size-1 rounded-full bg-accent-blue animate-bounce" style={{ animationDelay: "0ms" }} />
                                                        <span className="size-1 rounded-full bg-accent-blue animate-bounce" style={{ animationDelay: "150ms" }} />
                                                        <span className="size-1 rounded-full bg-accent-blue animate-bounce" style={{ animationDelay: "300ms" }} />
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Input area */}
                                        <div className="space-y-1.5 pt-1.5 border-t border-card-border/60">
                                            {/* Sample Prompt Chips */}
                                            <div className="flex gap-1 flex-wrap">
                                                {samplePrompts.map((p) => (
                                                    <button
                                                        key={p}
                                                        disabled={isStreaming}
                                                        onClick={() => {
                                                            setAssistPrompt(p);
                                                            handleSendMessage(p);
                                                        }}
                                                        className="text-[7.5px] bg-card hover:bg-card-hover border border-card-border px-1.5 py-0.5 rounded text-foreground transition disabled:opacity-55 cursor-pointer font-mono"
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex gap-1">
                                                {/* Voice button */}
                                                <button
                                                    onClick={toggleSpeechRecognition}
                                                    className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${isListening
                                                        ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse"
                                                        : "bg-card hover:bg-card-hover border-card-border text-muted hover:text-foreground"
                                                        }`}
                                                    title={isListening ? "Listening..." : "Voice Activation"}
                                                >
                                                    {isListening ? <MicOff size={11} /> : <Mic size={11} />}
                                                </button>

                                                <input
                                                    type="text"
                                                    value={assistPrompt}
                                                    onChange={(e) => setAssistPrompt(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && assistPrompt.trim() && !isStreaming) {
                                                            handleSendMessage(assistPrompt);
                                                        }
                                                    }}
                                                    placeholder="Ask workspace query..."
                                                    className="flex-1 bg-card border border-card-border rounded-lg px-2.5 py-1 text-[10px] text-foreground focus:outline-none focus:border-accent-blue/30 font-mono"
                                                />

                                                <button
                                                    onClick={() => handleSendMessage(assistPrompt)}
                                                    disabled={isStreaming || !assistPrompt.trim()}
                                                    className="bg-accent-blue hover:opacity-90 disabled:opacity-50 text-white text-[9px] px-2.5 rounded-lg font-semibold transition cursor-pointer font-mono"
                                                >
                                                    Send
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "guide" && (
                                <div className="flex flex-col h-[350px] justify-between gap-2.5 text-left relative overflow-hidden">
                                    <div className="flex items-center justify-between border-b border-card-border/40 pb-1.5">
                                        <span className="text-[9px] font-mono text-accent-green flex items-center gap-1 font-semibold">
                                            <span className="size-1.5 bg-accent-green rounded-full animate-pulse" />
                                            Coonay Virtual Guide
                                        </span>
                                        {isPlayingSpeech && (
                                            <div className="flex gap-0.5 items-end h-2.5">
                                                <span className="w-0.5 bg-accent-green animate-[wave-bars_0.6s_ease-in-out_infinite]" />
                                                <span className="w-0.5 bg-accent-green animate-[wave-bars_0.6s_ease-in-out_infinite_0.15s]" />
                                                <span className="w-0.5 bg-accent-green animate-[wave-bars_0.6s_ease-in-out_infinite_0.3s]" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Desktop Simulator Workspace */}
                                    <div className="relative flex-1 bg-slate-950/80 rounded-lg border border-card-border/40 overflow-hidden relative select-none">
                                        {/* Mock VS Code Window */}
                                        <div 
                                            className={`absolute top-[8%] left-[4%] w-[52%] h-[50%] rounded-md bg-slate-900 border border-slate-700/60 flex flex-col shadow-lg transition-all duration-500 ease-in-out transform ${
                                                coonaySimVsCodeOpen ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between bg-slate-950 px-1.5 py-1 border-b border-slate-800 rounded-t-md">
                                                <div className="flex items-center gap-1">
                                                    <span className="size-1.5 rounded-full bg-red-500/80" />
                                                    <span className="size-1.5 rounded-full bg-yellow-500/80" />
                                                    <span className="size-1.5 rounded-full bg-green-500/80" />
                                                </div>
                                                <span className="text-[6.5px] font-mono text-slate-500">App.tsx</span>
                                            </div>
                                            <div className="p-1 font-mono text-[5.5px] leading-tight text-slate-400">
                                                <div><span className="text-pink-400">import</span> React <span className="text-pink-400">from</span> <span className="text-emerald-400">&quot;react&quot;</span>;</div>
                                                <div><span className="text-pink-400">const</span> <span className="text-blue-400">App</span> = () =&gt; &#123;</div>
                                                <div>&nbsp;&nbsp;<span className="text-pink-400">return</span> &lt;<span className="text-yellow-400">Button</span> /&gt;;</div>
                                                <div>&#125;;</div>
                                            </div>
                                        </div>

                                        {/* Mock Terminal Window */}
                                        <div className="absolute bottom-[6%] left-[4%] w-[52%] h-[30%] rounded-md bg-black border border-slate-800 flex flex-col shadow-lg">
                                            <div className="bg-slate-900/60 px-1.5 py-0.5 border-b border-slate-800 text-[5.5px] text-slate-500 font-mono">
                                                bash - terminal
                                            </div>
                                            <div className="p-1 font-mono text-[5px] text-emerald-400 leading-normal overflow-y-auto h-full scrollbar-none">
                                                {coonaySimTerminalOutput.map((line, i) => (
                                                    <div key={i}>{line}</div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Mock Blinkity Overlay Panel Widget */}
                                        <div className="absolute top-[8%] right-[4%] w-[38%] h-[86%] rounded-md bg-slate-900/90 border border-slate-700/50 flex flex-col shadow-lg p-1.5 space-y-1.5">
                                            <div className="text-[7.5px] font-mono text-accent-blue font-bold border-b border-card-border pb-1">
                                                Blinkity Control
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[6px] text-muted">
                                                    <span>Opacity</span>
                                                    <span>{coonaySimOpacity}%</span>
                                                </div>
                                                <div className="h-1 w-full bg-slate-800 rounded-full relative">
                                                    <div 
                                                        className="h-full bg-accent-blue rounded-full" 
                                                        style={{ width: `${coonaySimOpacity}%` }} 
                                                    />
                                                    <div 
                                                        className="absolute size-2 bg-white rounded-full -top-0.5 shadow border border-accent-blue cursor-pointer"
                                                        style={{ left: `calc(${coonaySimOpacity}% - 4px)` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[6px] text-slate-300 p-0.5 bg-slate-950/40 rounded">
                                                <span>Click-Through</span>
                                                <span className="size-1.5 bg-accent-blue rounded-full" />
                                            </div>
                                            <div className="flex items-center justify-between text-[6px] text-slate-300 p-0.5 bg-slate-950/40 rounded">
                                                <span>Privacy Blur</span>
                                                <span className="size-1.5 bg-slate-500 rounded-full" />
                                            </div>
                                        </div>

                                        {/* Desktop Folder Icon */}
                                        <div className="absolute top-[22%] left-[64%] flex flex-col items-center gap-0.5 cursor-pointer">
                                            <div className="size-4.5 bg-accent-blue/15 border border-accent-blue/30 rounded flex items-center justify-center text-accent-blue">
                                                📁
                                            </div>
                                            <span className="text-[5.5px] font-mono text-slate-400">packages</span>
                                        </div>

                                        {/* Floating Coonay Cursor */}
                                        <div 
                                            className="absolute z-40 transition-all duration-[1200ms] ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none"
                                            style={{ left: `${coonayCursorPos.x}%`, top: `${coonayCursorPos.y}%` }}
                                        >
                                            <div className="relative">
                                                <MousePointerClick className="size-4.5 text-accent-green drop-shadow-[0_0_8px_rgba(34,197,94,0.6)] transform -rotate-45" />
                                                <div className="absolute -top-1 -left-1 size-6 bg-accent-green/20 rounded-full blur-md animate-ping" />
                                            </div>
                                        </div>

                                        {/* Pulsing Target focus Ring */}
                                        {coonayFocusRing.visible && (
                                            <div 
                                                className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                                                style={{ left: `${coonayFocusRing.x}%`, top: `${coonayFocusRing.y}%` }}
                                            >
                                                <div className="relative size-7">
                                                    <div className="absolute inset-0 rounded-full border-2 border-accent-green animate-ping opacity-75" />
                                                    <div className="absolute inset-1.5 rounded-full border border-accent-green/60 animate-pulse bg-accent-green/10" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Tooltip Instruction Bubble */}
                                        {coonayTooltip.visible && (
                                            <div 
                                                className="absolute z-50 pointer-events-none shadow-xl border border-card-border bg-slate-900 text-foreground rounded px-2 py-1 max-w-[120px] text-[7px] leading-snug font-mono transform -translate-y-full -translate-x-1/2 -mt-3.5"
                                                style={{ left: `${coonayTooltip.x}%`, top: `${coonayTooltip.y}%` }}
                                            >
                                                <div className="relative">
                                                    {coonayTooltip.text}
                                                    <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Selectors and micro-activation */}
                                    <div className="space-y-1.5 pt-1.5 border-t border-card-border/60">
                                        <div className="flex gap-1 flex-wrap">
                                            {[
                                                { id: "close-vscode", label: "🔴 Close VS Code" },
                                                { id: "find-terminal", label: "💻 Find Terminal" },
                                                { id: "change-opacity", label: "🎚️ Change Opacity" },
                                                { id: "download-source", label: "📥 Source Folder" },
                                            ].map((action) => (
                                                <button
                                                    key={action.id}
                                                    disabled={coonayIsMoving}
                                                    onClick={() => triggerCoonayGuide(action.id)}
                                                    className="text-[7.5px] bg-card hover:bg-card-hover border border-card-border px-1.5 py-0.5 rounded text-foreground transition disabled:opacity-55 cursor-pointer font-mono"
                                                >
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex gap-1">
                                            {/* Guide voice activation */}
                                            <button
                                                onClick={toggleSpeechRecognition}
                                                className={`p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${isListening
                                                    ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse"
                                                    : "bg-card hover:bg-card-hover border-card-border text-muted hover:text-foreground"
                                                    }`}
                                                title="Speak command"
                                            >
                                                {isListening ? <MicOff size={11} /> : <Mic size={11} />}
                                            </button>
                                            <div className="flex-1 bg-card border border-card-border rounded-lg px-2 py-1 text-[8.5px] text-muted flex items-center justify-between font-mono">
                                                <span>{isListening ? "Listening... Try saying 'close VS Code' or 'where is terminal'" : "Ask Coonay coordinates via microphone activation..."}</span>
                                                <Info size={9} className="text-muted/60" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "overlay" && (
                                <div className="flex flex-col h-[350px] justify-between gap-3 text-left overflow-y-auto scrollbar-thin">
                                    <div className="space-y-3.5">
                                        <div className="text-[9px] font-mono text-accent-blue font-bold border-b border-card-border/60 pb-1 flex items-center gap-1 uppercase tracking-wide">
                                            <Settings size={10} />
                                            Overlay Configuration
                                        </div>

                                        <div className="space-y-3">
                                            {/* Opacity Control */}
                                            <div>
                                                <div className="flex justify-between text-[9px] mb-1 text-muted font-mono">
                                                    <span>Overlay Opacity</span>
                                                    <span className="font-semibold">{mockOpacity}%</span>
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
                                                <span className="text-[9.5px] text-foreground font-medium font-mono">Click-Through mode</span>
                                                <input
                                                    type="checkbox"
                                                    checked={mockClickThrough}
                                                    onChange={(e) => setMockClickThrough(e.target.checked)}
                                                    className="size-3 bg-card border-card-border rounded accent-accent-blue cursor-pointer"
                                                />
                                            </label>

                                            {/* Privacy Blur Mode */}
                                            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded bg-card/40 border border-card-border">
                                                <span className="text-[9.5px] text-foreground font-medium font-mono">Privacy security blur</span>
                                                <input
                                                    type="checkbox"
                                                    checked={mockBlur}
                                                    onChange={(e) => setMockBlur(e.target.checked)}
                                                    className="size-3 bg-card border-card-border rounded accent-accent-blue cursor-pointer"
                                                />
                                            </label>
                                        </div>

                                        <div className="text-[9px] font-mono text-accent-green font-bold border-b border-card-border/60 pb-1 pt-1.5 flex items-center gap-1 uppercase tracking-wide">
                                            <Volume2 size={10} />
                                            Voice Synthesis Settings
                                        </div>

                                        <div className="space-y-3">
                                            {/* TTS Toggle */}
                                            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded bg-card/40 border border-card-border">
                                                <span className="text-[9.5px] text-foreground font-medium font-mono">Enable voice responses</span>
                                                <input
                                                    type="checkbox"
                                                    checked={ttsEnabled}
                                                    onChange={(e) => setTtsEnabled(e.target.checked)}
                                                    className="size-3 bg-card border-card-border rounded accent-accent-green cursor-pointer"
                                                />
                                            </label>

                                            {/* Voice Selection Dropdown */}
                                            <div className="space-y-1">
                                                <span className="text-[8.5px] text-muted font-mono">Speaker voice</span>
                                                <select
                                                    value={selectedVoice}
                                                    onChange={(e) => setSelectedVoice(e.target.value)}
                                                    className="w-full bg-card border border-card-border rounded p-1 text-[8.5px] text-foreground focus:outline-none font-mono"
                                                    disabled={!ttsEnabled}
                                                >
                                                    {voicesList.map((v) => (
                                                        <option key={v.name} value={v.name}>
                                                            {v.name} ({v.lang})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Volume Control */}
                                            <div>
                                                <div className="flex justify-between text-[8.5px] mb-1 text-muted font-mono">
                                                    <span>Volume</span>
                                                    <span className="font-semibold">{Math.round(voiceVolume * 100)}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.1"
                                                    value={voiceVolume}
                                                    onChange={(e) => setVoiceVolume(Number(e.target.value))}
                                                    className="w-full h-1 bg-card-border rounded-lg appearance-none cursor-pointer accent-accent-green"
                                                    disabled={!ttsEnabled}
                                                />
                                            </div>

                                            {/* Rate Speed Control */}
                                            <div>
                                                <div className="flex justify-between text-[8.5px] mb-1 text-muted font-mono">
                                                    <span>Speech rate</span>
                                                    <span className="font-semibold">{voiceRate}x</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.5"
                                                    max="2"
                                                    step="0.1"
                                                    value={voiceRate}
                                                    onChange={(e) => setVoiceRate(Number(e.target.value))}
                                                    className="w-full h-1 bg-card-border rounded-lg appearance-none cursor-pointer accent-accent-green"
                                                    disabled={!ttsEnabled}
                                                />
                                            </div>
                                        </div>
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
                            {isPlayingSpeech ? (
                                <span className="flex items-center gap-1 text-accent-green">
                                    <span className="size-1.5 rounded-full bg-accent-green animate-ping" />
                                    speaking
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-accent-green">
                                    <span className="size-1.5 rounded-full bg-accent-green" />
                                    active
                                </span>
                            )}
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
                                        className="bg-accent-blue hover:opacity-90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Download size={11} />
                                        download
                                    </a>
                                ) : (
                                    <span className="text-[9px] uppercase font-mono tracking-wider text-accent-amber bg-accent-amber/5 border border-accent-amber/15 px-2 py-0.5 rounded-md font-medium font-semibold">
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
