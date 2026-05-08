import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, Code2, Terminal, Globe, Cpu, Menu, X, Sparkles } from "lucide-react";
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
          <span className="font-bold text-white text-sm tracking-tight">APEX</span>
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
              className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => setMobileSidebarOpen(false)} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden">
              <div className="relative h-full">
                <button onClick={() => setMobileSidebarOpen(false)}
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-lg" style={{ color: "var(--color-muted)" }}>
                  <X size={16} />
                </button>
                <Sidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="w-full max-w-[640px] mx-auto px-4 pt-14 pb-28">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-6"
            style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border2)", color: "var(--color-cyan)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            APEX Coding Agent · Online
          </div>
          <h1 className="text-4xl md:text-[52px] font-bold text-white mb-4 tracking-tight leading-[1.1]">
            What are we<br />
            <span style={{ color: "var(--color-cyan)" }}>building</span> today?
          </h1>
          <p className="text-base" style={{ color: "var(--color-muted)" }}>
            Describe your project. APEX plans, writes code, and executes autonomously.
          </p>
        </motion.div>

        {/* Input */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-3">
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border2)", boxShadow: "0 4px 32px rgba(0,0,0,0.3)" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKey}
              placeholder="e.g. Build a React dashboard with charts and a REST API backend..."
              rows={3}
              autoFocus
              className="w-full bg-transparent text-sm resize-none outline-none px-5 pt-4 pb-3"
              style={{ color: "var(--color-text)", lineHeight: 1.7, maxHeight: 160 }}
            />
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--color-border)" }}>
              <span className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>Enter to send · Shift+Enter for newline</span>
              <button
                onPointerDown={(e) => { e.preventDefault(); handleStart(); }}
                disabled={!input.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: input.trim() ? "var(--color-cyan2)" : "var(--color-surface3)",
                  color: input.trim() ? "#000" : "var(--color-muted)",
                  opacity: input.trim() ? 1 : 0.5,
                }}>
                <ArrowRight size={15} />
                Start
              </button>
            </div>
          </div>
        </motion.div>

        {/* Suggestions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }} className="flex flex-wrap gap-2 mb-10">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onPointerDown={(e) => { e.preventDefault(); handleStart(s); }}
              className="px-3 py-1.5 rounded-lg text-xs transition-all text-left"
              style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border2)"; (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.color = "var(--color-muted)"; }}>
              {s}
            </button>
          ))}
        </motion.div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={13} style={{ color: "var(--color-cyan)" }} />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>Quick Start</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {skills.map((skill, i) => (
                <motion.button key={skill.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  onPointerDown={(e) => { e.preventDefault(); handleStart(skill.prompt); }}
                  className="flex flex-col items-start gap-2.5 p-4 rounded-xl text-left transition-all group"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border2)"; (e.currentTarget as HTMLElement).style.background = "var(--color-surface2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}>
                  <span className="text-xl">{skill.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{skill.name}</div>
                    <div className="text-xs mt-1 leading-snug" style={{ color: "var(--color-muted)" }}>{skill.description}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: <Code2 size={14} />, label: "Monaco Editor", desc: "Full syntax highlighting" },
            { icon: <Terminal size={14} />, label: "Live Terminal", desc: "Streaming shell output" },
            { icon: <Globe size={14} />, label: "Browser Preview", desc: "Live web preview" },
            { icon: <Cpu size={14} />, label: "11 Agent Tools", desc: "Files, search & more" },
          ].map((f, i) => (
            <div key={i} className="p-3.5 rounded-xl flex items-center gap-3"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <div style={{ color: "var(--color-cyan)", flexShrink: 0 }}>{f.icon}</div>
              <div>
                <div className="text-xs font-semibold text-white">{f.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
