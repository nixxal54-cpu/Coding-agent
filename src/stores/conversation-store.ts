import { create } from "zustand";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: string;
  message_count: number;
  model?: string;
  pinned?: boolean;
  tags?: string[];
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (c: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  removeConversation: (id: string) => void;
  updateConversation: (id: string, data: Partial<Conversation>) => void;
  upsertConversation: (c: Conversation) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  removeConversation: (id) => set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) })),
  updateConversation: (id, data) => set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? { ...c, ...data } : c) })),
  upsertConversation: (conv) => set((s) => {
    const exists = s.conversations.find((c) => c.id === conv.id);
    return { conversations: exists ? s.conversations.map((c) => c.id === conv.id ? conv : c) : [conv, ...s.conversations] };
  }),
}));
