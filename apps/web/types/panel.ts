export type ProposalStatus = "active" | "passed" | "rejected" | "pending";

export type AgentRole = "moderator" | "advocate" | "critic" | "observer";

export interface Proposal {
  id: string;
  title: string;
  category: string;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  description: string;
  proposedBy: string;
  timestamp: string;
}

export interface AgentDebateState {
  agentId: string;
  agentName: string;
  role: AgentRole;
  currentStance: "support" | "oppose" | "neutral";
  lastArgument: string;
  confidenceScore: number;
}

export interface PanelMetric {
  title: string;
  value: string | number;
  trend: "up" | "down" | "neutral";
  change: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  agent: string;
  action: string;
  type: "vote" | "proposal" | "argument" | "alert";
}
