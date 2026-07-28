import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ModelType, ChatMessage, Conversation, ChatState } from '@/types';

// Re-export type definitions for backwards compatibility
export type { ModelType, ChatMessage, Conversation, ChatState };

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
            if (action.payload.length > 0) {
                if (!state.activeId || !action.payload.some(c => c.id === state.activeId)) {
                    state.activeId = action.payload[0]?.id || "";
                }
            } else {
                state.activeId = "";
            }
        },

        // Switch active conversation by ID
        setActiveId: (state, action: PayloadAction<string>) => {
            state.activeId = action.payload;
        },

        // Add a new conversation and automatically switch to it
        addConversation: (state, action: PayloadAction<Conversation>) => {
            state.conversations.unshift(action.payload);
            state.activeId = action.payload.id;
        },

        // Delete conversation by ID and reassign active ID if necessary
        deleteConversation: (state, action: PayloadAction<string>) => {
            state.conversations = state.conversations.filter(c => c.id !== action.payload);
            if (state.activeId === action.payload) {
                state.activeId = state.conversations[0]?.id || "";
            }
        },

        // Update conversation properties (e.g. title, model, selectedFile)
        updateConversation: (
            state,
            action: PayloadAction<{ id: string; updates: Partial<Conversation> }>
        ) => {
            const { id, updates } = action.payload;
            const convIndex = state.conversations.findIndex(c => c.id === id);
            if (convIndex !== -1 && state.conversations[convIndex]) {
                state.conversations[convIndex] = {
                    ...state.conversations[convIndex],
                    ...updates,
                };
            }
        },

        // Append a new message to a specific conversation
        addMessage: (
            state,
            action: PayloadAction<{ conversationId: string; message: ChatMessage }>
        ) => {
            const { conversationId, message } = action.payload;
            const conv = state.conversations.find(c => c.id === conversationId);
            if (conv) {
                conv.messages.push(message);
            }
        },

        // Clear all conversations
        clearAllConversations: (state) => {
            state.conversations = [];
            state.activeId = "";
        },
    },
});

export const {
    setConversations,
    setActiveId,
    addConversation,
    deleteConversation,
    updateConversation,
    addMessage,
    clearAllConversations,
} = chatSlice.actions;

export default chatSlice.reducer;
