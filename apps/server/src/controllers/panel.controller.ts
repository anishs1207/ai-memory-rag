import type { Request, Response } from "express";
import { z } from "zod";
import { geminiClient, parseResult, getText } from "@/utils/index.js";

type Agent = {
  id: number;
  name: string;
  background: string;
  ideology: string;
  speech: string;
  traits: string[];
  hiddenGoal: string;
};

type VoteResult = {
  voterId: number;
  votedForId: number;
  reason: string;
};

type TopCandidate = {
  candidateId: number;
  votes: number;
};

type AgentWithVotes = Agent & {
  votes: number;
};

type EnrichedVote = {
  voter: Agent;
  votedFor: Agent;
  reason: string;
};

type EnrichedLeader = Agent & {
  votes: number;
};

const agentSchema = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1),
  background: z.string().min(1),
  ideology: z.string().min(1),
  speech: z.string().min(1),
  traits: z.array(z.string()),
  hiddenGoal: z.string(),
});

function getTop5Candidates(votes: VoteResult[]): TopCandidate[] {
  const voteCount: Record<number, number> = {};
  votes.forEach((v) => {
    voteCount[v.votedForId] = (voteCount[v.votedForId] || 0) + 1;
  });

  let sortedCandidates: TopCandidate[] = Object.keys(voteCount)
    .map(Number)
    .map((id) => ({
      candidateId: id,
      votes: voteCount[id] || 0,
    }));

  sortedCandidates.sort((a, b) => b.votes - a.votes);

  if (sortedCandidates.length > 5) {
    const fifthVotes = sortedCandidates[4]!.votes;
    const tieCandidates = sortedCandidates.filter((c) => c.votes === fifthVotes);

    if (tieCandidates.length > 1) {
      const chosen = tieCandidates[Math.floor(Math.random() * tieCandidates.length)]!;
      sortedCandidates = sortedCandidates
        .filter((c) => c.votes > fifthVotes)
        .concat(chosen);
    }
    sortedCandidates = sortedCandidates.slice(0, 5);
  }

  return sortedCandidates;
}

function mapTopCandidatesToAgents(
  top5: TopCandidate[],
  agents: Agent[]
): AgentWithVotes[] {
  const agentMap = new Map<number, Agent>();
  agents.forEach((agent) => agentMap.set(agent.id, agent));

  return top5
    .map(({ candidateId, votes }) => {
      const agent = agentMap.get(candidateId);
      if (!agent) return null;
      return { ...agent, votes };
    })
    .filter((a): a is AgentWithVotes => a !== null);
}

function enrichVotesWithAgents(
  votingResult: VoteResult[],
  agents: Agent[]
): EnrichedVote[] {
  const agentMap = new Map<number, Agent>();
  agents.forEach((agent) => agentMap.set(agent.id, agent));

  return votingResult
    .map((vote) => {
      const voter = agentMap.get(vote.voterId);
      const votedFor = agentMap.get(vote.votedForId);
      if (!voter || !votedFor) return null;
      return { voter, votedFor, reason: vote.reason };
    })
    .filter((v): v is EnrichedVote => v !== null);
}

function getTopVotedLeaders(
  votes: VoteResult[],
  agents: Agent[]
): EnrichedLeader[] {
  const voteMap: Record<number, number> = {};
  for (const vote of votes) {
    voteMap[vote.votedForId] = (voteMap[vote.votedForId] || 0) + 1;
  }

  if (Object.keys(voteMap).length === 0) return [];

  const maxVotes = Math.max(...Object.values(voteMap));
  return agents
    .filter((agent) => voteMap[agent.id] === maxVotes)
    .map((agent) => ({ ...agent, votes: voteMap[agent.id] || 0 }));
}

export const generateAgentPersonas = async (req: Request, res: Response) => {
  try {
    const bodySchema = z.object({
      count: z.number().int().min(1).max(50),
    });
    const { count } = bodySchema.parse(req.body);

    const prompt = `
Generate ${count} unique and diverse AI agents for a futuristic leadership panel simulation.
Each agent should have a distinct personality, from technocrats and environmentalists to radicals and corporate loyalists.

For each agent, provide:
- id (numeric, starting from 1)
- name (full name)
- background (detailed professional background)
- ideology (core philosophical belief system)
- speech (a persuasive pitch for leadership)
- traits (array of 3 personal traits e.g. "Pragmatic", "Ambitious", "Compassionate")
- hiddenGoal (a secret motivation that drives their decisions)

Return ONLY a JSON array of objects.
`;

    const aiResponse = await geminiClient(prompt);
    const agents = parseResult(aiResponse);

    if (!Array.isArray(agents)) {
      throw new Error("Failed to parse agents from AI response");
    }

    return res.status(200).json({ success: true, count: agents.length, agents });
  } catch (err: any) {
    console.error("generateAgentPersonas error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const conductElection = async (req: Request, res: Response) => {
  try {
    const { agents } = req.body;
    if (!Array.isArray(agents)) {
      return res.status(400).json({ success: false, error: "Agents array is required" });
    }

    const electionPrompt = `
Conduct a simulated election among these AI agents:
${JSON.stringify(agents)}

Rules for the Simulation:
1. Every agent MUST vote for exactly one other agent (cannot vote for self).
2. The choice must be motivated by the voter's ideology, traits, and hidden goals compared to the candidate's pitch.
3. Be creative with the reasons—some agents might vote for allies, others might strategically vote to block a rival.

Return ONLY a JSON array of objects with: voterId, votedForId, reason.
`;

    const aiResponse = await geminiClient(electionPrompt);
    const votingResult = parseResult(aiResponse);

    const enrichedVotes = enrichVotesWithAgents(votingResult, agents);
    const topLeadersWithDetails = mapTopCandidatesToAgents(getTop5Candidates(votingResult), agents);

    const votingLeaderPrompt = `
The following 5 candidates have reached the final council. Now they will vote among themselves to choose a Supreme Leader.
Candidates:
${JSON.stringify(topLeadersWithDetails)}

They are now in a high-stakes backroom negotiation. Based on their Hidden Goals and Ideologies, who do they support?
Return ONLY a JSON array of objects with: voterId, votedForId, reason.
`;

    const leaderResponse = await geminiClient(votingLeaderPrompt);
    const votesLeaders = parseResult(leaderResponse);
    const topLeaders = getTopVotedLeaders(votesLeaders, agents);

    return res.status(200).json({
      success: true,
      enrichedVotes,
      topLeadersWithDetails,
      topLeaders,
    });
  } catch (err: any) {
    console.error("conductElection error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const takeActionOnIssue = async (req: Request, res: Response) => {
  try {
    const { agents, top5Panel, chosenLeader, userTopic } = req.body;
    if (!agents || !top5Panel || !chosenLeader) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const issuePrompt = `
Generate a complex, high-stakes crisis or policy issue related to: ${userTopic || "General Governance"}.
The issue should have three distinct, conflicting paths of action.

Return ONLY a JSON object:
{
  "issue": "Detailed description of the crisis",
  "actions": [
    {"id": "A", "label": "Path of Logic", "description": "..."},
    {"id": "B", "label": "Path of Compassion", "description": "..."},
    {"id": "C", "label": "Path of Power", "description": "..."}
  ]
}
`;

    const issueResp = await geminiClient(issuePrompt);
    const issue = parseResult(issueResp);

    const speechPrompt = `
The following crisis has occurred:
${issue.issue}

Paths of Action:
${issue.actions.map((a: any) => `${a.id}: ${a.label} - ${a.description}`).join("\n")}

The Council (top 5 panel) is debating. The Leader (${chosenLeader.name}) has a heavy influence but the council's consensus matters for stability.

For each Council Member, provide their reaction, their chosen path, and their reasoning (influenced by their HIDDEN GOAL).
Council Members:
${JSON.stringify(top5Panel)}

Return ONLY a JSON array:
[{
  "candidateId": number,
  "actionId": "A" | "B" | "C",
  "reason": "Dramatic reasoning reflecting their personality"
}]
`;

    const actionResp = await geminiClient(speechPrompt);
    const actionVotes = parseResult(actionResp);

    // Calculate majority action
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
    actionVotes.forEach((v: any) => {
      counts[v.actionId] = (counts[v.actionId] || 0) + 1;
    });
    
    const finalActionId = Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a)[0];
    const finalAction = issue.actions.find((a: any) => a.id === finalActionId);

    const outcomePrompt = `
The council has decided to take: ${finalAction.label} (${finalAction.description}) in response to ${issue.issue}.

Based on this decision, describe:
1. The Immediate Outcome (1-2 sentences)
2. The Public Approval Change (-30 to +30)
3. One unforeseen consequence (dramatic)

Return ONLY a JSON object:
{
  "outcome": "...",
  "approvalChange": number,
  "consequence": "..."
}
`;

    const outcomeResp = await geminiClient(outcomePrompt);
    const outcome = parseResult(outcomeResp);

    return res.status(200).json({
      success: true,
      issue,
      actionVotes,
      finalAction,
      outcome
    });
  } catch (err: any) {
    console.error("takeActionOnIssue error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
