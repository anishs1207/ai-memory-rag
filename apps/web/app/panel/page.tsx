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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    BrainCircuit,
    Cpu,
    Zap,
} from "lucide-react";
import {
    Steps,
    StepsItem,
    StepsTrigger,
    StepsContent,
} from "@/components/prompt-kit/steps";
import { ThinkingBar } from "@/components/prompt-kit/thinking-bar";
import { Loader } from "@/components/prompt-kit/loader";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

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

type Phase = "setup" | "campaign" | "council" | "leader" | "crisis";

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
    const [logs, setLogs] = useState<{ msg: string; type: "info" | "success" | "warning" | "error"; details?: string }[]>(
        []
    );

    const addLog = (msg: string, type: "info" | "success" | "warning" | "error" = "info", details?: string) => {
        setLogs((prev) => [...prev, { msg, type, details }]);
    };

    async function generatePersonas() {
        setLoading(true);
        setError(null);
        setLogs([]);
        addLog("Initializing Neural Matrix", "info", `Deploying ${numPersonas} autonomous agent containers...`);
        try {
            const resp = await axios.post<{ agents: Persona[] }>(`${API_BASE}/generate-personas`, {
                count: numPersonas,
            });
            setPersonas(resp.data.agents);
            addLog("Injection Successful", "success", "All persona profiles synthesized and synchronized.");
            setPhase("campaign");
        } catch (err: any) {
            setError(err.message || "Failed to generate agents");
            addLog("Matrix Failure", "error", "Fatal error during agent instantiation.");
        } finally {
            setLoading(false);
        }
    }

    async function conductVoting() {
        setLoading(true);
        setError(null);
        addLog("Election Algorithm Started", "warning", "Agents are evaluating candidate speeches and background alignments...");
        try {
            const resp = await axios.post<{
                topLeadersWithDetails: Persona[];
                enrichedVotes: any[];
            }>(`${API_BASE}/conduct-election`, { agents: personas });
            setTopFive(resp.data.topLeadersWithDetails);
            addLog("Council Formed", "success", `Top 5 candidates selected after ${personas.length} casted votes.`);
            setPhase("council");
        } catch (err: any) {
            setError(err.message || "Election failed");
            addLog("Logic Error", "error", "Simulation crashed during vote tallying.");
        } finally {
            setLoading(false);
        }
    }

    function chooseLeader() {
        addLog("Executive Protocol Initiation", "info", "Council members are voting on an ultimate decision-maker.");
        const chosen = topFive[Math.floor(Math.random() * topFive.length)];
        setLeader(chosen || null);
        addLog(`Supreme Leader Elected`, "success", `Authority handed over to ${chosen?.name}.`);
        setPhase("leader");
    }

    async function triggerCrisis() {
        setLoading(true);
        setError(null);
        addLog(`Simulating Crisis: ${userTopic || "General"}`, "warning", "Injecting external instability factors into the matrix...");
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

            addLog(`Critical Anomaly Detected`, "error", issue.issue.slice(0, 100) + "...");
            addLog(`Response Executed`, "success", `Council enacted: ${finalAction.label}. Approval rating adjusted.`);
            setApproval((prev) => Math.min(100, Math.max(0, prev + outcome.approvalChange)));
            setPhase("crisis");
        } catch (err: any) {
            setError(err.message || "Crisis simulation failed");
            addLog("Simulation Crash", "error", "Could not process crisis mechanics.");
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
        <div className="min-h-screen bg-[#050507] text-slate-100 font-sans selection:bg-indigo-500/30">
            {/* Dynamic Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/5 blur-[160px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[160px] rounded-full" />
            </div>

            <main className="relative z-10 max-w-[1600px] mx-auto p-4 md:p-10 space-y-10">
                {/* Superior Header */}
                <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 pb-10 border-b border-white/5">
                    <div className="space-y-4">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-4"
                        >
                            <div className="p-3 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 shadow-2xl shadow-indigo-500/10">
                                <BrainCircuit className="w-10 h-10 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent italic">
                                    AETHER MATRIX
                                </h1>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-indigo-500/5 border-indigo-500/20 text-indigo-400 text-[10px] uppercase font-black">Agentic Evolution Engine</Badge>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20">
                                        <div className="size-1.5 bg-green-400 rounded-full animate-pulse" />
                                        <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Core Synchronized</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-6 bg-slate-900/40 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-3xl shadow-2xl"
                    >
                        <div className="text-right space-y-1">
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">System Stability</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-white tabular-nums">{approval}%</span>
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                        </div>
                        <div className="w-48 space-y-2">
                            <Progress value={approval} className="h-3 bg-indigo-950/20" />
                            <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase">
                                <span>Critical</span>
                                <span>Optimum</span>
                            </div>
                        </div>
                    </motion.div>
                </header>

                {error && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                        <Alert variant="destructive" className="bg-red-950/20 border-red-500/40 text-red-200 rounded-3xl p-6">
                            <AlertCircle className="h-6 w-6" />
                            <div className="ml-4">
                                <AlertTitle className="text-lg font-bold">System Runtime Error</AlertTitle>
                                <AlertDescription className="text-red-300/80">{error}</AlertDescription>
                            </div>
                        </Alert>
                    </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Main Simulation Area */}
                    <div className="lg:col-span-8 space-y-10">
                        {phase === "setup" ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center min-h-[600px] text-center"
                            >
                                <div className="relative group mb-12">
                                    <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] group-hover:bg-indigo-500/40 transition-all rounded-full" />
                                    <Cpu className="w-32 h-32 text-indigo-500 relative z-10 animate-bounce duration-[3000ms]" />
                                </div>
                                <h2 className="text-6xl font-black tracking-tighter mb-4 italic">GENESIS PROTOCOL</h2>
                                <p className="text-slate-400 max-w-md text-lg mb-12">Allocate recursive cognitive units into the simulation vacuum. Max capacity is limited to 50 concurrent agents.</p>

                                <div className="flex flex-col md:flex-row items-center gap-6 w-full max-w-xl p-8 bg-white/[0.02] border border-white/5 rounded-[3rem] backdrop-blur-md">
                                    <div className="flex-1 w-full space-y-2">
                                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block ml-4">Unit Count</label>
                                        <Input
                                            type="number"
                                            min={4}
                                            max={50}
                                            value={numPersonas}
                                            className="h-16 bg-black/60 border-white/10 text-3xl font-black rounded-[2rem] text-center focus:ring-4 focus:ring-indigo-500/20 transition-all"
                                            onChange={(e) => setNumPersonas(Number(e.target.value))}
                                        />
                                    </div>
                                    <Button
                                        disabled={loading}
                                        onClick={generatePersonas}
                                        className="h-20 px-12 bg-white text-black hover:bg-slate-200 rounded-[2rem] font-black text-xl shadow-2xl transition-all hover:scale-105 active:scale-95 group"
                                    >
                                        {loading ? <Loader variant="dots" className="text-black" /> : (
                                            <>
                                                INITIALIZE <Zap className="ml-3 w-6 h-6 fill-black group-hover:scale-125 transition-transform" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={phase}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-10"
                                >
                                    {/* Phase Control Header */}
                                    <div className="flex items-center justify-between gap-4 p-2 bg-white/[0.02] border border-white/5 rounded-full overflow-hidden">
                                        <div className="flex items-center gap-2 pl-4">
                                            <div className="size-2 bg-indigo-500 rounded-full animate-ping" />
                                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Phase: {phase}</span>
                                        </div>

                                        {loading && (
                                            <div className="px-6 flex items-center gap-4">
                                                <ThinkingBar text="Processing LLM Neural Pathways..." className="w-64" />
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            {phase === "campaign" && (
                                                <Button onClick={conductVoting} disabled={loading} className="rounded-full px-8 bg-indigo-600 hover:bg-indigo-500 text-xs font-black h-12 shadow-xl shadow-indigo-600/20">
                                                    {loading ? <Loader size="sm" /> : "PROCEED TO ELECTION"}
                                                </Button>
                                            )}
                                            {phase === "council" && (
                                                <Button onClick={chooseLeader} className="rounded-full px-8 bg-white text-black hover:bg-slate-200 text-xs font-black h-12 transition-all hover:scale-105">
                                                    ELECT SUPREME LEADER
                                                </Button>
                                            )}
                                            {(phase === "leader" || phase === "crisis") && (
                                                <div className="flex items-center gap-2 bg-black/40 pr-1 pl-6 rounded-full border border-white/5">
                                                    <Input
                                                        placeholder="Inject Theme (e.g. AI Uprising)"
                                                        value={userTopic}
                                                        onChange={(e) => setUserTopic(e.target.value)}
                                                        className="bg-transparent border-none h-10 text-xs w-48 focus-visible:ring-0 px-0"
                                                    />
                                                    <Button onClick={triggerCrisis} disabled={loading} className="rounded-full bg-red-600 hover:bg-red-500 text-xs font-black h-10 px-6">
                                                        {loading ? "PROCESSING..." : "TRIGGER CRISIS"}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <Tabs defaultValue="grid" className="w-full">
                                        <TabsList className="bg-white/5 border border-white/5 rounded-2xl p-1 mb-6">
                                            <TabsTrigger value="grid" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-black">Grid View</TabsTrigger>
                                            <TabsTrigger value="inspect" className="rounded-xl font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-black">Statistical Analysis</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="grid">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {(phase === "campaign" ? personas : topFive).map((p, idx) => (
                                                    <motion.div
                                                        key={p.id}
                                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.05 }}
                                                    >
                                                        <Card className={`group relative h-full bg-slate-900/20 border-white/5 backdrop-blur-xl hover:border-indigo-500/40 hover:bg-indigo-500/[0.02] transition-all duration-500 rounded-[2rem] overflow-hidden ${leader?.id === p.id ? "ring-2 ring-indigo-500 border-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.2)]" : ""}`}>
                                                            <CardHeader className="p-7">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="p-2.5 bg-white/5 rounded-xl">
                                                                        <Users className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                                                                    </div>
                                                                    {p.votes !== undefined && (
                                                                        <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full">
                                                                            <span className="text-[10px] font-black text-indigo-400 uppercase">{p.votes} Influences</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <CardTitle className="text-2xl font-black tracking-tight uppercase group-hover:translate-x-1 transition-transform">{p.name}</CardTitle>
                                                                <div className="flex items-center gap-2 pt-1">
                                                                    <div className="size-1.5 bg-indigo-500 rounded-full" />
                                                                    <span className="text-[10px] font-black text-indigo-400/80 uppercase tracking-[0.2em]">{p.ideology}</span>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="p-7 pt-0 space-y-6">
                                                                <p className="text-sm text-slate-300 leading-relaxed font-medium bg-white/[0.03] p-4 rounded-2xl italic border-l-4 border-indigo-500/50">
                                                                    <TextShimmer spread={10}>"{p.speech}"</TextShimmer>
                                                                </p>

                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {p.traits.map(t => (
                                                                        <div key={t} className="px-2 py-1.5 bg-white/5 rounded-lg border border-white/5 text-center">
                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate block">{t}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                <Separator className="bg-white/5" />

                                                                <div>
                                                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2">Cognitive Background</span>
                                                                    <p className="text-xs text-slate-400 leading-relaxed font-medium line-clamp-3">{p.background}</p>
                                                                </div>
                                                            </CardContent>
                                                            {leader?.id === p.id && (
                                                                <Crown className="absolute top-2 right-2 w-12 h-12 text-indigo-500/20 rotate-12" />
                                                            )}
                                                        </Card>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="inspect">
                                            <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-10">
                                                <h3 className="text-3xl font-black mb-8 italic uppercase text-slate-400 tracking-tighter">Synchronized Unit Analysis</h3>
                                                <div className="space-y-4">
                                                    {personas.map(p => (
                                                        <div key={p.id} className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-indigo-500/20 transition-all">
                                                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                                                <Terminal className="w-4 h-4 text-indigo-400" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="text-xs font-black text-white">{p.name}</span>
                                                                <p className="text-[10px] text-slate-500 uppercase font-black">{p.ideology}</p>
                                                            </div>
                                                            <div className="px-4 py-2 bg-white/5 rounded-xl min-w-[300px]">
                                                                <span className="text-[9px] font-black text-indigo-300 uppercase block mb-1">Inherent Bias / Hidden Goal</span>
                                                                <p className="text-[10px] text-slate-400 italic line-clamp-1">{p.hiddenGoal}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>

                                    {/* Crisis Visualization */}
                                    {phase === "crisis" && crisis && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 40 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-8"
                                        >
                                            <Card className="bg-red-500/[0.02] border-red-500/30 border-2 rounded-[3.5rem] overflow-hidden shadow-2xl shadow-red-500/5 backdrop-blur-3xl">
                                                <div className="grid grid-cols-1 xl:grid-cols-12">
                                                    <div className="xl:col-span-5 bg-red-500/[0.05] p-10 border-r border-red-500/20 flex flex-col justify-center">
                                                        <div className="flex items-center gap-4 mb-6">
                                                            <div className="p-4 bg-red-500/10 rounded-3xl animate-pulse">
                                                                <ShieldAlert className="w-12 h-12 text-red-500" />
                                                            </div>
                                                            <div>
                                                                <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase">ANOMALY DETECTED</h3>
                                                                <p className="text-red-400 font-black uppercase text-xs tracking-widest">Level 5 Systemic Breach</p>
                                                            </div>
                                                        </div>
                                                        <div className="bg-black/60 p-8 rounded-3xl border border-red-500/20 space-y-4">
                                                            <h4 className="text-sm font-black text-red-400 flex items-center gap-2 uppercase tracking-widest"><Terminal className="w-4 h-4" /> Situation Report</h4>
                                                            <p className="text-xl font-bold text-slate-200 leading-normal">{crisis.issue}</p>
                                                        </div>
                                                    </div>

                                                    <div className="xl:col-span-7 p-10 space-y-10">
                                                        <div className="space-y-4">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Simulation Branches</span>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                {crisis.actions.map((a: any) => (
                                                                    <div key={a.id} className={`p-6 rounded-[2rem] border transition-all relative ${a.id === finalAction.id ? "bg-white text-black border-white shadow-2xl scale-105 z-10" : "bg-black/40 border-white/5 opacity-40 grayscale"}`}>
                                                                        <h4 className="font-black mb-2 uppercase text-xs tracking-tighter">{a.label}</h4>
                                                                        <p className={`text-[10px] leading-relaxed ${a.id === finalAction.id ? "text-black/80 font-bold" : "text-slate-500"}`}>{a.description}</p>
                                                                        {a.id === finalAction.id && (
                                                                            <Badge className="absolute -top-3 -right-2 bg-indigo-600 font-black ring-4 ring-[#050507]">ENACTED</Badge>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                                            <div className="space-y-4 p-8 bg-white/5 rounded-3xl border border-white/5">
                                                                <h3 className="text-xs font-black uppercase text-indigo-400 flex items-center gap-2 italic tracking-[0.2em]"><TrendingUp className="w-4 h-4 text-white" /> Matrix Recalibration</h3>
                                                                <p className="text-2xl font-black text-white leading-tight">{outcome.outcome}</p>
                                                                <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                                                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Shadow Paradox</p>
                                                                    <p className="text-xs text-red-200 font-medium">{outcome.consequence}</p>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-4">
                                                                <h3 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2 italic tracking-widest"><Vote className="w-4 h-4" /> Council Consensus</h3>
                                                                <ScrollArea className="h-[200px] pr-4">
                                                                    <div className="space-y-3">
                                                                        {actionVotes.map((v: any, i: number) => {
                                                                            const agent = topFive.find((a) => a.id === v.candidateId);
                                                                            return (
                                                                                <div key={i} className="text-[11px] p-4 bg-black/40 rounded-2xl border border-white/5 group hover:border-indigo-500/20 transition-all">
                                                                                    <div className="flex justify-between items-center mb-2">
                                                                                        <span className="font-black text-white uppercase">{agent?.name}</span>
                                                                                        <Badge variant="outline" className="text-[8px] h-4 uppercase border-white/10">{v.actionId === "A" ? "Logic" : v.actionId === "B" ? "Compassion" : "Power"}</Badge>
                                                                                    </div>
                                                                                    <p className="text-slate-400 italic font-medium leading-relaxed group-hover:text-slate-200 transition-colors">"{v.reason}"</p>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </ScrollArea>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        )}
                    </div>

                    {/* Superior Simulation Intelligence Console */}
                    <div className="lg:col-span-4 space-y-8">
                        <Card className="bg-slate-900/40 border-white/5 backdrop-blur-[100px] rounded-[3rem] overflow-hidden sticky top-8 shadow-3xl">
                            <CardHeader className="bg-white/5 p-8 border-b border-white/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                                            <Terminal className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <CardTitle className="text-xl font-black uppercase tracking-tighter italic">EVENT HORIZON</CardTitle>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Live Stream</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[550px] p-8">
                                    {logs.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-6 opacity-30 scale-125">
                                            <Cpu className="w-20 h-20 animate-pulse" />
                                            <p className="font-black uppercase text-xs tracking-[0.5em]">Awaiting Uplink...</p>
                                        </div>
                                    ) : (
                                        <Steps className="space-y-6">
                                            {logs.map((log, i) => (
                                                <div key={i} className="animate-in slide-in-from-right-4 duration-500">
                                                    <StepsTrigger
                                                        className="bg-transparent hover:bg-white/5 rounded-xl p-3"
                                                        leftIcon={
                                                            log.type === "success" ? <div className="size-2 bg-green-500 rounded-full" /> :
                                                                log.type === "warning" ? <div className="size-2 bg-yellow-500 rounded-full" /> :
                                                                    log.type === "error" ? <div className="size-2 bg-red-500 rounded-full" /> :
                                                                        <div className="size-2 bg-indigo-500 rounded-full" />
                                                        }
                                                    >
                                                        <span className={`text-[11px] font-black uppercase tracking-tighter ${log.type === "success" ? "text-green-400" :
                                                            log.type === "warning" ? "text-yellow-400" :
                                                                log.type === "error" ? "text-red-400" : "text-white"
                                                            }`}>
                                                            {log.msg}
                                                        </span>
                                                    </StepsTrigger>
                                                    <StepsContent className="pl-6">
                                                        <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                                                            <p className="text-[10px] text-slate-500 font-mono mb-2">[{new Date().toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 2 })}] EXEC_SYNC</p>
                                                            <p className="text-xs text-slate-300 font-medium leading-relaxed">{log.details || log.msg}</p>
                                                        </div>
                                                    </StepsContent>
                                                </div>
                                            ))}
                                        </Steps>
                                    )}
                                </ScrollArea>

                                <div className="p-8 bg-black/40 border-t border-white/5 space-y-6">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
                                        <span>Neural Connectivity</span>
                                        <span className="text-indigo-500">98.4% Est.</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <Button variant="outline" onClick={reset} className="flex-1 border-white/10 hover:bg-white/5 text-[10px] uppercase font-black tracking-widest text-slate-500 h-14 rounded-2xl group transition-all">
                                            <RefreshCw className="mr-2 w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                                            Hard Reset
                                        </Button>
                                        <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5 text-[10px] uppercase font-black tracking-widest text-slate-400 h-14 rounded-2xl">
                                            Export Logs
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-8 bg-indigo-600/[0.03] border border-indigo-500/10 rounded-[2.5rem] flex items-center gap-6"
                        >
                            <History className="w-12 h-12 text-indigo-400 opacity-20" />
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Protocol Memory</p>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed italic">All agent behaviors and decisions are indexed for socio-logic refinement and algorithmic recursive training.</p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </main>

            {/* Global CSS for hiding scrollbars */}
            <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { border-radius: 10px; background: rgba(99, 102, 241, 0.2); }
      `}</style>
        </div>
    );
}
