"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    memoryMeta?: {
        shortTermMessages: number;
        longTermResults: number;
        graphNodes: number;
    };
    timestamp: number;
}

interface Props {
    userId: string;
    sessionId: string;
    apiBase: string;
    onMemoryUpdate: () => void;
}

export default function MemoryChat({ userId, sessionId, apiBase, onMemoryUpdate }: Props) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Hello! I'm your memory-powered AI assistant. I remember our conversations, learn facts about you, and build a knowledge graph over time. Ask me anything — I'll recall relevant context from all three memory layers.",
            timestamp: Date.now(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [activeMemory, setActiveMemory] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;
        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input,
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        // Thinking placeholder
        const thinkingId = "thinking-" + Date.now();
        setMessages((prev) => [
            ...prev,
            { id: thinkingId, role: "assistant", content: "__thinking__", timestamp: Date.now() },
        ]);

        try {
            const res = await fetch(`${apiBase}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    sessionId,
                    userMessage: input,
                    baseSystemPrompt:
                        "You are a memory-enhanced AI assistant. Use the memory context to personalise your responses. Reference specific things you remember about the user when relevant. Be conversational and insightful.",
                }),
            });
            const data = await res.json();

            if (data.success) {
                const aiMsg: Message = {
                    id: Date.now().toString() + "-ai",
                    role: "assistant",
                    content: data.data.response,
                    memoryMeta: data.data.memorySources,
                    timestamp: Date.now(),
                };
                setMessages((prev) => prev.filter((m) => m.id !== thinkingId).concat(aiMsg));
                setActiveMemory(data.data.memorySources);
                onMemoryUpdate();
            } else {
                setMessages((prev) =>
                    prev
                        .filter((m) => m.id !== thinkingId)
                        .concat({
                            id: Date.now().toString() + "-err",
                            role: "assistant",
                            content: `Error: ${data.error || "Unknown error"}`,
                            timestamp: Date.now(),
                        })
                );
            }
        } catch (err) {
            setMessages((prev) =>
                prev
                    .filter((m) => m.id !== thinkingId)
                    .concat({
                        id: Date.now().toString() + "-err",
                        role: "assistant",
                        content: "Failed to reach the memory server. Make sure the backend is running.",
                        timestamp: Date.now(),
                    })
            );
        }

        setIsLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (ts: number) =>
        new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const suggestedPrompts = [
        "What do you remember about me?",
        "I love building AI systems with TypeScript",
        "My current project is about memory frameworks",
        "Tell me something interesting you've learned",
    ];

    return (
        <div>
            <div className="section-title">Memory-Aware Chat</div>
            <div className="section-subtitle">
                Every message is enriched with context from all three memory layers — short-term, long-term RAG, and the knowledge graph.
            </div>

            <div className="chat-layout">
                {/* left: messages + input */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
                    {/* Messages */}
                    <div className="chat-messages" style={{ flex: 1, minHeight: 0, maxHeight: "calc(70vh - 120px)" }}>
                        {messages.map((msg) => (
                            <div key={msg.id} className={`chat-message ${msg.role}`}>
                                <div className={`chat-avatar ${msg.role === "user" ? "avatar-user" : "avatar-ai"}`}>
                                    {msg.role === "user" ? "U" : "⚡"}
                                </div>
                                <div style={{ maxWidth: "75%" }}>
                                    {msg.content === "__thinking__" ? (
                                        <div className="chat-bubble bubble-ai">
                                            <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "2px 0" }}>
                                                {[0, 1, 2].map((i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            width: 6,
                                                            height: 6,
                                                            borderRadius: "50%",
                                                            background: "rgba(168,85,247,0.6)",
                                                            animation: `bounce-dots 1.2s ease-in-out ${i * 0.15}s infinite`,
                                                        }}
                                                    />
                                                ))}
                                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginLeft: 4 }}>
                                                    Recalling memory…
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`chat-bubble ${msg.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                                            <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{msg.content}</div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: "rgba(255,255,255,0.2)",
                                                    marginTop: 6,
                                                    fontFamily: "JetBrains Mono, monospace",
                                                }}
                                            >
                                                {formatTime(msg.timestamp)}
                                            </div>
                                            {msg.memoryMeta && (
                                                <div className="chat-memory-badge" style={{ marginTop: 8 }}>
                                                    <span className="memory-badge badge-short">
                                                        ◎ {msg.memoryMeta.shortTermMessages} short-term
                                                    </span>
                                                    <span className="memory-badge badge-long">
                                                        ◈ {msg.memoryMeta.longTermResults} long-term
                                                    </span>
                                                    <span className="memory-badge badge-graph">
                                                        ⬡ {msg.memoryMeta.graphNodes} nodes
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggestions (only when no user messages yet) */}
                    {messages.length === 1 && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {suggestedPrompts.map((prompt) => (
                                <button
                                    key={prompt}
                                    onClick={() => setInput(prompt)}
                                    style={{
                                        padding: "8px 14px",
                                        background: "rgba(168,85,247,0.08)",
                                        border: "1px solid rgba(168,85,247,0.2)",
                                        borderRadius: 8,
                                        color: "rgba(255,255,255,0.55)",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        fontFamily: "Inter, sans-serif",
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.target as HTMLButtonElement).style.background = "rgba(168,85,247,0.15)";
                                        (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.target as HTMLButtonElement).style.background = "rgba(168,85,247,0.08)";
                                        (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)";
                                    }}
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="chat-input-area">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                            className="chat-input"
                            rows={2}
                            style={{ resize: "none" }}
                        />
                        <button
                            className="chat-send-btn"
                            onClick={sendMessage}
                            disabled={isLoading || !input.trim()}
                        >
                            {isLoading ? "…" : "Send"}
                        </button>
                    </div>
                </div>

                {/* Right sidebar: memory context */}
                <div className="mem-sidebar">
                    <div className="mem-sidebar-section">
                        <div className="mem-sidebar-label">
                            <span style={{ color: "var(--mem-purple)" }}>◎</span>
                            Memory Context
                        </div>
                        {activeMemory ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        background: "rgba(168,85,247,0.08)",
                                        border: "1px solid rgba(168,85,247,0.2)",
                                        borderRadius: 10,
                                    }}
                                >
                                    <div style={{ fontSize: 11, color: "rgba(168,85,247,0.7)", marginBottom: 4 }}>SHORT-TERM</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "rgba(168,85,247,0.9)" }}>
                                        {activeMemory.shortTermMessages}
                                    </div>
                                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>recent messages recalled</div>
                                </div>
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        background: "rgba(6,182,212,0.08)",
                                        border: "1px solid rgba(6,182,212,0.2)",
                                        borderRadius: 10,
                                    }}
                                >
                                    <div style={{ fontSize: 11, color: "rgba(6,182,212,0.7)", marginBottom: 4 }}>LONG-TERM</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "rgba(6,182,212,0.9)" }}>
                                        {activeMemory.longTermResults}
                                    </div>
                                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>semantic matches found</div>
                                </div>
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        background: "rgba(245,158,11,0.08)",
                                        border: "1px solid rgba(245,158,11,0.2)",
                                        borderRadius: 10,
                                    }}
                                >
                                    <div style={{ fontSize: 11, color: "rgba(245,158,11,0.7)", marginBottom: 4 }}>KNOWLEDGE GRAPH</div>
                                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "rgba(245,158,11,0.9)" }}>
                                        {activeMemory.graphNodes}
                                    </div>
                                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>related entities injected</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                                Send a message to see memory usage
                            </div>
                        )}
                    </div>

                    <div className="mem-sidebar-section">
                        <div className="mem-sidebar-label">
                            <span style={{ color: "var(--mem-cyan)" }}>◈</span>
                            How It Works
                        </div>
                        {[
                            { step: "1", text: "Query → all 3 memory layers recalled in parallel", color: "#a855f7" },
                            { step: "2", text: "Context composed into system prompt", color: "#06b6d4" },
                            { step: "3", text: "Gemini generates contextual response", color: "#10b981" },
                            { step: "4", text: "Messages stored → LLM extracts new facts", color: "#f59e0b" },
                            { step: "5", text: "Knowledge graph + long-term updated async", color: "#ef4444" },
                        ].map((item) => (
                            <div key={item.step} className="mem-fact-item" style={{ display: "flex", gap: 10 }}>
                                <span
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: "50%",
                                        background: `${item.color}20`,
                                        border: `1px solid ${item.color}40`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: item.color,
                                        flexShrink: 0,
                                    }}
                                >
                                    {item.step}
                                </span>
                                <span style={{ fontSize: 11, lineHeight: 1.5 }}>{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
