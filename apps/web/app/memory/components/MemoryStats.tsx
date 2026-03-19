import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Network, Database, MessageSquare, Clock, Zap, Cpu, Activity } from "lucide-react";

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
            icon: <Network className="h-5 w-5 text-purple-500" />,
            colorClass: "text-purple-500",
        },
        {
            label: "KG Edges",
            value: kgStats?.totalEdges ?? 0,
            desc: "Relationships mapped",
            icon: <Database className="h-5 w-5 text-cyan-500" />,
            colorClass: "text-cyan-500",
        },
        {
            label: "Sessions",
            value: stStats?.totalSessions ?? 0,
            desc: "Short-term memory sessions",
            icon: <Clock className="h-5 w-5 text-amber-500" />,
            colorClass: "text-amber-500",
        },
        {
            label: "Messages",
            value: stStats?.totalMessages ?? 0,
            desc: "Total turns across sessions",
            icon: <MessageSquare className="h-5 w-5 text-green-500" />,
            colorClass: "text-green-500",
        },
    ];

    const topEntities: any[] = kgStats?.topEntities ?? [];
    const nodesByType: Record<string, number> = kgStats?.nodesByType ?? {};

    return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Activity className="h-6 w-6 text-primary" />
                    Memory Overview
                </h2>
                <p className="text-muted-foreground text-sm">
                    Real-time view of all three memory layers — knowledge graph, semantic long-term, and conversational short-term.
                </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card) => (
                    <Card key={card.label} className="border bg-card/50 hover:bg-card/80 transition-colors shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                {card.label}
                            </CardTitle>
                            {card.icon}
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <Skeleton className="h-8 w-20 mt-1 mb-1" />
                            ) : (
                                <div className={`text-3xl font-bold ${card.colorClass}`}>
                                    {card.value.toLocaleString()}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1 font-medium">{card.desc}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Two-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Entities */}
                <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Network className="h-4 w-4 text-purple-500" />
                            Top Entities
                        </CardTitle>
                        <CardDescription>Most frequently accessed nodes in the graph</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {topEntities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                                <Network className="h-10 w-10 mb-4 opacity-20" />
                                <p className="font-semibold text-foreground">No entities yet</p>
                                <p className="text-sm mt-1">Chat with the memory agent to build your knowledge graph</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {topEntities.slice(0, 8).map((e: any, i: number) => (
                                    <div key={i} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                                        <div
                                            className="h-3 w-3 rounded-full flex-shrink-0 shadow-sm"
                                            style={{
                                                backgroundColor: NODE_TYPE_COLORS[e.type] ?? "#888",
                                                boxShadow: `0 0 10px ${NODE_TYPE_COLORS[e.type] ?? "#888"}`,
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">{e.label}</p>
                                            <p className="text-[10px] uppercase text-muted-foreground tracking-wider mt-0.5">{e.type}</p>
                                        </div>
                                        <Badge variant="secondary" className="font-mono text-[10px]">
                                            ×{e.occurrences}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Node Type Distribution */}
                <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Database className="h-4 w-4 text-cyan-500" />
                            Entity Types
                        </CardTitle>
                        <CardDescription>Distribution of knowledge classifications</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        {Object.keys(nodesByType).length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 mt-4 text-center text-muted-foreground">
                                <Database className="h-10 w-10 mb-4 opacity-20" />
                                <p className="font-semibold text-foreground">No types yet</p>
                                <p className="text-sm mt-1">Entity type distribution will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {Object.entries(nodesByType)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([type, count]) => {
                                        const total = Object.values(nodesByType).reduce((a, b) => a + b, 0);
                                        const pct = Math.round((count / total) * 100);
                                        const color = NODE_TYPE_COLORS[type] ?? "#888";
                                        return (
                                            <div key={type} className="space-y-1.5">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="font-medium text-foreground">{type}</span>
                                                    <span className="font-mono text-muted-foreground">
                                                        {count} <span className="opacity-50">({pct}%)</span>
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                                        style={{
                                                            width: `${pct}%`,
                                                            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Architecture diagram */}
                <Card className="lg:col-span-2 shadow-sm border-t-4 border-t-primary/50">
                    <CardHeader className="border-b bg-muted/10 pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-amber-500" />
                            Memory Architecture (SOTA — CoALA + MemGPT + HippoRAG)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                {
                                    title: "Short-Term Memory",
                                    icon: <Clock className="h-6 w-6" />,
                                    colorClass: "text-purple-500",
                                    borderColorClass: "border-purple-500/30",
                                    topBorderClass: "border-t-purple-500",
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
                                    icon: <Database className="h-6 w-6" />,
                                    colorClass: "text-cyan-500",
                                    borderColorClass: "border-cyan-500/30",
                                    topBorderClass: "border-t-cyan-500",
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
                                    icon: <Network className="h-6 w-6" />,
                                    colorClass: "text-amber-500",
                                    borderColorClass: "border-amber-500/30",
                                    topBorderClass: "border-t-amber-500",
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
                                    className={`p-5 bg-card/50 border rounded-xl border-t-4 ${layer.borderColorClass} ${layer.topBorderClass} shadow-sm hover:shadow-md transition-all`}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={layer.colorClass}>{layer.icon}</div>
                                        <div>
                                            <div className="text-sm font-bold text-foreground">{layer.title}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                                                Inspired by {layer.inspired}
                                            </div>
                                        </div>
                                    </div>
                                    <ul className="space-y-2">
                                        {layer.desc.map((d, i) => (
                                            <li key={i} className="flex gap-2 items-start text-xs text-muted-foreground">
                                                <span className={`mt-0.5 text-[10px] ${layer.colorClass}`}>▸</span>
                                                <span className="leading-snug">{d}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
