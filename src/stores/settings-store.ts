import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  selectedModel: string;
  sidebarOpen: boolean;
  theme: "dark" | "light";
  fontSize: number;
  setSelectedModel: (m: string) => void;
  setSidebarOpen: (v: boolean) => void;
  setFontSize: (n: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      selectedModel: "llama-3.3-70b-versatile",
      sidebarOpen: true,
      theme: "dark",
      fontSize: 13,
      setSelectedModel: (selectedModel) => set({ selectedModel }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setFontSize: (fontSize) => set({ fontSize }),
    }),
    { name: "apex-settings" }
  )
);
