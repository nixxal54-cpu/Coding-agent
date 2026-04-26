import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, Code2, Terminal, Globe, Cpu, Menu, X } from "lucide-react";
import { createConversation, getSkills } from "@/src/api/conversations";
import { useConversationStore } from "@/src/stores/conversation-store";
import { useSettingsStore } from "@/src/stores/settings-store";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "@/src/components/layout/Sidebar";

const SUGGESTIONS = [
  "Build a full-stack todo app with React + Express",
  "Create a REST API with authentication and JWT",
  "Debug and fix all errors in my workspace",
  "Create a Python web scraper with BeautifulSoup",
];

export default function Home() {
  const navigate = useNavigate();
  const { conversations, setConversations } = useConversationStore();
  const { selectedModel } = useSettingsStore();
  const [input, setInput] = React.useState("");
  const [skills, setSkills] = React.useState<any[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => { getSkills().then(setSkills); }, []);

  const handleStart = async (msg?: string) => {
    const content = msg || input;
    if (!content.trim()) return;
    const conv = await createConversation({ title: content.slice(0, 60), model: selectedModel });
    setConversations([conv, ...conversations]);
    sessionStorage.setItem(`initial_msg_${conv.id}`, content);
    navigate(`/conversations/${conv.id}`);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleStart(); }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--color-bg)" }}>
      {/* Mobile top bar */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 border-b sticky top-0 z-10"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--color-cyan2)" }}>
            <Zap size={14} color="#000" fill="#000" />
          </div>
          <span className="font-bold text-white">APEX</span>
        </div>
        <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-lg" style={{ color: "var(--color-muted)" }}>
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setMobileSidebarOpen(false)} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden">
              <div className="relative h-full">
                <button onClick={() => setMobileSidebarOpen(false)}
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-lg" style={{ color: "var(--color-muted)" }}>
                  <X size={18} />
                </button>
                <Sidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="w-full max-w-2xl mx-auto px-4 pt-12 pb-24">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-5"
            style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-cyan)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            APEX Coding Agent · Online
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight leading-tight">
            What are we <span style={{ color: "var(--color-cyan)" }}>building</span> today?
          </h1>
          <p className="text-base md:text-lg" style={{ color: "var(--color-muted)" }}>
            Describe your project. APEX plans, codes, and executes autonomously.
          </p>
        </motion.div>

        {/* Input */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4">
          <div className="flex items-end gap-2 rounded-2xl p-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKey}
              placeholder="e.g. Build a React dashboard with charts and a REST API backend..."
              rows={3}
              className="flex-1 bg-transparent text-sm resize-none outline-none"
              style={{ color: "var(--color-text)", lineHeight: 1.6, maxHeight: 160 }}
            />
            <button
              onPointerDown={(e) => { e.preventDefault(); handleStart(); }}
              disabled={!input.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{ background: input.trim() ? "var(--color-cyan2)" : "var(--color-surface3)", opacity: input.trim() ? 1 : 0.4 }}>
              <ArrowRight size={18} color={input.trim() ? "#000" : "var(--color-muted)"} />
            </button>
          </div>
        </motion.div>

        {/* Suggestions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2 mb-10">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onPointerDown={(e) => { e.preventDefault(); handleStart(s); }}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors text-left"
              style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
              {s}
            </button>
          ))}
        </motion.div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-muted)" }}>
              Quick Start Skills
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {skills.map((skill, i) => (
                <motion.button key={skill.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  onPointerDown={(e) => { e.preventDefault(); handleStart(skill.prompt); }}
                  className="flex flex-col items-start gap-2 p-3.5 rounded-xl text-left transition-all"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                  <span className="text-xl">{skill.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{skill.name}</div>
                    <div className="text-xs mt-0.5 leading-snug" style={{ color: "var(--color-muted)" }}>{skill.description}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: <Code2 size={15} />, label: "Monaco Editor", desc: "Syntax highlighting" },
            { icon: <Terminal size={15} />, label: "Live Terminal", desc: "Streaming shell" },
            { icon: <Globe size={15} />, label: "Browser Preview", desc: "Live web preview" },
            { icon: <Cpu size={15} />, label: "11 Agent Tools", desc: "Files, search & more" },
          ].map((f, i) => (
            <div key={i} className="p-3 rounded-xl flex items-center gap-3"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <div className="flex-shrink-0" style={{ color: "var(--color-cyan)" }}>{f.icon}</div>
              <div>
                <div className="text-xs font-semibold text-white">{f.label}</div>
                <div className="text-xs" style={{ color: "var(--color-muted)" }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
