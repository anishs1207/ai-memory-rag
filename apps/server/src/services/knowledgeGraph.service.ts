import fs from "fs";
import path from "path";
import type {
  KGNode,
  KGEdge,
  KnowledgeGraph,
  KGNodeType,
  KGEdgeType,
  GraphQueryResult,
} from "../types/memory.types.js";

const STORAGE_DIR = path.join(process.cwd(), "memory-store", "knowledge-graph");

function ensureDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function graphPath(userId: string): string {
  return path.join(STORAGE_DIR, `${userId}.json`);
}

function readGraph(userId: string): KnowledgeGraph {
  const p = graphPath(userId);
  if (!fs.existsSync(p)) {
    return {
      userId,
      nodes: new Map(),
      edges: new Map(),
      meta: { totalNodes: 0, totalEdges: 0, lastUpdated: Date.now() },
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
    return {
      userId: raw.userId,
      nodes: new Map(Object.entries(raw.nodes || {})),
      edges: new Map(Object.entries(raw.edges || {})),
      meta: raw.meta,
    };
  } catch {
    return {
      userId,
      nodes: new Map(),
      edges: new Map(),
      meta: { totalNodes: 0, totalEdges: 0, lastUpdated: Date.now() },
    };
  }
}

function writeGraph(graph: KnowledgeGraph): void {
  ensureDir();
  const serialisable = {
    userId: graph.userId,
    nodes: Object.fromEntries(graph.nodes),
    edges: Object.fromEntries(graph.edges),
    meta: {
      totalNodes: graph.nodes.size,
      totalEdges: graph.edges.size,
      lastUpdated: Date.now(),
    },
  };
  fs.writeFileSync(graphPath(graph.userId), JSON.stringify(serialisable, null, 2));
}

// ─── Node ID Generation ───────────────────────────────────────────────────────

function makeNodeId(type: KGNodeType, label: string): string {
  return `${type.toLowerCase()}:${label.toLowerCase().replace(/\s+/g, "_")}`;
}

function makeEdgeId(fromId: string, toId: string, type: KGEdgeType): string {
  return `${fromId}--${type}-->${toId}`;
}

export function upsertNode(
  userId: string,
  params: {
    label: string;
    type: KGNodeType;
    properties?: Record<string, any>;
    confidence?: number;
  }
): KGNode {
  const graph = readGraph(userId);
  const nodeId = makeNodeId(params.type, params.label);
  const now = Date.now();

  let node = graph.nodes.get(nodeId);
  if (node) {
    // Update existing
    node = {
      ...node,
      properties: { ...node.properties, ...(params.properties || {}) },
      confidence: Math.min(1.0, (node.confidence + (params.confidence ?? 0.8)) / 2 + 0.05),
      updatedAt: now,
      lastSeen: now,
      occurrences: node.occurrences + 1,
    };
  } else {
    node = {
      id: nodeId,
      type: params.type,
      label: params.label,
      properties: params.properties || {},
      userId,
      confidence: params.confidence ?? 0.8,
      createdAt: now,
      updatedAt: now,
      lastSeen: now,
      occurrences: 1,
    };
  }

  graph.nodes.set(nodeId, node);
  writeGraph(graph);
  return node;
}

/**
 * Upsert an edge (relationship) between two nodes.
 */
export function upsertEdge(
  userId: string,
  params: {
    fromLabel: string;
    fromType: KGNodeType;
    toLabel: string;
    toType: KGNodeType;
    type: KGEdgeType;
    weight?: number;
    confidence?: number;
    properties?: Record<string, any>;
  }
): KGEdge {
  const graph = readGraph(userId);
  const fromId = makeNodeId(params.fromType, params.fromLabel);
  const toId = makeNodeId(params.toType, params.toLabel);
  const edgeId = makeEdgeId(fromId, toId, params.type);
  const now = Date.now();

  let edge = graph.edges.get(edgeId);
  if (edge) {
    edge = {
      ...edge,
      weight: Math.min(1.0, (edge.weight + (params.weight ?? 0.7)) / 2 + 0.05),
      confidence: Math.min(1.0, (edge.confidence + (params.confidence ?? 0.8)) / 2 + 0.05),
      occurrences: edge.occurrences + 1,
      updatedAt: now,
      properties: { ...edge.properties, ...(params.properties || {}) },
    };
  } else {
    edge = {
      id: edgeId,
      from: fromId,
      to: toId,
      type: params.type,
      weight: params.weight ?? 0.7,
      confidence: params.confidence ?? 0.8,
      properties: params.properties || {},
      createdAt: now,
      updatedAt: now,
      occurrences: 1,
    };
  }

  graph.edges.set(edgeId, edge);
  writeGraph(graph);
  return edge;
}

/**
 * Query nodes by type or label (fuzzy).
 */
export function queryNodes(
  userId: string,
  params: {
    type?: KGNodeType;
    labelContains?: string;
    minConfidence?: number;
    limit?: number;
  }
): KGNode[] {
  const graph = readGraph(userId);
  let nodes = Array.from(graph.nodes.values());

  if (params.type) {
    nodes = nodes.filter((n) => n.type === params.type);
  }
  if (params.labelContains) {
    const q = params.labelContains.toLowerCase();
    nodes = nodes.filter((n) => n.label.toLowerCase().includes(q));
  }
  if (params.minConfidence !== undefined) {
    nodes = nodes.filter((n) => n.confidence >= params.minConfidence!);
  }

  // Sort by occurrences (most referenced first)
  nodes.sort((a, b) => b.occurrences - a.occurrences);

  return nodes.slice(0, params.limit ?? 50);
}

/**
 * Get all edges connected to a node (both in and out).
 */
export function getNodeEdges(
  userId: string,
  nodeId: string
): { node: KGNode | undefined; edges: KGEdge[]; connected: KGNode[] } {
  const graph = readGraph(userId);
  const node = graph.nodes.get(nodeId);
  const allEdges = Array.from(graph.edges.values());

  const edges = allEdges.filter(
    (e) => e.from === nodeId || e.to === nodeId
  );

  const connectedIds = new Set(
    edges.flatMap((e) => [e.from, e.to]).filter((id) => id !== nodeId)
  );

  const connected = Array.from(connectedIds)
    .map((id) => graph.nodes.get(id))
    .filter(Boolean) as KGNode[];

  return { node, edges, connected };
}

/**
 * Fuzzy search: find nodes most relevant to a text query.
 */
export function searchGraph(
  userId: string,
  query: string,
  limit = 10
): GraphQueryResult {
  const graph = readGraph(userId);
  const q = query.toLowerCase();

  // Score each node by text relevance
  const scored = Array.from(graph.nodes.values()).map((node) => {
    let score = 0;
    if (node.label.toLowerCase().includes(q)) score += 3;
    const propsStr = JSON.stringify(node.properties).toLowerCase();
    if (propsStr.includes(q)) score += 1;
    // Boost by occurrences and confidence
    score += node.occurrences * 0.1 + node.confidence * 0.5;
    return { node, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topNodes = scored
    .slice(0, limit)
    .filter((s) => s.score > 0)
    .map((s) => s.node);

  if (topNodes.length === 0) return { nodes: [], edges: [] };

  const topIds = new Set(topNodes.map((n) => n.id));
  const allEdges = Array.from(graph.edges.values());

  // Get edges between top nodes
  const relevantEdges = allEdges.filter(
    (e) => topIds.has(e.from) && topIds.has(e.to)
  );

  return { nodes: topNodes, edges: relevantEdges };
}

/**
 * Get the full graph for a user (for visualisation).
 */
export function getFullGraph(userId: string): GraphQueryResult {
  const graph = readGraph(userId);
  return {
    nodes: Array.from(graph.nodes.values()),
    edges: Array.from(graph.edges.values()),
  };
}

/**
 * Format knowledge graph facts into a string (for LLM context).
 */
export function formatGraphContext(result: GraphQueryResult): string {
  if (result.nodes.length === 0) return "";

  const lines: string[] = ["[KNOWLEDGE GRAPH — KNOWN FACTS]"];

  // Entity facts
  result.edges.forEach((edge) => {
    const fromNode = result.nodes.find((n) => n.id === edge.from);
    const toNode = result.nodes.find((n) => n.id === edge.to);
    if (fromNode && toNode) {
      lines.push(
        `• ${fromNode.label} [${edge.type}] ${toNode.label} (confidence: ${(edge.confidence * 100).toFixed(0)}%)`
      );
    }
  });

  // Isolated nodes (no edges in this result)
  const connectedIds = new Set(
    result.edges.flatMap((e) => [e.from, e.to])
  );
  result.nodes
    .filter((n) => !connectedIds.has(n.id))
    .forEach((n) => {
      lines.push(`• ${n.label} [${n.type}]`);
    });

  return lines.join("\n");
}

/**
 * Get KG stats for a user.
 */
export function getGraphStats(userId: string) {
  const graph = readGraph(userId);
  const nodes = Array.from(graph.nodes.values());
  const edges = Array.from(graph.edges.values());

  const nodesByType: Record<string, number> = {};
  nodes.forEach((n) => {
    nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
  });

  const topEntities = nodes
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10)
    .map((n) => ({ label: n.label, type: n.type, occurrences: n.occurrences }));

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodesByType,
    topEntities,
  };
}

/**
 * Delete a node and all its edges from the graph.
 */
export function deleteNode(userId: string, nodeId: string): boolean {
  const graph = readGraph(userId);
  if (!graph.nodes.has(nodeId)) return false;

  graph.nodes.delete(nodeId);
  // Remove all edges connected to this node
  for (const [edgeId, edge] of graph.edges) {
    if (edge.from === nodeId || edge.to === nodeId) {
      graph.edges.delete(edgeId);
    }
  }

  writeGraph(graph);
  return true;
}

/**
 * Apply memory decay: reduce confidence of nodes not seen recently.
 */
export function applyDecay(userId: string): void {
  const graph = readGraph(userId);
  const now = Date.now();
  const DECAY_RATE = 0.01; // 1% per day

  for (const [id, node] of graph.nodes) {
    const daysSinceLastSeen =
      (now - node.lastSeen) / (1000 * 60 * 60 * 24);
    const newConfidence = Math.max(
      0.1,
      node.confidence - DECAY_RATE * daysSinceLastSeen
    );
    graph.nodes.set(id, { ...node, confidence: newConfidence });
  }

  writeGraph(graph);
}
