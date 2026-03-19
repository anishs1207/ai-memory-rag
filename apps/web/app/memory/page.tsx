"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import MemoryGraphVisualization from "./components/MemoryGraphVisualization";
import ShortTermMemoryView from "./components/ShortTermMemoryView";
import LongTermMemorySearch from "./components/LongTermMemorySearch";
import MemoryChat from "./components/MemoryChat";
import MemoryStats from "./components/MemoryStats";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, Grid3x3, Network, MessageSquare, Search, History } from "lucide-react";
import { Loader } from "@/components/prompt-kit/loader";
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
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-6 space-y-6 max-w-[1400px] mx-auto w-full relative">
            {/* Header */}
            <header className="flex items-center justify-between border-b pb-4 sticky top-0 bg-background/80 backdrop-blur z-30 pt-2">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center ${pulseActive ? "animate-pulse ring-2 ring-primary/50" : ""}`}>
                        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
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
                        <h1 className="text-2xl font-bold tracking-tight">Paxio Memory</h1>
                        <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 ${!pulseActive && 'hidden'}`}></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            Cognitive Memory Framework · SOTA Architecture
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full border text-xs font-semibold">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">Active Session:</span>
                        <span>{userId}</span>
                    </div>
                    <Button 
                        onClick={refreshData} 
                        variant="default" 
                        size="sm" 
                        className="gap-2 shadow-sm"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader className="w-4 h-4 text-primary-foreground" size="sm" />
                        ) : (
                            <Activity className="w-4 h-4" />
                        )}
                        Refresh State
                    </Button>
                </div>
            </header>

            {/* Layout Body */}
            <div className="flex-1 w-full space-y-6">
                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as Tab)} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 h-12 mb-6 bg-muted/50 p-1 rounded-xl shadow-inner border">
                        <TabsTrigger value="overview" className="gap-2 text-xs md:text-sm rounded-lg data-[state=active]:shadow-sm">
                            <Grid3x3 className="h-4 w-4" />
                            <span className="hidden md:inline">Overview</span>
                        </TabsTrigger>
                        <TabsTrigger value="graph" className="gap-2 text-xs md:text-sm rounded-lg data-[state=active]:shadow-sm">
                            <Network className="h-4 w-4" />
                            <span className="hidden md:inline">Knowledge Graph</span>
                        </TabsTrigger>
                        <TabsTrigger value="chat" className="gap-2 text-xs md:text-sm rounded-lg data-[state=active]:shadow-sm">
                            <MessageSquare className="h-4 w-4" />
                            <span className="hidden md:inline">Memory Chat</span>
                        </TabsTrigger>
                        <TabsTrigger value="long-term" className="gap-2 text-xs md:text-sm rounded-lg data-[state=active]:shadow-sm">
                            <Search className="h-4 w-4" />
                            <span className="hidden md:inline">Long-Term Search</span>
                        </TabsTrigger>
                        <TabsTrigger value="sessions" className="gap-2 text-xs md:text-sm rounded-lg data-[state=active]:shadow-sm">
                            <History className="h-4 w-4" />
                            <span className="hidden md:inline">Short-Term Context</span>
                        </TabsTrigger>
                    </TabsList>

                    <div className="min-h-[600px] border bg-card text-card-foreground rounded-xl shadow-sm overflow-hidden flex flex-col relative">
                        {isLoading && activeTab !== 'chat' && (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm">
                                <Loader variant="dots" size="lg" />
                                <p className="mt-4 text-sm font-semibold text-muted-foreground uppercase tracking-widest animate-pulse">Synchronizing Neural State</p>
                            </div>
                        )}
                        
                        <TabsContent value="overview" className="flex-1 m-0">
                            <MemoryStats stats={stats} isLoading={isLoading} graphData={graphData} />
                        </TabsContent>
                        
                        <TabsContent value="graph" className="flex-1 m-0">
                            <MemoryGraphVisualization
                                userId={userId}
                                apiBase={API_BASE}
                                graphData={graphData}
                                onRefresh={refreshData}
                            />
                        </TabsContent>
                        
                        <TabsContent value="chat" className="flex-1 m-0 h-full flex flex-col">
                            {sessionId ? (
                                <MemoryChat
                                    userId={userId}
                                    sessionId={sessionId}
                                    apiBase={API_BASE}
                                    onMemoryUpdate={refreshData}
                                />
                            ) : (
                                <div className="flex-1 flex items-center justify-center">
                                    <Loader variant="pulse" />
                                </div>
                            )}
                        </TabsContent>
                        
                        <TabsContent value="long-term" className="flex-1 m-0">
                            <LongTermMemorySearch userId={userId} apiBase={API_BASE} />
                        </TabsContent>
                        
                        <TabsContent value="sessions" className="flex-1 m-0">
                            <ShortTermMemoryView userId={userId} sessionId={sessionId} apiBase={API_BASE} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}