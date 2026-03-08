"use client";

import { useState } from "react";

interface SearchResult {
    entry: {
        id: string;
        content: string;
        summary: string;
        source: string;
        tags: string[];
        importance: number;
        accessCount: number;
        createdAt: number;
        confidence: number;
    };
    score: number;
}

interface Props {
    userId: string;
    apiBase: string;
}

export default function LongTermMemorySearch({ userId, apiBase }: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [manualContent, setManualContent] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [addSuccess, setAddSuccess] = useState(false);
    const [filterSource, setFilterSource] = useState<string>("all");

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch(`${apiBase}/long-term/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, userId, topK: 8, ...(filterSource !== "all" ? { filterSource } : {}) }),
            });
            const data = await res.json();
            if (data.success) setResults(data.data);
        } catch { }
        setIsSearching(false);
    };

    const handleAddMemory = async () => {
        if (!manualContent.trim()) return;
        setIsAdding(true);
        try {
            const res = await fetch(`${apiBase}/long-term`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    content: manualContent,
                    source: "explicit",
                    importance: 0.8,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setAddSuccess(true);
                setManualContent("");
                setTimeout(() => setAddSuccess(false), 3000);
            }
        } catch { }
        setIsAdding(false);
    };

    const sourceOptions = [
        { value: "all", label: "All Sources" },
        { value: "conversation", label: "Conversation" },
        { value: "document", label: "Document" },
        { value: "extracted", label: "Extracted" },
        { value: "explicit", label: "Explicit" },
    ];

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return (
        <div>
            <div className="section-title">Long-Term Memory</div>
            <div className="section-subtitle">
                Semantic similarity search over your long-term episodic and semantic memories stored in Pinecone vector store.
            </div>

            {/* Search section */}
            <div className="mem-card" style={{ marginBottom: 20 }}>
                <div className="mem-card-title" style={{ marginBottom: 16 }}>
                    <div className="mem-card-icon icon-cyan">◈</div>
                    Semantic Search
                </div>
                <div className="search-bar">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search your long-term memories semantically…"
                        className="search-input"
                    />
                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 10,
                            padding: "12px 14px",
                            color: "rgba(255,255,255,0.7)",
                            fontSize: 13,
                            outline: "none",
                            cursor: "pointer",
                            minWidth: 140,
                        }}
                    >
                        {sourceOptions.map((opt) => (
                            <option key={opt.value} value={opt.value} style={{ background: "#0f1320" }}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <button className="search-btn" onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? "Searching…" : "Search"}
                    </button>
                </div>

                {/* Results */}
                {isSearching ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="skeleton" style={{ height: 80 }} />
                        ))}
                    </div>
                ) : results.length > 0 ? (
                    <div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>
                            Found {results.length} memory matches
                        </div>
                        {results.map((r, i) => (
                            <div key={r.entry.id} className="search-result-card">
                                <div className="result-header">
                                    <span className={`result-source source-${r.entry.source}`}>
                                        {r.entry.source.toUpperCase()}
                                    </span>
                                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                        <span className="result-score">
                                            {(r.score * 100).toFixed(1)}% match
                                        </span>
                                        <div
                                            style={{
                                                width: 60,
                                                height: 4,
                                                background: "rgba(255,255,255,0.06)",
                                                borderRadius: 2,
                                                overflow: "hidden",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    height: "100%",
                                                    width: `${r.score * 100}%`,
                                                    background: "linear-gradient(90deg, #06b6d4, #3b82f6)",
                                                    borderRadius: 2,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="result-content">{r.entry.summary}</div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div className="result-tags">
                                        {r.entry.tags.map((tag) => (
                                            <span key={tag} className="result-tag">#{tag}</span>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {formatDate(r.entry.createdAt)} · accessed {r.entry.accessCount}×
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : query && !isSearching ? (
                    <div className="empty-state" style={{ padding: 40 }}>
                        <div className="empty-icon">◈</div>
                        <div className="empty-title">No memories found</div>
                        <div className="empty-desc">
                            No long-term memories match your query. Chat more to build up your memory store.
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Manual memory add */}
            <div className="mem-card">
                <div className="mem-card-title" style={{ marginBottom: 16 }}>
                    <div className="mem-card-icon icon-purple">＋</div>
                    Manually Add Memory
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <textarea
                        value={manualContent}
                        onChange={(e) => setManualContent(e.target.value)}
                        placeholder="Type a memory to explicitly store (e.g. 'I prefer TypeScript over JavaScript', 'I work at XYZ Corp', 'My dog is called Max')…"
                        className="search-input"
                        rows={3}
                        style={{ resize: "vertical" }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
                        {addSuccess && (
                            <span style={{ color: "#10b981", fontSize: 13 }}>✓ Memory stored successfully!</span>
                        )}
                        <button
                            className="search-btn"
                            onClick={handleAddMemory}
                            disabled={isAdding || !manualContent.trim()}
                        >
                            {isAdding ? "Storing…" : "Store Memory"}
                        </button>
                    </div>
                </div>

                {/* Info about what's stored */}
                <div
                    style={{
                        marginTop: 16,
                        padding: 14,
                        background: "rgba(6,182,212,0.05)",
                        border: "1px solid rgba(6,182,212,0.1)",
                        borderRadius: 10,
                    }}
                >
                    <div style={{ fontSize: 11, color: "rgba(6,182,212,0.7)", fontWeight: 600, marginBottom: 8 }}>
                        HOW LONG-TERM MEMORY WORKS
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                            "Text → Gemini embeddings → Pinecone namespace",
                            "Isolated per user/agent namespace",
                            "Confidence decays over time (logarithmic)",
                            "Access count tracked for importance ranking",
                            "Auto-extracted from every conversation",
                        ].map((item, i) => (
                            <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "flex", gap: 8 }}>
                                <span style={{ color: "rgba(6,182,212,0.5)" }}>▸</span>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
