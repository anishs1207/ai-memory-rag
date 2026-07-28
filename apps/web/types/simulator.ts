export type SimulationState = "idle" | "ingesting" | "querying" | "graphing" | "complete";

export type CodeSnippetTab = "initialization" | "ingestion" | "retrieval";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "success" | "error";
  message: string;
}

export interface MemoryNode {
  id: string;
  label: string;
  type: "entity" | "concept" | "fact" | "relation";
  confidence: number;
  connections: number;
}

export interface MemoryEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface CodeSnippetMap {
  initialization: string;
  ingestion: string;
  retrieval: string;
}

export interface SimulatorMetric {
  title: string;
  value: string | number;
  change?: string;
  description?: string;
}
