"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import MemoryGraphVisualization from "./components/MemoryGraphVisualization";
import ShortTermMemoryView from "./components/ShortTermMemoryView";
import LongTermMemorySearch from "./components/LongTermMemorySearch";
import MemoryChat from "./components/MemoryChat";
import MemoryStats from "./components/MemoryStats";
import "./memory.css";

type Tab = "overview" | "graph" | "chat" | "long-term" | "sessions";

export default function MemoryPage() {
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [userId] = useState("demo-user"); // In production, pull from auth
    const [sessionId, setSessionId] = useState<string>("");
    const [stats, setStats] = useState<any>(null);
    const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [pulseActive, setPulseActive] = useState(false);

    const API_BASE = "http://localhost:3001/api/v1/memory";

    // Create or restore session
    useEffect(() => {
        const stored = localStorage.getItem("memory_session_id");
        if (stored) {
            setSessionId(stored);
        } else {
            fetch(`${API_BASE}/session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, systemPrompt: "You are a helpful memory-powered assistant." }),
            })
                .then((r) => r.json())
                .then((d) => {
                    if (d.success) {
                        setSessionId(d.data.sessionId);
                        localStorage.setItem("memory_session_id", d.data.sessionId);
                    }
                })
                .catch(() => { });
        }
    }, [userId]);

    // Load stats + graph
    const refreshData = useCallback(async () => {
        setIsLoading(true);
        setPulseActive(true);
        try {
            const [statsRes, graphRes] = await Promise.all([
                fetch(`${API_BASE}/stats/${userId}`).then((r) => r.json()),
                fetch(`${API_BASE}/kg/${userId}/graph`).then((r) => r.json()),
            ]);
            if (statsRes.success) setStats(statsRes.data);
            if (graphRes.success) setGraphData(graphRes.data);
        } catch { }
        setIsLoading(false);
        setTimeout(() => setPulseActive(false), 1000);
    }, [userId]);

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const tabs: { id: Tab; label: string; icon: string; desc: string }[] = [
        { id: "overview", label: "Overview", icon: "◎", desc: "Memory dashboard" },
        { id: "graph", label: "Knowledge Graph", icon: "⬡", desc: "Entity relationships" },
        { id: "chat", label: "Memory Chat", icon: "⚡", desc: "Talk with memory" },
        { id: "long-term", label: "Long-Term", icon: "◈", desc: "RAG semantic search" },
        { id: "sessions", label: "Sessions", icon: "⊞", desc: "Short-term memory" },
    ];

    return (
        <div className="memory-root">
            {/* Ambient background */}
            <div className="memory-bg">
                <div className="memory-bg-orb orb-1" />
                <div className="memory-bg-orb orb-2" />
                <div className="memory-bg-orb orb-3" />
                <div className="memory-bg-grid" />
            </div>

            <div className="memory-container">
                {/* Header */}
                <header className="memory-header">
                    <div className="memory-header-left">
                        <div className={`memory-logo ${pulseActive ? "pulse" : ""}`}>
                            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="20" cy="20" r="18" stroke="url(#grad)" strokeWidth="2" />
                                <circle cx="20" cy="12" r="4" fill="url(#grad)" opacity="0.9" />
                                <circle cx="12" cy="26" r="4" fill="url(#grad2)" opacity="0.9" />
                                <circle cx="28" cy="26" r="4" fill="url(#grad3)" opacity="0.9" />
                                <line x1="20" y1="16" x2="12" y2="22" stroke="url(#grad)" strokeWidth="1.5" opacity="0.6" />
                                <line x1="20" y1="16" x2="28" y2="22" stroke="url(#grad)" strokeWidth="1.5" opacity="0.6" />
                                <line x1="16" y1="26" x2="24" y2="26" stroke="url(#grad2)" strokeWidth="1.5" opacity="0.4" />
                                <defs>
                                    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#a855f7" />
                                        <stop offset="100%" stopColor="#6366f1" />
                                    </linearGradient>
                                    <linearGradient id="grad2" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#06b6d4" />
                                        <stop offset="100%" stopColor="#3b82f6" />
                                    </linearGradient>
                                    <linearGradient id="grad3" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" />
                                        <stop offset="100%" stopColor="#ef4444" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <div>
                            <h1 className="memory-title">Paxio Memory</h1>
                            <p className="memory-subtitle">Cognitive Memory Framework · SOTA Architecture</p>
                        </div>
                    </div>
                    <div className="memory-header-right">
                        <div className="memory-status">
                            <span className="status-dot" />
                            <span>Active · {userId}</span>
                        </div>
                        <button className="memory-refresh-btn" onClick={refreshData}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 4v6h6M23 20v-6h-6" />
                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </header>

                {/* Tab Navigation */}
                <nav className="memory-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`memory-tab ${activeTab === tab.id ? "active" : ""}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="tab-icon">{tab.icon}</span>
                            <span className="tab-label">{tab.label}</span>
                            <span className="tab-desc">{tab.desc}</span>
                        </button>
                    ))}
                </nav>

                {/* Content */}
                <main className="memory-main">
                    {activeTab === "overview" && (
                        <MemoryStats stats={stats} isLoading={isLoading} graphData={graphData} />
                    )}
                    {activeTab === "graph" && (
                        <MemoryGraphVisualization
                            userId={userId}
                            apiBase={API_BASE}
                            graphData={graphData}
                            onRefresh={refreshData}
                        />
                    )}
                    {activeTab === "chat" && sessionId && (
                        <MemoryChat
                            userId={userId}
                            sessionId={sessionId}
                            apiBase={API_BASE}
                            onMemoryUpdate={refreshData}
                        />
                    )}
                    {activeTab === "long-term" && (
                        <LongTermMemorySearch userId={userId} apiBase={API_BASE} />
                    )}
                    {activeTab === "sessions" && (
                        <ShortTermMemoryView userId={userId} sessionId={sessionId} apiBase={API_BASE} />
                    )}
                </main>
            </div>
        </div>
    );
}