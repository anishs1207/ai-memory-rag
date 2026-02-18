// import type { Request, Response } from "express";

// // - Short-term (conversation state)
// // - Long-term (vector memory)
// // - Episodic vs semantic memory
// // - Knowledge graphs

// const addPromptToMemory = async (req: Request, res: Response) => {
//   try {
//     const { conversationId, prompt, userId } = req.body;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         error: "userId is not given",
//       });
//     }

//     if (!conversationId || !prompt) {
//       return res.status(400).json({
//         error: "",
//       });
//     }

//     // store in db for conversationbId and userId also

//     // so that it can be gotten for it

//     // now add in the vector db also here

//     // also add in the KG (knolege graphs)

//     // added
//   } catch (err) {}
// };

// const recallMemoryGivenPrompt = async (req: Request, res: Response) => {
//   // get the prompt which the user has written here
//   // also get the all or K no,of  oncversation from teh igven convesationbId
//   // also get from rag to retuver the stuff here
//   // also kneolege base to get and return the prompt for the memory
// };

// export {addPromptToMemory, recallMemoryGivenPrompt};