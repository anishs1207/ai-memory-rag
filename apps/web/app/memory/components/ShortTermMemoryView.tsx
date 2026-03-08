"use client";

import { useState, useEffect } from "react";

interface Session {
    sessionId: string;
    userId: string;
    messages: Array<{
        id: string;
        role: string;
        content: string;
        timestamp: number;
    }>;
    summary?: string;
    createdAt: number;
    updatedAt: number;
}

interface Props {
    userId: string;
    sessionId: string;
    apiBase: string;
}

export default function ShortTermMemoryView({ userId, sessionId, apiBase }: Props) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selected, setSelected] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, [userId]);

    const loadSessions = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBase}/user/${userId}/sessions`);
            const data = await res.json();
            if (data.success) {
                setSessions(data.data);
                if (data.data.length > 0) setSelected(data.data[0]);
            }
        } catch { }
        setIsLoading(false);
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const deleteSession = async (sid: string) => {
        try {
            await fetch(`${apiBase}/session/${sid}`, { method: "DELETE" });
            setSessions((prev) => prev.filter((s) => s.sessionId !== sid));
            if (selected?.sessionId === sid) setSelected(null);
        } catch { }
    };

    const roleColor: Record<string, string> = {
        user: "#a855f7",
        assistant: "#06b6d4",
        system: "#f59e0b",
    };

    return (
        <div>
            <div className="section-title">Short-Term Memory</div>
            <div className="section-subtitle">
                Sliding window conversation sessions with automatic LLM summarisation when the message window overflows.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, minHeight: 500 }}>
                {/* Session list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div
                        style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.35)",
                            fontWeight: 600,
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            padding: "0 4px",
                        }}
                    >
                        Sessions · {sessions.length}
                    </div>

                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="skeleton" style={{ height: 80 }} />
                        ))
                    ) : sessions.length === 0 ? (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <div className="empty-icon">◎</div>
                            <div className="empty-title">No sessions</div>
                            <div className="empty-desc">Start a conversation in the Memory Chat tab</div>
                        </div>
                    ) : (
                        <div className="session-list">
                            {sessions.map((s) => (
                                <div
                                    key={s.sessionId}
                                    className={`session-card ${selected?.sessionId === s.sessionId ? "selected" : ""}`}
                                    onClick={() => setSelected(s)}
                                >
                                    <div className="session-header">
                                        <div className="session-id">{s.sessionId.slice(0, 8)}…</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div className="session-time">{formatTime(s.updatedAt)}</div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteSession(s.sessionId);
                                                }}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    color: "rgba(255,255,255,0.2)",
                                                    cursor: "pointer",
                                                    fontSize: 12,
                                                    padding: "2px 4px",
                                                }}
                                                title="Delete session"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                    {s.summary ? (
                                        <div className="session-summary">{s.summary.slice(0, 100)}…</div>
                                    ) : (
                                        <div className="session-summary" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                                            No summary yet
                                        </div>
                                    )}
                                    <div className="session-meta">
                                        <span className="session-meta-item">
                                            {s.messages.filter((m) => m.role !== "system").length} messages
                                        </span>
                                        {s.sessionId === sessionId && (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    padding: "2px 8px",
                                                    borderRadius: 4,
                                                    background: "rgba(16,185,129,0.15)",
                                                    color: "#10b981",
                                                }}
                                            >
                                                ACTIVE
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Session detail */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {selected ? (
                        <>
                            {/* Summary */}
                            {selected.summary && (
                                <div className="mem-card" style={{ padding: 16 }}>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "rgba(168,85,247,0.7)",
                                            fontWeight: 600,
                                            letterSpacing: "0.8px",
                                            textTransform: "uppercase",
                                            marginBottom: 8,
                                        }}
                                    >
                                        ◎ Compressed Summary
                                    </div>
                                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                                        {selected.summary}
                                    </div>
                                </div>
                            )}

                            {/* Messages */}
                            <div className="mem-card" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 16 }}>
                                    Recent Messages
                                </div>
                                <div
                                    style={{
                                        overflowY: "auto",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 10,
                                        flex: 1,
                                        maxHeight: 420,
                                        scrollbarWidth: "thin",
                                        scrollbarColor: "rgba(255,255,255,0.1) transparent",
                                    }}
                                >
                                    {selected.messages.filter((m) => m.role !== "system").map((m) => (
                                        <div
                                            key={m.id}
                                            style={{
                                                padding: "10px 14px",
                                                background: "rgba(255,255,255,0.02)",
                                                border: "1px solid rgba(255,255,255,0.06)",
                                                borderLeft: `3px solid ${roleColor[m.role] ?? "#888"}`,
                                                borderRadius: "0 10px 10px 0",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    marginBottom: 6,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: roleColor[m.role] ?? "#888",
                                                        fontFamily: "JetBrains Mono, monospace",
                                                        letterSpacing: "0.5px",
                                                    }}
                                                >
                                                    {m.role.toUpperCase()}
                                                </span>
                                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {formatTime(m.timestamp)}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>
                                                {m.content.length > 200 ? m.content.slice(0, 200) + "…" : m.content}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Meta info */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: 12,
                                }}
                            >
                                {[
                                    {
                                        label: "Session ID",
                                        value: selected.sessionId.slice(0, 12) + "…",
                                        color: "#a855f7",
                                    },
                                    {
                                        label: "Max Window",
                                        value: "20 messages",
                                        color: "#06b6d4",
                                    },
                                    {
                                        label: "Auto-Summary",
                                        value: "Enabled (>25 msgs)",
                                        color: "#10b981",
                                    },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        style={{
                                            padding: "12px 16px",
                                            background: "rgba(255,255,255,0.02)",
                                            border: "1px solid rgba(255,255,255,0.06)",
                                            borderRadius: 10,
                                        }}
                                    >
                                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                                            {item.label}
                                        </div>
                                        <div style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: item.color }}>
                                            {item.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state" style={{ height: "100%" }}>
                            <div className="empty-icon">◎</div>
                            <div className="empty-title">Select a session</div>
                            <div className="empty-desc">Click a session on the left to view its messages and summary</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
