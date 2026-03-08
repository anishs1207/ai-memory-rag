"use client";

import { useState } from "react";

interface MemoryStatsProps {
    stats: any;
    isLoading: boolean;
    graphData: { nodes: any[]; edges: any[] } | null;
}

const NODE_TYPE_COLORS: Record<string, string> = {
    Person: "#a855f7",
    Concept: "#06b6d4",
    Skill: "#10b981",
    Project: "#f59e0b",
    Goal: "#ef4444",
    Preference: "#ec4899",
    Event: "#8b5cf6",
    Belief: "#f97316",
    Topic: "#6366f1",
    Agent: "#3b82f6",
};

export default function MemoryStats({ stats, isLoading, graphData }: MemoryStatsProps) {
    const kgStats = stats?.knowledgeGraph;
    const stStats = stats?.shortTerm;

    const statCards = [
        {
            label: "KG Nodes",
            value: kgStats?.totalNodes ?? 0,
            desc: "Entities in knowledge graph",
            colorClass: "",
        },
        {
            label: "KG Edges",
            value: kgStats?.totalEdges ?? 0,
            desc: "Relationships mapped",
            colorClass: "cyan",
        },
        {
            label: "Sessions",
            value: stStats?.totalSessions ?? 0,
            desc: "Short-term memory sessions",
            colorClass: "amber",
        },
        {
            label: "Messages",
            value: stStats?.totalMessages ?? 0,
            desc: "Total turns across sessions",
            colorClass: "green",
        },
    ];

    const topEntities: any[] = kgStats?.topEntities ?? [];
    const nodesByType: Record<string, number> = kgStats?.nodesByType ?? {};

    return (
        <div>
            <div className="section-title">Memory Overview</div>
            <div className="section-subtitle">
                Real-time view of all three memory layers — knowledge graph, semantic long-term, and conversational short-term.
            </div>

            {/* Stat cards */}
            <div className="stats-grid">
                {statCards.map((card) => (
                    <div key={card.label} className="stat-card">
                        <div className="stat-label">{card.label}</div>
                        {isLoading ? (
                            <div className="skeleton" style={{ height: 40, width: 80, marginBottom: 4 }} />
                        ) : (
                            <div className={`stat-value ${card.colorClass}`}>
                                {card.value.toLocaleString()}
                            </div>
                        )}
                        <div className="stat-desc">{card.desc}</div>
                    </div>
                ))}
            </div>

            {/* Two-column grid */}
            <div className="overview-grid">
                {/* Top Entities */}
                <div className="mem-card">
                    <div className="mem-card-header">
                        <div className="mem-card-title">
                            <div className="mem-card-icon icon-purple">⬡</div>
                            Top Entities
                        </div>
                    </div>
                    {topEntities.length === 0 ? (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <div className="empty-icon">◎</div>
                            <div className="empty-title">No entities yet</div>
                            <div className="empty-desc">Chat with the memory agent to build your knowledge graph</div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {topEntities.slice(0, 8).map((e: any, i: number) => (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "10px 14px",
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                        borderRadius: 10,
                                        transition: "all 0.2s",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: NODE_TYPE_COLORS[e.type] ?? "#888",
                                            flexShrink: 0,
                                            boxShadow: `0 0 8px ${NODE_TYPE_COLORS[e.type] ?? "#888"}`,
                                        }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>{e.label}</div>
                                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{e.type}</div>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            fontFamily: "JetBrains Mono, monospace",
                                            color: "rgba(255,255,255,0.3)",
                                        }}
                                    >
                                        ×{e.occurrences}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Node Type Distribution */}
                <div className="mem-card">
                    <div className="mem-card-header">
                        <div className="mem-card-title">
                            <div className="mem-card-icon icon-cyan">◈</div>
                            Entity Types
                        </div>
                    </div>
                    {Object.keys(nodesByType).length === 0 ? (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <div className="empty-icon">◈</div>
                            <div className="empty-title">No types yet</div>
                            <div className="empty-desc">Entity type distribution will appear here</div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {Object.entries(nodesByType)
                                .sort(([, a], [, b]) => b - a)
                                .map(([type, count]) => {
                                    const total = Object.values(nodesByType).reduce((a, b) => a + b, 0);
                                    const pct = Math.round((count / total) * 100);
                                    const color = NODE_TYPE_COLORS[type] ?? "#888";
                                    return (
                                        <div key={type}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{type}</span>
                                                <span style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.3)" }}>
                                                    {count} ({pct}%)
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    height: 4,
                                                    borderRadius: 2,
                                                    background: "rgba(255,255,255,0.06)",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        height: "100%",
                                                        width: `${pct}%`,
                                                        background: `linear-gradient(90deg, ${color}, ${color}88)`,
                                                        borderRadius: 2,
                                                        transition: "width 0.5s ease",
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Architecture diagram */}
                <div className="mem-card overview-full">
                    <div className="mem-card-header">
                        <div className="mem-card-title">
                            <div className="mem-card-icon icon-amber">⚡</div>
                            Memory Architecture (SOTA — CoALA + MemGPT + HippoRAG)
                        </div>
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: 16,
                        }}
                    >
                        {[
                            {
                                title: "Short-Term Memory",
                                icon: "◎",
                                color: "#a855f7",
                                desc: [
                                    "Sliding window (last 20 msgs)",
                                    "Overflow → LLM summarisation",
                                    "Working context injection",
                                    "Session-scoped & persistent",
                                ],
                                inspired: "MemGPT",
                            },
                            {
                                title: "Long-Term Memory",
                                icon: "◈",
                                color: "#06b6d4",
                                desc: [
                                    "Pinecone vector store",
                                    "Gemini semantic embeddings",
                                    "Namespace-isolated per user",
                                    "Confidence decay over time",
                                    "Access-count tracking",
                                ],
                                inspired: "HippoRAG",
                            },
                            {
                                title: "Knowledge Graph",
                                icon: "⬡",
                                color: "#f59e0b",
                                desc: [
                                    "JSON property graph on disk",
                                    "13 node types, 17 edge types",
                                    "LLM entity extraction",
                                    "Temporal decay (1%/day)",
                                    "Fuzzy entity search",
                                ],
                                inspired: "Microsoft GraphRAG",
                            },
                        ].map((layer) => (
                            <div
                                key={layer.title}
                                style={{
                                    padding: "20px",
                                    background: "rgba(255,255,255,0.02)",
                                    border: `1px solid ${layer.color}30`,
                                    borderRadius: 12,
                                    borderTop: `2px solid ${layer.color}`,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                    <span style={{ fontSize: 20, color: layer.color }}>{layer.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{layer.title}</div>
                                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                                            Inspired by {layer.inspired}
                                        </div>
                                    </div>
                                </div>
                                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                                    {layer.desc.map((d, i) => (
                                        <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                            <span style={{ color: layer.color, fontSize: 10, marginTop: 3, flexShrink: 0 }}>▸</span>
                                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{d}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
