import { create } from "zustand";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface ToolEvent {
  type: "tool_use" | "tool_result";
  tool: string;
  args?: Record<string, unknown>;
  result?: string;
  timestamp: string;
}

interface EventState {
  messages: AgentMessage[];
  toolEvents: ToolEvent[];
  addMessage: (msg: AgentMessage) => void;
  appendToken: (id: string, token: string) => void;
  finalizeMessage: (id: string) => void;
  addToolEvent: (event: ToolEvent) => void;
  clearAll: () => void;
}

export const useEventStore = create<EventState>((set) => ({
  messages: [],
  toolEvents: [],
  addMessage: (msg) => set((s) => {
    // Prevent adding same message twice
    if (s.messages.find(m => m.id === msg.id)) return s;
    return { messages: [...s.messages, msg] };
  }),
  appendToken: (id, token) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token, isStreaming: true } : m
      ),
    })),
  finalizeMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false } : m
      ),
    })),
  addToolEvent: (event) =>
    set((s) => ({ toolEvents: [...s.toolEvents, event] })),
  clearAll: () => set({ messages: [], toolEvents: [] }),
}));
