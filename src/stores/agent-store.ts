import { create } from "zustand";

export type AgentStatus = "idle" | "running" | "error";

interface AgentState {
  status: AgentStatus;
  setStatus: (s: AgentStatus) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
}));
