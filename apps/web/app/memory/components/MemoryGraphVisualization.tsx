"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
        <div>
            <div className="section-title">Knowledge Graph</div>
            <div className="section-subtitle">
                Interactive visualization of your memory knowledge graph — entities, relationships, and their temporal confidence.
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search entities…"
                    className="search-input"
                    style={{ maxWidth: 220 }}
                />
                <div className="graph-controls" style={{ margin: 0 }}>
                    <button
                        className={`graph-ctrl-btn ${filterType === "all" ? "active" : ""}`}
                        onClick={() => setFilterType("all")}
                    >
                        All
                    </button>
                    {allTypes.map((t) => (
                        <button
                            key={t}
                            className={`graph-ctrl-btn ${filterType === t ? "active" : ""}`}
                            onClick={() => setFilterType(t)}
                            style={{ borderLeft: `2px solid ${getColor(t)}` }}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Canvas */}
            <div className="graph-container">
                {nodes.length === 0 ? (
                    <div className="empty-state" style={{ height: "100%" }}>
                        <div className="empty-icon">⬡</div>
                        <div className="empty-title">Knowledge graph is empty</div>
                        <div className="empty-desc">
                            Start a memory chat — the AI will automatically extract entities and relationships into this graph
                        </div>
                    </div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        width={1200}
                        height={560}
                        style={{ width: "100%", height: "100%", display: "block" }}
                        onClick={handleCanvasClick}
                        onMouseMove={handleCanvasMouseMove}
                    />
                )}

                {/* Node info overlay */}
                {selected && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: 16,
                            left: 16,
                            background: "rgba(8, 11, 20, 0.92)",
                            border: "1px solid rgba(168,85,247,0.3)",
                            borderRadius: 12,
                            padding: "16px 20px",
                            backdropFilter: "blur(20px)",
                            minWidth: 240,
                            maxWidth: 320,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <div
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    background: getColor(selected.type),
                                    boxShadow: `0 0 8px ${getColor(selected.type)}`,
                                }}
                            />
                            <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{selected.label}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 8, fontFamily: "JetBrains Mono, monospace" }}>
                            {selected.type} · {selected.occurrences} occurrences · {Math.round(selected.confidence * 100)}% confidence
                        </div>
                        {Object.keys(selected.properties).length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {Object.entries(selected.properties).map(([k, v]) => (
                                    <div key={k} style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                                        <span style={{ color: "rgba(168,85,247,0.7)" }}>{k}:</span> {String(v)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="graph-legend">
                {Object.entries(NODE_COLORS).map(([type, color]) => (
                    <div key={type} className="legend-item">
                        <div className="legend-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                        {type}
                    </div>
                ))}
            </div>

            {/* Add custom node */}
            <div className="mem-card" style={{ marginTop: 20 }}>
                <div className="mem-card-title" style={{ marginBottom: 16 }}>
                    <div className="mem-card-icon icon-purple">＋</div>
                    Add Custom Entity
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <input
                        value={addNode.label}
                        onChange={(e) => setAddNode((p) => ({ ...p, label: e.target.value }))}
                        placeholder="Entity label (e.g. TypeScript, John, Finance)"
                        className="search-input"
                        style={{ flex: 1 }}
                        onKeyDown={(e) => e.key === "Enter" && handleAddNode()}
                    />
                    <select
                        value={addNode.type}
                        onChange={(e) => setAddNode((p) => ({ ...p, type: e.target.value }))}
                        style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 10,
                            padding: "12px 14px",
                            color: "rgba(255,255,255,0.7)",
                            fontSize: 13,
                            outline: "none",
                            cursor: "pointer",
                        }}
                    >
                        {Object.keys(NODE_COLORS).map((t) => (
                            <option key={t} value={t} style={{ background: "#0f1320" }}>
                                {t}
                            </option>
                        ))}
                    </select>
                    <button className="search-btn" onClick={handleAddNode} disabled={isAdding}>
                        {isAdding ? "Adding…" : "Add Node"}
                    </button>
                </div>
            </div>
        </div>
    );
}
