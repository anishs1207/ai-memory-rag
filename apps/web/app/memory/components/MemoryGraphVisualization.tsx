"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Network, Search, PlusCircle, Hexagon } from "lucide-react";

interface Node {
    id: string;
    type: string;
    label: string;
    confidence: number;
    occurrences: number;
    properties: Record<string, any>;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
}

interface Edge {
    id: string;
    from: string;
    to: string;
    type: string;
    weight: number;
    confidence: number;
}

interface Props {
    userId: string;
    apiBase: string;
    graphData: { nodes: any[]; edges: any[] } | null;
    onRefresh: () => void;
}

const NODE_COLORS: Record<string, string> = {
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
    Organization: "#14b8a6",
    Location: "#84cc16",
    Document: "#a78bfa",
};

const DEFAULT_COLOR = "#94a3b8";

function getColor(type: string): string {
    return NODE_COLORS[type] ?? DEFAULT_COLOR;
}

function nodeRadius(node: Node): number {
    const base = 8;
    return Math.min(base + node.occurrences * 2, 24);
}

// Force-directed layout
function runForce(nodes: Node[], edges: Edge[], iterations = 150) {
    const W = 800, H = 500;
    const REPEL = 3000;
    const ATTRACT = 0.05;
    const DAMP = 0.85;
    const CENTER_X = W / 2, CENTER_Y = H / 2;

    // init
    nodes.forEach((n, i) => {
        if (n.x === undefined) {
            const angle = (i / nodes.length) * 2 * Math.PI;
            n.x = CENTER_X + Math.cos(angle) * 180;
            n.y = CENTER_Y + Math.sin(angle) * 180;
            n.vx = 0;
            n.vy = 0;
        }
    });

    for (let iter = 0; iter < iterations; iter++) {
        // repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i]!;
                const b = nodes[j]!;
                const dx = (a.x ?? 0) - (b.x ?? 0);
                const dy = (a.y ?? 0) - (b.y ?? 0);
                const dist2 = dx * dx + dy * dy + 1;
                const force = REPEL / dist2;
                const fx = (dx / Math.sqrt(dist2)) * force;
                const fy = (dy / Math.sqrt(dist2)) * force;
                a.vx = (a.vx ?? 0) + fx;
                a.vy = (a.vy ?? 0) + fy;
                b.vx = (b.vx ?? 0) - fx;
                b.vy = (b.vy ?? 0) - fy;
            }
        }

        // attraction (edges)
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
        edges.forEach((e) => {
            const a = nodeMap.get(e.from);
            const b = nodeMap.get(e.to);
            if (!a || !b) return;
            const dx = (b.x ?? 0) - (a.x ?? 0);
            const dy = (b.y ?? 0) - (a.y ?? 0);
            a.vx = (a.vx ?? 0) + dx * ATTRACT;
            a.vy = (a.vy ?? 0) + dy * ATTRACT;
            b.vx = (b.vx ?? 0) - dx * ATTRACT;
            b.vy = (b.vy ?? 0) - dy * ATTRACT;
        });

        // center gravity
        nodes.forEach((n) => {
            n.vx = (n.vx ?? 0) + (CENTER_X - (n.x ?? 0)) * 0.005;
            n.vy = (n.vy ?? 0) + (CENTER_Y - (n.y ?? 0)) * 0.005;
            n.vx = (n.vx ?? 0) * DAMP;
            n.vy = (n.vy ?? 0) * DAMP;
            n.x = (n.x ?? 0) + (n.vx ?? 0);
            n.y = (n.y ?? 0) + (n.vy ?? 0);
            // bounds
            n.x = Math.max(30, Math.min(W - 30, n.x ?? 0));
            n.y = Math.max(30, Math.min(H - 30, n.y ?? 0));
        });
    }
}

export default function MemoryGraphVisualization({ userId, apiBase, graphData, onRefresh }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [selected, setSelected] = useState<Node | null>(null);
    const [hovered, setHovered] = useState<Node | null>(null);
    const [filterType, setFilterType] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [addNode, setAddNode] = useState({ label: "", type: "Concept" });
    const [isAdding, setIsAdding] = useState(false);
    const animRef = useRef<number>(0);
    const nodesRef = useRef<Node[]>([]);
    const hoveredRef = useRef<Node | null>(null);
    const selectedRef = useRef<Node | null>(null);

    // Populate graph
    useEffect(() => {
        if (!graphData) return;
        const rawNodes: Node[] = (graphData.nodes || []).map((n: any) => ({
            ...n,
            x: undefined,
            y: undefined,
            vx: 0,
            vy: 0,
        }));
        const rawEdges: Edge[] = graphData.edges || [];
        runForce(rawNodes, rawEdges, 200);
        setNodes(rawNodes);
        setEdges(rawEdges);
        nodesRef.current = rawNodes;
    }, [graphData]);

    // Canvas render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const W = canvas.width;
        const H = canvas.height;

        const render = () => {
            ctx.clearRect(0, 0, W, H);

            const filteredNodes = nodesRef.current.filter((n) => {
                if (filterType !== "all" && n.type !== filterType) return false;
                if (searchQuery && !n.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                return true;
            });
            const filteredIds = new Set(filteredNodes.map((n) => n.id));

            // Draw edges
            edges.forEach((e) => {
                if (!filteredIds.has(e.from) || !filteredIds.has(e.to)) return;
                const from = nodesRef.current.find((n) => n.id === e.from);
                const to = nodesRef.current.find((n) => n.id === e.to);
                if (!from || !to || from.x === undefined || to.x === undefined) return;

                ctx.beginPath();
                ctx.moveTo(from.x, from.y ?? 0);
                ctx.lineTo(to.x ?? 0, to.y ?? 0);

                const isHighlighted =
                    selectedRef.current?.id === from.id || selectedRef.current?.id === to.id ||
                    hoveredRef.current?.id === from.id || hoveredRef.current?.id === to.id;

                ctx.strokeStyle = isHighlighted
                    ? `rgba(168, 85, 247, ${e.confidence * 0.8})`
                    : `rgba(255, 255, 255, ${e.confidence * 0.12})`;
                ctx.lineWidth = isHighlighted ? 1.5 : 0.8;
                ctx.stroke();

                // Edge label (on hover)
                if (isHighlighted) {
                    const mx = ((from.x ?? 0) + (to.x ?? 0)) / 2;
                    const my = ((from.y ?? 0) + (to.y ?? 0)) / 2;
                    ctx.fillStyle = "rgba(168, 85, 247, 0.7)";
                    ctx.font = "9px JetBrains Mono, monospace";
                    ctx.textAlign = "center";
                    ctx.fillText(e.type, mx, my - 2);
                }
            });

            // Draw nodes
            filteredNodes.forEach((n) => {
                if (n.x === undefined) return;
                const r = nodeRadius(n);
                const color = getColor(n.type);
                const isSelected = selectedRef.current?.id === n.id;
                const isHovered = hoveredRef.current?.id === n.id;

                // Glow
                if (isSelected || isHovered) {
                    const grd = ctx.createRadialGradient(n.x, n.y ?? 0, 0, n.x, n.y ?? 0, r * 3);
                    grd.addColorStop(0, `${color}40`);
                    grd.addColorStop(1, "transparent");
                    ctx.beginPath();
                    ctx.arc(n.x, n.y ?? 0, r * 3, 0, Math.PI * 2);
                    ctx.fillStyle = grd;
                    ctx.fill();
                }

                // Node circle
                ctx.beginPath();
                ctx.arc(n.x, n.y ?? 0, r, 0, Math.PI * 2);
                const grd2 = ctx.createRadialGradient(n.x - r * 0.3, (n.y ?? 0) - r * 0.3, 1, n.x, n.y ?? 0, r);
                grd2.addColorStop(0, `${color}FF`);
                grd2.addColorStop(1, `${color}99`);
                ctx.fillStyle = grd2;
                ctx.fill();

                // Border
                ctx.strokeStyle = isSelected ? "white" : isHovered ? `${color}FF` : `${color}66`;
                ctx.lineWidth = isSelected ? 2.5 : 1.5;
                ctx.stroke();

                // Label
                ctx.fillStyle = isSelected || isHovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)";
                ctx.font = `${isSelected ? "bold " : ""}11px Inter, sans-serif`;
                ctx.textAlign = "center";
                ctx.fillText(n.label, n.x, (n.y ?? 0) + r + 14);
            });

            animRef.current = requestAnimationFrame(render);
        };

        animRef.current = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animRef.current);
    }, [edges, filterType, searchQuery]);

    // Mouse interaction
    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        const hit = nodesRef.current.find((n) => {
            if (n.x === undefined) return false;
            const dx = (n.x ?? 0) - mx;
            const dy = (n.y ?? 0) - my;
            return Math.sqrt(dx * dx + dy * dy) <= nodeRadius(n) + 4;
        });
        selectedRef.current = hit ?? null;
        setSelected(hit ?? null);
    }, []);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        const hit = nodesRef.current.find((n) => {
            if (n.x === undefined) return false;
            const dx = (n.x ?? 0) - mx;
            const dy = (n.y ?? 0) - my;
            return Math.sqrt(dx * dx + dy * dy) <= nodeRadius(n) + 4;
        });
        hoveredRef.current = hit ?? null;
        setHovered(hit ?? null);
        if (canvas) canvas.style.cursor = hit ? "pointer" : "default";
    }, []);

    // Add a custom node
    const handleAddNode = async () => {
        if (!addNode.label.trim()) return;
        setIsAdding(true);
        try {
            await fetch(`${apiBase}/kg/node`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, label: addNode.label, type: addNode.type }),
            });
            onRefresh();
        } catch { }
        setIsAdding(false);
        setAddNode({ label: "", type: "Concept" });
    };

    const allTypes = Array.from(new Set(nodes.map((n) => n.type)));

    return (
        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Network className="h-6 w-6 text-primary" />
                    Knowledge Graph
                </h2>
                <p className="text-muted-foreground text-sm">
                    Interactive visualization of your memory knowledge graph — entities, relationships, and their temporal confidence.
                </p>
            </div>

            {/* Controls */}
            <Card className="p-4 flex flex-wrap gap-4 items-center bg-card/50 shadow-sm border">
                <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search entities…"
                        className="pl-9 bg-background"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge
                        variant={filterType === "all" ? "default" : "secondary"}
                        className="cursor-pointer font-medium hover:bg-primary/80 transition-colors"
                        onClick={() => setFilterType("all")}
                    >
                        All Types
                    </Badge>
                    {allTypes.map((t) => (
                        <Badge
                            key={t}
                            variant={filterType === t ? "default" : "outline"}
                            className="cursor-pointer font-medium hover:bg-muted transition-colors"
                            onClick={() => setFilterType(t)}
                            style={{ 
                                borderColor: filterType !== t ? getColor(t) : undefined,
                                backgroundColor: filterType === t ? getColor(t) : undefined,
                                color: filterType === t ? "#fff" : undefined
                            }}
                        >
                            {t}
                        </Badge>
                    ))}
                </div>
            </Card>

            {/* Canvas */}
            <div className="flex-1 min-h-[500px] border border-muted bg-[#080b14] rounded-xl overflow-hidden relative shadow-inner">
                {nodes.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-10 text-center">
                        <Hexagon className="h-16 w-16 mb-4 opacity-20" />
                        <p className="font-semibold text-foreground text-lg">Knowledge graph is empty</p>
                        <p className="text-sm mt-2 max-w-sm">
                            Start a memory chat — the AI will automatically extract entities and relationships into this graph.
                        </p>
                    </div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        width={1200}
                        height={560}
                        className="w-full h-full block cursor-crosshair"
                        onClick={handleCanvasClick}
                        onMouseMove={handleCanvasMouseMove}
                    />
                )}

                {/* Node info overlay */}
                {selected && (
                    <div className="absolute bottom-6 left-6 bg-background/95 border border-primary/30 rounded-xl p-5 backdrop-blur-md shadow-lg min-w-[280px] max-w-[340px] animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <div className="flex items-center gap-3 mb-3">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                    backgroundColor: getColor(selected.type),
                                    boxShadow: `0 0 10px ${getColor(selected.type)}`,
                                }}
                            />
                            <div className="text-base font-semibold text-foreground truncate">{selected.label}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-4 font-mono leading-relaxed bg-muted/40 p-2 rounded-md">
                            <span className="font-bold">{selected.type}</span> <br/>
                            {selected.occurrences} occurrences <br/>
                            {Math.round(selected.confidence * 100)}% confidence
                        </div>
                        {Object.keys(selected.properties).length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-2 overflow-y-auto max-h-[150px] pr-2 custom-scrollbar">
                                {Object.entries(selected.properties).map(([k, v]) => (
                                    <div key={k} className="text-[11px] text-muted-foreground bg-muted/20 p-1.5 rounded border border-muted-foreground/10">
                                        <span className="text-primary/80 font-semibold mr-1">{k}:</span>
                                        <span className="break-words">{String(v)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Legend */}
                <div className="absolute top-6 right-6 flex flex-col gap-2 bg-background/80 backdrop-blur-sm p-4 rounded-xl border border-muted shadow-sm hidden md:flex">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Index</span>
                    {Object.entries(NODE_COLORS).slice(0, 8).map(([type, color]) => (
                        <div key={type} className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                            <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                            {type}
                        </div>
                    ))}
                    <div className="text-[9px] text-muted-foreground/50 mt-1 italic">+ more</div>
                </div>
            </div>

            {/* Add custom node */}
            <Card className="shadow-sm border-t-4 border-t-primary/50">
                <CardHeader className="bg-muted/10 pb-4 border-b">
                    <CardTitle className="text-base flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-purple-500" />
                        Add Custom Entity
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            value={addNode.label}
                            onChange={(e) => setAddNode((p) => ({ ...p, label: e.target.value }))}
                            placeholder="Entity label (e.g. TypeScript, John, Finance)"
                            className="flex-1"
                            onKeyDown={(e) => e.key === "Enter" && handleAddNode()}
                        />
                        <select
                            value={addNode.type}
                            onChange={(e) => setAddNode((p) => ({ ...p, type: e.target.value }))}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-[180px]"
                        >
                            {Object.keys(NODE_COLORS).map((t) => (
                                <option key={t} value={t} className="bg-background">
                                    {t}
                                </option>
                            ))}
                        </select>
                        <Button 
                            onClick={handleAddNode} 
                            disabled={isAdding || !addNode.label.trim()}
                            className="w-full sm:w-auto"
                        >
                            {isAdding ? "Adding…" : "Add Node"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
