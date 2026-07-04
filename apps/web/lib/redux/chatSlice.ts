import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ModelType = "general" | "finance" | "legal" | "pdf" | "budget" | "research";

export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    error?: boolean;
    reasoning?: {
        steps: {
            title: string;
            content: string;
            status: "complete" | "running" | "pending";
        }[];
    };
    toolCalls?: {
        name: string;
        args: Record<string, any>;
        status: "pending" | "success" | "error";
    }[];
    requiresConfirmation?: boolean;
    confirmed?: boolean;
    pdfUrl?: string;
};

export type Conversation = {
    id: string;
    title: string;
    model: ModelType;
    messages: ChatMessage[];
    selectedFile?: string;
    timestamp: number;
    llm?: "gemini" | "smollm";
};

export interface ChatState {
    conversations: Conversation[];
    activeId: string;
}

const initialState: ChatState = {
    conversations: [],
    activeId: "",
};

export const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        // Hydrate conversation state from localStorage or initial setup
        setConversations: (state, action: PayloadAction<Conversation[]>) => {
            state.conversations = action.payload;
            // Set active ID if not set or if current active ID is not in new list
            if (action.payload.length > 0) {
                if (!state.activeId || !action.payload.some(c => c.id === state.activeId)) {
                    state.activeId = action.payload[0]?.id || "";
                }
            } else {
                state.activeId = "";
            }
        },
        // Change the current active chat session ID
        setActiveId: (state, action: PayloadAction<string>) => {
            state.activeId = action.payload;
        },
        // Adds a new conversation and sets it as the active one
        addConversation: (state, action: PayloadAction<Conversation>) => {
            state.conversations = [action.payload, ...state.conversations];
            state.activeId = action.payload.id;
        },
        // Deletes a conversation by ID, updating active ID if needed
        deleteConversation: (state, action: PayloadAction<string>) => {
            const idToDelete = action.payload;
            state.conversations = state.conversations.filter(c => c.id !== idToDelete);
            
            // If the deleted conversation was the active one, pick the next/first one or reset
            if (state.activeId === idToDelete) {
                if (state.conversations.length > 0) {
                    state.activeId = state.conversations[0]?.id || "";
                } else {
                    state.activeId = "";
                }
            }
        },
        // Updates a conversation's specific properties
        updateConversation: (state, action: PayloadAction<{ id: string; updates: Partial<Conversation> }>) => {
            const { id, updates } = action.payload;
            state.conversations = state.conversations.map(c => 
                c.id === id ? { ...c, ...updates } : c
            );
        },
    },
});

export const {
    setConversations,
    setActiveId,
    addConversation,
    deleteConversation,
    updateConversation,
} = chatSlice.actions;

export default chatSlice.reducer;
