"use client";

import { useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Users,
    Vote,
    ShieldAlert,
    History,
    Terminal,
    RefreshCw,
    TrendingUp,
    AlertCircle,
    Cpu,
    Zap,
    Activity,
    LayoutDashboard,
    Settings,
    Shield,
    MessageSquare,
} from "lucide-react";
import { Loader } from "@/components/prompt-kit/loader";
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

    const [crisis, setCrisis] = useState<any>(null);
    const [actionVotes, setActionVotes] = useState<any[]>([]);
    const [finalAction, setFinalAction] = useState<any>(null);
    const [outcome, setOutcome] = useState<any>(null);

    const [approval, setApproval] = useState(75);
    const [logs, setLogs] = useState<{ msg: string; type: "info" | "success" | "warning" | "error"; details?: string }[]>(
        []
    );

    const addLog = (msg: string, type: "info" | "success" | "warning" | "error" = "info", details?: string) => {
        setLogs((prev) => [...prev, { msg, type, details, timestamp: new Date().toLocaleTimeString() }]);
    };

    async function generatePersonas() {
        setLoading(true);
        setError(null);
        setLogs([]);
        addLog("System Initialization", "info", `Deploying ${numPersonas} autonomous agent instances.`);
        try {
            const resp = await axios.post<{ agents: Persona[] }>(`${API_BASE}/generate-personas`, {
                count: numPersonas,
            });
            setPersonas(resp.data.agents);
            addLog("Generation Complete", "success", "All agent profiles successfully generated.");
            setPhase("campaign");
        } catch (err: any) {
            setError(err.message || "Failed to generate agents");
            addLog("Initialization Error", "error", "System failed to instantiate agents.");
        } finally {
            setLoading(false);
        }
    }

    async function conductVoting() {
        setLoading(true);
        setError(null);
        addLog("Selection Process Started", "warning", "Evaluating agent alignment and responses.");
        try {
            const resp = await axios.post<{
                topLeadersWithDetails: Persona[];
                enrichedVotes: any[];
            }>(`${API_BASE}/conduct-election`, { agents: personas });
            setTopFive(resp.data.topLeadersWithDetails);
            addLog("Leadership Selection Complete", "success", `Top 5 candidates have been identified.`);
            setPhase("council");
        } catch (err: any) {
            setError(err.message || "Selection failed");
            addLog("Logic Error", "error", "Process interrupted during vote computation.");
        } finally {
            setLoading(false);
        }
    }

    function chooseLeader() {
        addLog("Leadership Protocol", "info", "Assigning executive authority to a primary agent.");
        const chosen = topFive[Math.floor(Math.random() * topFive.length)];
        setLeader(chosen || null);
        addLog(`Executive Assigned`, "success", `Authority delegated to ${chosen?.name}.`);
        setPhase("leader");
    }

    async function triggerCrisis() {
        setLoading(true);
        setError(null);
        addLog(`Environmental Simulation: ${userTopic || "Generic"}`, "warning", "Injecting stress factors into the environment.");
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

            addLog(`Scenario Detected`, "error", issue.issue.slice(0, 100) + "...");
            addLog(`Response Implemented`, "success", `Strategy enacted: ${finalAction.label}.`);
            setApproval((prev) => Math.min(100, Math.max(0, prev + outcome.approvalChange)));
            setPhase("crisis");
        } catch (err: any) {
            setError(err.message || "Simulation failed");
            addLog("Simulation Error", "error", "Failed to process environmental response.");
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
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            {/* Dashboard Navbar */}
            <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-6">
                <div className="flex items-center gap-2 font-semibold">
                    <Settings className="h-5 w-5 text-primary" />
                    <span className="text-lg tracking-tight">Agent Management Panel</span>
                </div>
                <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center gap-3 px-3 py-1 bg-muted rounded-lg border text-sm">
                        <span className="text-xs text-muted-foreground font-medium uppercase">System Health</span>
                        <span className="font-bold">{approval}%</span>
                        <Progress value={approval} className="w-20 h-1.5" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={reset} title="Reset System">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-6 space-y-6 max-w-[1400px] mx-auto w-full">
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Operation Failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Main Workspace */}
                    <div className="lg:col-span-8 space-y-6">
                        {phase === "setup" ? (
                            <Card className="flex flex-col items-center justify-center min-h-[400px] text-center p-12 border-dashed">
                                <div className="p-4 bg-primary/5 rounded-full mb-6">
                                    <Users className="h-10 w-10 text-primary/60" />
                                </div>
                                <CardTitle className="text-2xl mb-2">Agent Initialization</CardTitle>
                                <CardDescription className="max-w-xs mb-8">
                                    Configure the number of autonomous instances to deploy in this session.
                                </CardDescription>

                                <div className="flex flex-col sm:flex-row items-end gap-4 w-full max-w-sm">
                                    <div className="flex-1 w-full text-left">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block ml-1">
                                            Instance Count
                                        </label>
                                        <Input
                                            type="number"
                                            min={4}
                                            max={50}
                                            value={numPersonas}
                                            className="h-10"
                                            onChange={(e) => setNumPersonas(Number(e.target.value))}
                                        />
                                    </div>
                                    <Button
                                        disabled={loading}
                                        onClick={generatePersonas}
                                        className="h-10 px-6"
                                    >
                                        {loading ? (
                                            <Loader variant="circular" size="sm" />
                                        ) : (
                                            "Initialize System"
                                        )}
                                    </Button>
                                </div>
                            </Card>
                        ) : (
                            <div className="space-y-6">
                                {/* Status Bar */}
                                <Card className="p-1 px-4">
                                    <div className="flex items-center justify-between h-10">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline">{phase.toUpperCase()}</Badge>
                                            {loading && (
                                                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Loader size="sm" className="text-primary" />
                                                    Processing...
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {phase === "campaign" && (
                                                <Button onClick={conductVoting} disabled={loading} size="sm">
                                                    Run Selection
                                                </Button>
                                            )}
                                            {phase === "council" && (
                                                <Button onClick={chooseLeader} disabled={loading} size="sm">
                                                    Assign Executive
                                                </Button>
                                            )}
                                            {(phase === "leader" || phase === "crisis") && (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        placeholder="Simulation parameter..."
                                                        value={userTopic}
                                                        onChange={(e) => setUserTopic(e.target.value)}
                                                        className="h-8 w-40 text-xs"
                                                    />
                                                    <Button onClick={triggerCrisis} disabled={loading} size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white">
                                                        Apply Stress
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                <Tabs defaultValue="grid" className="w-full">
                                    <TabsList className="mb-4">
                                        <TabsTrigger value="grid">Grid Overview</TabsTrigger>
                                        <TabsTrigger value="list">Detailed Logs</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="grid">
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {(phase === "campaign" ? personas : topFive).map((p) => (
                                                <Card key={p.id} className={`transition-all hover:border-primary/50 ${leader?.id === p.id ? "ring-1 ring-primary border-primary" : ""}`}>
                                                    <CardHeader className="pb-3 border-b bg-muted/20">
                                                        <div className="flex justify-between items-start">
                                                            <div className="space-y-1">
                                                                <CardTitle className="text-base truncate">{p.name}</CardTitle>
                                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">{p.ideology}</p>
                                                            </div>
                                                            <Badge variant="outline" className="text-[10px]">ID {p.id}</Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="pt-4 space-y-4">
                                                        <div className="text-sm text-foreground leading-relaxed bg-muted/30 p-3 rounded border">
                                                            "{p.speech}"
                                                        </div>

                                                        <div className="flex flex-wrap gap-1">
                                                            {p.traits.map(t => (
                                                                <Badge key={t} variant="secondary" className="text-[9px] font-normal px-2">
                                                                    {t}
                                                                </Badge>
                                                            ))}
                                                        </div>

                                                        <div className="space-y-1">
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                                                <History className="h-3 w-3" />
                                                                Record
                                                            </span>
                                                            <p className="text-xs text-muted-foreground line-clamp-2">{p.background}</p>
                                                        </div>

                                                        {p.votes !== undefined && (
                                                            <div className="pt-2 flex items-center justify-between border-t text-xs">
                                                                <span className="font-medium">Consensus Score</span>
                                                                <span className="font-bold text-primary">{p.votes}</span>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="list">
                                        <Card>
                                            <CardHeader className="pb-4 border-b">
                                                <CardTitle className="text-lg">Agent Registry</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div className="divide-y">
                                                    {personas.map(p => (
                                                        <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                                                            <Avatar className="h-9 w-9 border">
                                                                <AvatarFallback className="text-xs font-bold">
                                                                    {p.name.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold">{p.name}</p>
                                                                <p className="text-[10px] text-muted-foreground uppercase">{p.ideology}</p>
                                                            </div>
                                                            <div className="hidden md:block w-1/3 text-xs text-muted-foreground italic truncate">
                                                                "{p.hiddenGoal}"
                                                            </div>
                                                            <Badge variant="outline" className="text-[10px]">ID {p.id}</Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </Tabs>

                                {/* Crisis Output */}
                                {phase === "crisis" && crisis && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert className="h-5 w-5 text-destructive" />
                                            <h3 className="text-lg font-bold">Environmental Status</h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Card className="border-destructive/30">
                                                <CardHeader className="py-3 bg-destructive/5 border-b">
                                                    <CardTitle className="text-sm flex items-center gap-2 font-bold opacity-80 uppercase">
                                                        <Terminal className="h-4 w-4" />
                                                        Active Scenario
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="pt-4">
                                                    <p className="text-sm leading-relaxed text-muted-foreground">{crisis.issue}</p>
                                                </CardContent>
                                            </Card>

                                            <Card>
                                                <CardHeader className="py-3 border-b">
                                                    <CardTitle className="text-sm font-bold opacity-80 uppercase">System Outcome</CardTitle>
                                                </CardHeader>
                                                <CardContent className="pt-4 space-y-3">
                                                    <div className="p-3 bg-primary/5 border rounded leading-tight">
                                                        <p className="text-[10px] font-bold text-primary uppercase mb-1">Decision: {finalAction.label}</p>
                                                        <p className="text-sm">{outcome.outcome}</p>
                                                    </div>
                                                    <div className="p-3 bg-destructive/5 border border-destructive/10 rounded leading-tight">
                                                        <p className="text-[10px] font-bold text-destructive uppercase mb-1">Impact</p>
                                                        <p className="text-sm italic text-muted-foreground">{outcome.consequence}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <Card>
                                            <CardHeader className="py-3 border-b">
                                                <CardTitle className="text-sm font-bold opacity-80 uppercase">Consensus Logs</CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                                    {actionVotes.map((v: any, i: number) => {
                                                        const agent = topFive.find((a) => a.id === v.candidateId);
                                                        return (
                                                            <div key={i} className="p-3 border rounded-md space-y-1.5 bg-muted/10">
                                                                <div className="flex justify-between items-center border-b pb-1">
                                                                    <span className="text-[10px] font-bold">{agent?.name}</span>
                                                                    <Badge variant="outline" className="text-[8px] px-1 h-3">{v.actionId}</Badge>
                                                                </div>
                                                                <p className="text-[11px] text-muted-foreground italic leading-snug">"{v.reason}"</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Activity Console */}
                    <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20">
                        <Card className="h-[550px] flex flex-col shadow-none border-muted">
                            <CardHeader className="py-3 px-4 border-b bg-muted/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activity Log</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border bg-background">
                                        <div className="h-1 w-1 rounded-full bg-green-500" />
                                        <span className="text-[10px] font-medium">Synced</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 overflow-hidden">
                                <ScrollArea className="h-full">
                                    {logs.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-8 mt-20 opacity-30">
                                            <MessageSquare className="h-10 w-10 mb-2" />
                                            <p className="text-xs uppercase font-bold tracking-widest">Awaiting System Logs</p>
                                        </div>
                                    ) : (
                                        <div className="p-4 space-y-5">
                                            {logs.map((log: any, i: number) => (
                                                <div key={i} className="space-y-1 group">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`h-1 w-1 rounded-full ${log.type === "success" ? "bg-green-500" :
                                                                log.type === "warning" ? "bg-amber-500" :
                                                                    log.type === "error" ? "bg-destructive" :
                                                                        "bg-primary"
                                                                }`} />
                                                            <span className={`text-[10px] font-bold uppercase tracking-tight ${log.type === "success" ? "text-green-600" :
                                                                log.type === "warning" ? "text-amber-600" :
                                                                    log.type === "error" ? "text-destructive" :
                                                                        "text-primary"
                                                                }`}>{log.msg}</span>
                                                        </div>
                                                        <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{log.timestamp}</span>
                                                    </div>
                                                    <div className="pl-2.5 border-l-2 ml-0.5">
                                                        <p className="text-xs text-muted-foreground font-medium leading-tight">{log.details || log.msg}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
