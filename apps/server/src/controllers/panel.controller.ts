// import type { Request, Response } from "express";
// import { z } from "zod";
// import {geminiClient, parseResult} from "@/utils/index.js";

// type Agent = {
//   id: number;
//   name: string;
//   background: string;
//   ideology: string;
//   speech: string;
// };

// type Vote = {
//   voterId: number;
//   votedForId: number;
//   reason: string;
// };

// type ElectionResult = {
//   agents: Agent[];
//   votes: Vote[];
//   topLeaders: Agent[];
//   leaderSpeeches: { [leaderId: number]: string };
// };

// type TopLeaderResult = {
//   candidateId: number;
//   votes: number;
// };

// type AgentWithVotes = Agent & {
//   votes: number;
// };

// type VoteResult = {
//   voterId: number;
//   votedForId: number;
//   reason: string;
// };

// type EnrichedVote = {
//   voter: Agent;
//   votedFor: Agent;
//   reason: string;
// };

// type TopCandidate = {
//   candidateId: number;
//   votes: number;
// };

// type EnrichedLeader = Agent & {
//   votes: number;
// };

// const agentSchema = z.object({
//   id: z.number().int().min(1),
//   name: z.string().min(1),
//   background: z.string().min(1),
//   ideology: z.string().min(1),
//   speech: z.string().min(1),
// });

// function getTop5Candidates(votes: Vote[]): TopCandidate[] {
//   // Count votes
//   const voteCount: Record<number, number> = {};
//   votes.forEach((v) => {
//     voteCount[v.votedForId] = (voteCount[v.votedForId] || 0) + 1;
//   });

//   // Convert to array and sort by votes descending
//   let sortedCandidates: TopCandidate[] = Object.keys(voteCount).map(Number).map((id) => ({
//     candidateId: id,
//     votes: voteCount[id],
//   }));

//   sortedCandidates.sort((a, b) => b.votes - a.votes);

//   // Handle ties for the 5th place
//   if (sortedCandidates.length > 5) {
//     const fifthVotes = sortedCandidates[4].votes;
//     const tieCandidates = sortedCandidates.filter((c) => c.votes === fifthVotes);

//     if (tieCandidates.length > 1) {
//       // Randomly pick one among tied candidates
//       const chosen = tieCandidates[Math.floor(Math.random() * tieCandidates.length)];
//       // Keep all above 5th place, replace 5th with chosen
//       sortedCandidates = sortedCandidates
//         .filter((c) => c.votes > fifthVotes)
//         .concat(chosen);
//     }

//     // Take top 5
//     sortedCandidates = sortedCandidates.slice(0, 5);
//   }

//   return sortedCandidates;
// }

// function mapTopCandidatesToAgents(
//   top5: TopCandidate[],
//   agents: Agent[]
// ): AgentWithVotes[] {
//   // Create lookup for agents by id
//   const agentMap = new Map<number, Agent>();
//   agents.forEach((agent) => agentMap.set(agent.id, agent));

//   // Merge vote count into agent object
//   return top5
//     .map(({ candidateId, votes }) => {
//       const agent = agentMap.get(candidateId);
//       if (!agent) return null;

//       return {
//         ...agent,
//         votes,
//       };
//     })
//     .filter((a): a is AgentWithVotes => a !== null);
// }

// function enrichVotesWithAgents(
//   votingResult: VoteResult[],
//   agents: Agent[]
// ): EnrichedVote[] {
//   const agentMap = new Map<number, Agent>();
//   agents.forEach((agent) => agentMap.set(agent.id, agent));

//   return votingResult
//     .map((vote) => {
//       const voter = agentMap.get(vote.voterId);
//       const votedFor = agentMap.get(vote.votedForId);

//       if (!voter || !votedFor) return null;

//       return {
//         voter,
//         votedFor,
//         reason: vote.reason,
//       };
//     })
//     .filter((v): v is EnrichedVote => v !== null);
// }

// function getTopVotedLeaders(
//   votes: Vote[],
//   agents: Agent[]
// ): EnrichedLeader[] {
//   // Count votes per candidate
//   const voteMap: Record<number, number> = {};

//   for (const vote of votes) {
//     voteMap[vote.votedForId] =
//       (voteMap[vote.votedForId] || 0) + 1;
//   }

//   if (Object.keys(voteMap).length === 0) return [];

//   // Find max votes
//   const maxVotes = Math.max(...Object.values(voteMap));

//   // Enrich top leaders with agent data
//   return agents
//     .filter(
//       (agent) => voteMap[agent.id] === maxVotes
//     )
//     .map((agent) => ({
//       ...agent,
//       votes: voteMap[agent.id],
//     }));
// }

// export const generateAgentPersonas = async (req: Request, res: Response) => {
//   try {
//     // Validate input using zod
//     const bodySchema = z.object({
//       count: z.number().int().min(1).max(50),
//     });

//     const { count } = bodySchema.parse(req.body);

//     // Prepare prompt for Gemini
//     const prompt = `
// Generate ${count} unique AI agents for a leadership panel simulation.
// For each agent, provide:
// - id (numeric, starting from 1)
// - name (full name)
// - background (short paragraph)
// - ideology (short paragraph)
// - speech (short speech on why agent thinks they should be elected, basaed on basckgroudn and ideology)
// Return the result as a JSON array of objects like:
// [
//   {
//     "id": 1,
//     "name": "John Doe",
//     "background": "...",
//     "ideology": "...",
//     "speech": "..."
//   }
// ]
// Ensure the JSON is parseable and complete.
// `;

//     // Call Gemini API
//     const result = await ai.models.generateContent({
//       model: "gemini-2.5-flash",
//       contents: [createUserContent(prompt)],
//     });

//     console.log(result.response?.text?.());

//     // Extract text from response
//     const responseText = result.response?.text?.() || "";

//     // Try to parse the JSON safely
//     let agents: Agent[] = [];
//     try {
//       agents = JSON.parse(responseText);
//     } catch (e) {
//       console.error("Failed to parse agents JSON:", e);
//       return res.status(500).json({
//         success: false,
//         error: "Failed to parse agent personas from AI response",
//         rawResponse: responseText,
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       count: agents.length,
//       agents,
//     });
//   } catch (err: any) {
//     console.error("Error in generateAgentPersonas:", err);
//     return res.status(500).json({
//       success: false,
//       error: err.message || "Internal server error",
//     });
//   }
// };

// export const conductElection = async (req: Request, res: Response) => {
//   try {
//     const { agents } = req.body;

//     let allValid = true;

//     agents.forEach((agent: Agent) => {
//         const result = agentSchema.safeParse(agent);
//         if (!result.success) {
//             allValid = false;
//             return {
//                 success: false,
//                 error: "One or more agents failed validation.",
//             }
//         }
//     });
   
//     if (!allValid) {
//       return res.status(400).json({
//         success: false,
//         error: "One or more agents failed validation.",
//       });
//     } 

//     const electionPrompt = `
//     <scenario>
//         Conduct an Election for the following people,
//         Based on a candidate's background, ideology, and speech & user's
//         background & ideology make them choose whom to vote for.
//     </scenario>

//     <agents>
//     These are the agents that will be voting for each other:
//      ${JSON.stringify(agents)}
    
//     NOTE: 
//     1. user cannot vote for themselves
//     2. voting criteria is based on user's ideology & background & speech and candidate's ideology & background & speech
   
//     </agents>

//     <detail>
//         voterId: the id of the voter
//         votedForId: the id of the canidate that user has voted for
//         reason: 
//         - why the user has voted for that candidate (in 1-2 lines), which should be 
//         - based on user's ideology & background & speech and candidate's ideology & background & speech (you can take names for that candidate vs other canidates also)
//     </detail>

//     <output>
//     Return the result as a JSON array of objects like:
//     [
//       {
//         "voterId": 1,
//         "votedForId": 2,
//         "reason": "..."
//       }
//     ]
//     </output>
//     `;

//     const result = await geminiClient(electionPrompt);

//     if (!result) {
//         return res.status(500).json({
//             success: false,
//             error: "Failed to generate election results",
//         });
//     } 

//     const votingResult = parseResult(result);

//     const enrichedVotes = enrichVotesWithAgents(votingResult, agents);
//     // TRODO RETURN: it includes all all agents with whom they voted 

//     const topLeadersWithDetails = mapTopCandidatesToAgents(getTop5Candidates(votingResult), agents);
//     // TRODO RETURN: top 5 leaders and asosicated habuour and idloy etc

//     const votingLeaderPrompt = `
//     <scenario>
//         Given the top5 choosen people, now they vote to choose a leader
//     </scenario>

//     <candidates>
//     Following are the top 5 choosen candidates by the people, 
//     Now according to each of their background, ideology, and speech & other candidate's
//     background & ideology make them choose whom to vote for.

//     ${JSON.stringify(topLeadersWithDetails)}
//     </candidates>

//     <detail>
//         voterId: the id of the voter
//         votedForId: the id of the canidate that user has voted for
//         reason: 
//         - why the user has voted for that candidate (in 1-2 lines), which should be 
//         - based on user's ideology & background & speech and candidate's ideology & background & speech (you can take names for that candidate vs other canidates also)
//     </detail>

//     <output>
//     Return the result as a JSON array of objects like:
//     [
//       {
//         "voterId": 1,
//         "votedForId": 2,
//         "reason": "..."
//       }
//     ]
//     </output>
//     `;

//     const speechResp = await geminiClient(votingLeaderPrompt);

//     if (!speechResp) {
//         return res.status(500).json({
//             success: false,
//             error: "Failed to generate election results",
//         });
//     }

//     const votesLeaders = parseResult(speechResp);

//     const topLeaders = getTopVotedLeaders(votesLeaders, agents);

//     return res.status(200).json({
//         success: true,
//         // return the enriched agents
//         enrichedVotes,
//         // enriched leaders 5
//         topLeadersWithDetails,
//         // return the top leaders enriched
//         topLeaders,
//     })

//   } catch (err: any) {
//     console.error("simulateElection error:", err);
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// export const takeActionOnIssue = async(req:Request, res: Response) => {
//     try {
//         const {agents, top5Panel, choosenLeader} = req.body; 

//         if (!agents || !top5Panel || !choosenLeader) {
//             return res.status(400).json({
//                 success: false,
//                 error: "Missing required fields",
//             })
//         }
//         // also handle validations for these fields
//         // generate an issue &  and 5 actions which can be taken

//         const issuePrompt = `
//         <scenario>
//         Generate an issue and 5 actions which can be taken
//         </scenario>
        
//         <detail>
//         issue: the issue that needs to be addressed
//         actions: 3 actions which can be taken to address the issue
//         </detail>
        
//         <output>
//         Return the result as a JSON object like:
//         {
//             "issue": "...",
//             "actions": ["...", "...", "..."]
//         }
//         </output>
//         `;

//         const issueResp = await geminiClient(issuePrompt);

//         if (!issueResp) {
//             return res.status(500).json({
//                 success: false,
//                 error: "Failed to generate issue",
//             })
//         }

//         const issue = parseResult(issueResp);

//         if (!issue) {
//             return res.status(500).json({
//                 success: false,
//                 error: "Failed to generate issue",
//             })
//         }

//         // now we have the issues and now we want each person to hold their view on that they think is the best option to take

//         const speechPrompt = `
//         <scenario>
//     Now each of the top5 panel voted by the public are voting on what action to 
//     take on this action

//     ${JSON.stringify(issue)}
//         </scenario>
        
//         <detail>
//         issue: the issue that needs to be addressed
//         actions: 3 actions which can be taken to address the issue
//         </detail>
        
//         <output>
//         Return the result as a JSON object like:
//             [{
//                 canidateId: 1,
//                 actionVoted: ""
//                 reason: ""
//             }]
//         </output>
//         `;

       
//         // and all have eqaul vote and vote which option they want to choose
//         // and ensure no tie


//         // and then once choosen on what to do takes that actions

//         const reactioPrompt = `
//         <scenario>
//         The top 5 panel has takes the action for this iussuel, now
//         based on each candidate, their background, ideology, speech and 
//         which action they would take and the reason why
//         </scenario>

//         <output>
//         JSON 
//         [{
//             agentId: 1,
//             actionTaken: "",
//             reason: ""
//         }]
//         </output>
//         `;

//         // function to coutn up the votes etc

        
//         // then see the reaction of that see views of people basaed on what action they think should be taen
//         // and then based on that see it reflects public option
//         // the decsion should be taken based on their own odieloy & heavbuour etc
//         // then see what the public thunks about it and then based on that it see it majuoity opntin i s astiy
//         // END THERE ONLY
        
        
//         // each leader tells which action to take and why
//         // and then each canidate vote

//     } catch(err) {

//     }
// }



//     // "votes": [
//     // {
//     //   "voter": {
//     //     "id": 1,
//     //     "name": "Aarav Patel",
//     //     "background": "Urban policy researcher...",
//     //     "ideology": "Data-driven governance...",
//     //     "speech": "Leadership must be rational..."
//     //   },
//     //   "votedFor": {
//     //     "id": 2,
//     //     "name": "Riya Sharma",
//     //     "background": "Grassroots organizer...",
//     //     "ideology": "Social equity...",
//     //     "speech": "Our future depends on..."
//     //   },
//     //   "reason": "Strong alignment with social equity goals"
//     // }




// // [{
// //         "id": 1,
// //         "name": "Aarav Patel",
// //         "background": "Urban policy researcher...",
// //         "ideology": "Data-driven governance...",
// //         "speech": "Leadership must be rational..."
// //       }]

