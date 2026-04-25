import { create } from "zustand";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: string;
  message_count?: number;
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (c: Conversation[]) => void;
  addConversation: (c: Conversation) => void;
  removeConversation: (id: string) => void;
  setActiveConversationId: (id: string | null) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  addConversation: (c) => set((s) => ({ conversations: [c, ...s.conversations] })),
  removeConversation: (id) =>
    set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) })),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
}));
