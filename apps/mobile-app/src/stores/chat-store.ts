import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Conversation } from "../lib/api";
import { asyncStorageAdapter } from "../lib/storage";

type ConversationUpdate = Partial<Omit<Conversation, "id">>;

type ChatStore = {
  conversations: Conversation[];
  activeId: string;
  hasHydrated: boolean;
  savedPrompts: string[];
  createChat: () => string;
  deleteChat: (id: string) => void;
  selectChat: (id: string) => void;
  updateChat: (id: string, update: ConversationUpdate) => void;
  renameChat: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  duplicateChat: (id: string) => string;
  clearChats: () => void;
  savePrompt: (prompt: string) => void;
  removePrompt: (prompt: string) => void;
  setHasHydrated: (value: boolean) => void;
};

const createConversation = (): Conversation => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "New conversation",
  model: "general",
  messages: [],
  timestamp: Date.now(),
  llm: "gemini",
});

const initialConversation = createConversation();

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      conversations: [initialConversation],
      activeId: initialConversation.id,
      hasHydrated: false,
      savedPrompts: [],

      createChat: () => {
        const chat = createConversation();
        set((state) => ({
          conversations: [chat, ...state.conversations],
          activeId: chat.id,
        }));
        return chat.id;
      },

      deleteChat: (id) => {
        set((state) => {
          const remaining = state.conversations.filter((chat) => chat.id !== id);
          const conversations = remaining.length > 0 ? remaining : [createConversation()];
          const activeId =
            state.activeId === id || !conversations.some((chat) => chat.id === state.activeId)
              ? conversations[0]!.id
              : state.activeId;

          return { conversations, activeId };
        });
      },

      selectChat: (id) => {
        set((state) =>
          state.conversations.some((chat) => chat.id === id) ? { activeId: id } : state
        );
      },

      updateChat: (id, update) => {
        set((state) => ({
          conversations: state.conversations.map((chat) =>
            chat.id === id ? { ...chat, ...update } : chat
          ),
        }));
      },

      renameChat: (id, title) =>
        set((state) => ({
          conversations: state.conversations.map((chat) =>
            chat.id === id ? { ...chat, title: title.trim() || "New conversation" } : chat
          ),
        })),

      togglePin: (id) =>
        set((state) => ({
          conversations: state.conversations.map((chat) =>
            chat.id === id ? { ...chat, pinned: !chat.pinned } : chat
          ),
        })),

      duplicateChat: (id) => {
        const copyId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let duplicated = false;
        set((state) => {
          const source = state.conversations.find((chat) => chat.id === id);
          if (!source) return state;
          duplicated = true;
          const copy: Conversation = {
            ...source,
            id: copyId,
            title: `${source.title} copy`,
            timestamp: Date.now(),
            pinned: false,
            messages: source.messages.map((message) => ({ ...message, id: `${message.id}-copy` })),
          };
          return { conversations: [copy, ...state.conversations], activeId: copy.id };
        });
        return duplicated ? copyId : "";
      },

      clearChats: () => {
        const chat = createConversation();
        set({ conversations: [chat], activeId: chat.id });
      },

      savePrompt: (prompt) =>
        set((state) => ({
          savedPrompts: state.savedPrompts.includes(prompt.trim())
            ? state.savedPrompts
            : [prompt.trim(), ...state.savedPrompts].slice(0, 12),
        })),

      removePrompt: (prompt) =>
        set((state) => ({ savedPrompts: state.savedPrompts.filter((item) => item !== prompt) })),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "inqora-chat-store",
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: ({ conversations, activeId, savedPrompts }) => ({ conversations, activeId, savedPrompts }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        if (state.conversations.length === 0) {
          state.createChat();
        } else if (!state.conversations.some((chat) => chat.id === state.activeId)) {
          state.selectChat(state.conversations[0]!.id);
        }
        state.setHasHydrated(true);
      },
    }
  )
);
