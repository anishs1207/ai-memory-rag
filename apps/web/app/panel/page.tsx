"use client";

import { useEffect, useState, useRef } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
    Users,
    Vote,
    ShieldAlert,
    Crown,
    History,
    Terminal,
    ChevronRight,
    RefreshCw,
    Target,
    FlaskConical,
    TrendingUp,
    AlertCircle,
} from "lucide-react";
import axios from "axios";

type Persona = {
    id: number;
    name: string;
    background: string;
    ideology: string;
    speech: string;
    traits: string[];
    hiddenGoal: string;
    votes?: number;
};

type Phase =
    | "setup"
    | "campaign"
    | "council"
    | "leader"
    | "crisis";

const API_BASE = "http://localhost:3001/api/v1/panel";

export default function Page() {
    const [phase, setPhase] = useState<Phase>("setup");
    const [numPersonas, setNumPersonas] = useState(12);
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [topFive, setTopFive] = useState<Persona[]>([]);
    const [leader, setLeader] = useState<Persona | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userTopic, setUserTopic] = useState("");

    // Crisis Data
    const [crisis, setCrisis] = useState<any>(null);
    const [actionVotes, setActionVotes] = useState<any[]>([]);
    const [finalAction, setFinalAction] = useState<any>(null);
    const [outcome, setOutcome] = useState<any>(null);

    const [approval, setApproval] = useState(75);
    const [logs, setLogs] = useState<{ msg: string; type: "info" | "success" | "warning" | "error" }[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const addLog = (msg: string, type: "info" | "success" | "warning" | "error" = "info") => {
        setLogs((prev) => [...prev, { msg, type }]);
    };

    async function generatePersonas() {
        setLoading(true);
        setError(null);
        setLogs([]);
        addLog(`Initializing simulation with ${numPersonas} agents...`, "info");
        try {
            const resp = await axios.post<{ agents: Persona[] }>(`${API_BASE}/generate-personas`, {
                count: numPersonas,
            });
            setPersonas(resp.data.agents);
            addLog("Personas generated successfully. Campaigns started.", "success");
            setPhase("campaign");
        } catch (err: any) {
            setError(err.message || "Failed to generate agents");
            addLog("Initialization failed.", "error");
        } finally {
            setLoading(false);
        }
    }

    async function conductVoting() {
        setLoading(true);
        setError(null);
        addLog("Primary election cycle initiated. Agents are casting votes...", "info");
        try {
            const resp = await axios.post<{ topLeadersWithDetails: Persona[]; enrichedVotes: any[] }>(
                `${API_BASE}/conduct-election`,
                { agents: personas }
            );
            setTopFive(resp.data.topLeadersWithDetails);
            addLog("Election completed. Council formed.", "success");
            resp.data.enrichedVotes.slice(0, 3).forEach(v => {
                addLog(`${v.voter.name} voted for ${v.votedFor.name}: "${v.reason.slice(0, 40)}..."`, "info");
            });
            setPhase("council");
        } catch (err: any) {
            setError(err.message || "Election failed");
            addLog("Election protocol error.", "error");
        } finally {
            setLoading(false);
        }
    }

    function chooseLeader() {
        addLog("Council is deliberating on a Supreme Leader...", "info");
        const chosen = topFive[Math.floor(Math.random() * topFive.length)];
        setLeader(chosen || null);
        addLog(`${chosen?.name} has been elected as the Supreme Leader.`, "success");
        setPhase("leader");
    }

    async function triggerCrisis() {
        setLoading(true);
        setError(null);
        addLog(`Simulating crisis based on theme: ${userTopic || "Universal Governance"}...`, "warning");
        try {
            const resp = await axios.post(`${API_BASE}/take-action`, {
                agents: personas,
                top5Panel: topFive,
                chosenLeader: leader,
                userTopic,
            });
            const { issue, actionVotes, finalAction, outcome } = resp.data;
            setCrisis(issue);
            setActionVotes(actionVotes);
            setFinalAction(finalAction);
            setOutcome(outcome);

            addLog(`MAJOR CRISIS: ${issue.issue.slice(0, 50)}...`, "error");
            addLog(`Council majority chose: ${finalAction.label}`, "success");
            setApproval(prev => Math.min(100, Math.max(0, prev + outcome.approvalChange)));
            setPhase("crisis");
        } catch (err: any) {
            setError(err.message || "Crisis simulation failed");
            addLog("Simulation engine failure.", "error");
        } finally {
            setLoading(false);
        }
    }

    function reset() {
        setPhase("setup");
        setPersonas([]);
        setTopFive([]);
        setLeader(null);
        setLogs([]);
        setApproval(75);
        setCrisis(null);
        setError(null);
    }

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-slate-100 font-sans selection:bg-primary/30">
            {/* Background Glow */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-indigo-500/10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-xl">
                                <FlaskConical className="w-8 h-8 text-indigo-400" />
                            </div>
                            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                                Aether Panel <span className="text-sm font-normal text-indigo-400/80 px-2 py-1 bg-indigo-400/10 rounded-lg border border-indigo-400/20 ml-2">v2.0 Beta</span>
                            </h1>
                        </div>
                        <p className="text-slate-400 max-w-xl text-lg">
                            Deployment of autonomous AI agents into a high-fidelity socio-political simulation.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-xl">
                        <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Aggregate Approval</p>
                            <p className="text-3xl font-black text-white">{approval}%</p>
                        </div>
                        <div className="w-32">
                            <Progress value={approval} className="h-2 bg-slate-800" />
                        </div>
                    </div>
                </header>

                {error && (
                    <Alert variant="destructive" className="bg-red-950/20 border-red-500/50 text-red-200 animate-in fade-in slide-in-from-top-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>System Alert</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
                    {/* Main Workspace */}
                    <div className="xl:col-span-3 space-y-8">
                        {phase === "setup" && (
                            <div className="flex flex-col items-center justify-center min-h-[500px] space-y-8 animate-in zoom-in-95 duration-500">
                                <div className="text-center space-y-4 max-w-lg">
                                    <h2 className="text-5xl font-black">Initialize Entity Matrix</h2>
                                    <p className="text-slate-400">Specify the number of autonomous agents to inject into the local simulation environment.</p>
                                </div>
                                <div className="flex items-center gap-4 w-full max-w-sm">
                                    <Input
                                        type="number"
                                        min={4}
                                        max={50}
                                        value={numPersonas}
                                        className="h-14 bg-slate-900/80 border-white/10 text-xl font-bold rounded-2xl focus:ring-indigo-500 focus:border-indigo-500"
                                        onChange={(e) => setNumPersonas(Number(e.target.value))}
                                    />
                                    <Button
                                        disabled={loading}
                                        onClick={generatePersonas}
                                        className="h-14 px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
                                    >
                                        {loading ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <ChevronRight className="mr-2 h-5 w-5" />}
                                        {loading ? "Injecting..." : "Launch Matrix"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {phase !== "setup" && (
                            <div className="space-y-8 animate-in fade-in duration-700">
                                {/* Visual Phase Indicator */}
                                <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2 scrollbar-none">
                                    {[
                                        { id: "campaign", icon: Users, label: "Campaign" },
                                        { id: "council", icon: Target, label: "Council" },
                                        { id: "leader", icon: Crown, label: "Governance" },
                                        { id: "crisis", icon: ShieldAlert, label: "Crisis" }
                                    ].map((p, i) => (
                                        <div key={p.id} className="flex items-center gap-3">
                                            <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${phase === p.id
                                                    ? "bg-indigo-500/20 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10 scale-105"
                                                    : "bg-slate-900/50 border-white/5 text-slate-500"
                                                }`}>
                                                <p.icon className="w-5 h-5" />
                                                <span className="font-bold text-sm whitespace-nowrap">{p.label}</span>
                                            </div>
                                            {i < 3 && <ChevronRight className="w-4 h-4 text-slate-700" />}
                                        </div>
                                    ))}
                                </div>

                                <Separator className="bg-white/5" />

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {(phase === "campaign" ? personas : topFive).map((p) => (
                                        <Card key={p.id} className={`group relative bg-slate-900/40 border-white/5 backdrop-blur-xl hover:border-indigo-500/30 transition-all duration-300 overflow-hidden ${leader?.id === p.id ? "ring-2 ring-indigo-500 border-indigo-500 ring-offset-4 ring-offset-[#0a0a0c]" : ""}`}>
                                            <CardHeader className="p-5 pb-2">
                                                <div className="flex justify-between items-start">
                                                    <CardTitle className="text-xl font-bold group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{p.name}</CardTitle>
                                                    {p.votes !== undefined && (
                                                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-400/20">{p.votes} Votes</Badge>
                                                    )}
                                                </div>
                                                <CardDescription className="text-xs font-semibold text-indigo-400/80 uppercase tracking-widest">{p.ideology}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="p-5 pt-2 space-y-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {p.traits.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold uppercase tracking-wider">{t}</span>)}
                                                </div>
                                                <p className="text-sm text-slate-400 leading-relaxed italic border-l-2 border-indigo-500/30 pl-3">"{p.speech}"</p>
                                                <div className="pt-2">
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-tighter">Background</p>
                                                    <p className="text-xs text-slate-300 line-clamp-2">{p.background}</p>
                                                </div>
                                            </CardContent>
                                            {leader?.id === p.id && (
                                                <div className="absolute top-[-20px] right-[-20px] w-16 h-16 bg-indigo-500/20 blur-xl rounded-full" />
                                            )}
                                        </Card>
                                    ))}
                                </div>

                                {/* Simulation Content area */}
                                {phase === "crisis" && crisis && (
                                    <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                                        <Card className="bg-indigo-600/10 border-indigo-500/50 border-2 overflow-hidden">
                                            <CardHeader className="bg-indigo-500/20 p-6">
                                                <div className="flex items-center gap-3">
                                                    <ShieldAlert className="w-8 h-8 text-indigo-400" />
                                                    <div>
                                                        <CardTitle className="text-2xl font-black uppercase text-white">Emergency Council Session</CardTitle>
                                                        <CardDescription className="text-indigo-300 font-bold tracking-widest uppercase text-xs">A crisis has emerged demanding immediate action</CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-8 space-y-8">
                                                <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
                                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Terminal className="w-5 h-5 text-indigo-400" /> Situation Report</h3>
                                                    <p className="text-lg text-slate-200 leading-relaxed">{crisis.issue}</p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {crisis.actions.map((a: any) => (
                                                        <div key={a.id} className={`p-5 rounded-2xl border transition-all ${a.id === finalAction.id ? "bg-indigo-600/20 border-indigo-500 text-white" : "bg-slate-900 border-white/5 opacity-60"}`}>
                                                            <h4 className="font-bold mb-1 uppercase tracking-tight">{a.label}</h4>
                                                            <p className="text-xs text-slate-400">{a.description}</p>
                                                            {a.id === finalAction.id && <Badge className="mt-3 bg-indigo-500 font-black">ENACTED</Badge>}
                                                        </div>
                                                    ))}
                                                </div>

                                                <Separator className="bg-white/10" />

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-4">
                                                        <h3 className="text-sm font-black uppercase text-indigo-400 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Resulting Outcome</h3>
                                                        <p className="text-xl font-bold text-white">{outcome.outcome}</p>
                                                        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                                                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Unforeseen Consequence</p>
                                                            <p className="text-sm text-red-200">{outcome.consequence}</p>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <h3 className="text-sm font-black uppercase text-indigo-400 flex items-center gap-2"><Vote className="w-4 h-4" /> Council Votes</h3>
                                                        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-indigo-500/50">
                                                            {actionVotes.map((v: any, i: number) => {
                                                                const agent = topFive.find(a => a.id === v.candidateId);
                                                                return (
                                                                    <div key={i} className="text-xs p-3 bg-slate-800/50 rounded-lg border border-white/5">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <span className="font-bold text-slate-200">{agent?.name}</span>
                                                                            <Badge variant="outline" className="text-[8px] h-4 uppercase">{v.actionId === "A" ? "Logic" : v.actionId === "B" ? "Compassion" : "Power"}</Badge>
                                                                        </div>
                                                                        <p className="text-slate-400 italic">"{v.reason}"</p>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar / Console */}
                    <div className="space-y-6">
                        <Card className="bg-slate-900/60 border-white/5 backdrop-blur-3xl overflow-hidden sticky top-8">
                            <CardHeader className="bg-black/20 p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Terminal className="w-4 h-4 text-indigo-400" />
                                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-300">Simulation Feed</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 text-[8px] animate-pulse">ACTIVE</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div
                                    ref={scrollRef}
                                    className="h-[400px] overflow-y-auto p-4 space-y-3 font-mono text-[11px] leading-snug bg-black/40"
                                >
                                    {logs.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 opacity-50">
                                            <Terminal className="w-8 h-8" />
                                            <p>Awaiting initialization...</p>
                                        </div>
                                    ) : (
                                        logs.map((log, i) => (
                                            <div key={i} className={`flex gap-3 animate-in slide-in-from-right-2 duration-300 ${log.type === "success" ? "text-green-400" :
                                                    log.type === "warning" ? "text-yellow-400" :
                                                        log.type === "error" ? "text-red-400" : "text-blue-300"
                                                }`}>
                                                <span className="text-slate-700 font-bold">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                                <span>{log.msg}</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-5 p-4 space-y-4 bg-slate-950/50">
                                    {phase !== "setup" && (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                {phase === "campaign" && (
                                                    <Button onClick={conductVoting} disabled={loading} className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-black h-10 shadow-lg shadow-indigo-600/20">
                                                        {loading ? "PROCESSING..." : "CONDUCT ELECTION"}
                                                    </Button>
                                                )}
                                                {phase === "council" && (
                                                    <Button onClick={chooseLeader} className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-black h-10">
                                                        CHOOSE SUPREME LEADER
                                                    </Button>
                                                )}
                                                {(phase === "leader" || phase === "crisis") && (
                                                    <div className="col-span-2 space-y-2">
                                                        <Input
                                                            placeholder="Scenario Theme (e.g. Energy Crisis)"
                                                            value={userTopic}
                                                            onChange={(e) => setUserTopic(e.target.value)}
                                                            className="bg-black/50 border-white/10 h-10 text-xs"
                                                        />
                                                        <Button onClick={triggerCrisis} disabled={loading} className="w-full bg-red-600 hover:bg-red-500 text-xs font-black h-10 shadow-lg shadow-red-600/20">
                                                            {loading ? "CALCULATING..." : "SIMULATE CRISIS"}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            <Button variant="outline" onClick={reset} className="w-full border-white/5 hover:bg-white/5 text-[10px] uppercase font-bold text-slate-500 h-8">
                                                Hard Reset System
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="p-6 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl flex items-center gap-4">
                            <History className="w-10 h-10 text-indigo-400/50" />
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Protocol Memory</p>
                                <p className="text-xs text-slate-400">All agent behaviors and decisions are indexed for socio-logic refinement.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Global CSS for hiding scrollbars */}
            <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { border-radius: 10px; }
      `}</style>
        </div>
    );
}
