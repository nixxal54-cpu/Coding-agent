import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowRight, Zap, Code2, Terminal, Globe, Cpu } from "lucide-react";
import { createConversation, getSkills } from "@/src/api/conversations";
import { useConversationStore } from "@/src/stores/conversation-store";
import { useSettingsStore } from "@/src/stores/settings-store";
import { motion } from "motion/react";

const SUGGESTIONS = [
  "Build a full-stack todo app with React + Express",
  "Create a REST API with authentication and JWT",
  "Debug and fix all errors in my workspace",
  "Create a Python web scraper with BeautifulSoup",
  "Set up a Next.js app with a database",
];

export default function Home() {
  const navigate = useNavigate();
  const { conversations, setConversations } = useConversationStore();
  const { selectedModel } = useSettingsStore();
  const [input, setInput] = React.useState("");
  const [skills, setSkills] = React.useState<any[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    getSkills().then(setSkills);
    textareaRef.current?.focus();
  }, []);

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

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-3xl px-6 pt-20 pb-32">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-6" style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-cyan)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            APEX Coding Agent · Online
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">What are we <span style={{ color: "var(--color-cyan)" }}>building</span> today?</h1>
          <p className="text-lg" style={{ color: "var(--color-muted)" }}>Describe your project. APEX will plan, code, and execute autonomously.</p>
        </motion.div>

        {/* Input */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative mb-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="e.g. Build a React dashboard with charts, authentication, and a REST API backend..."
            rows={4}
            className="w-full rounded-2xl p-5 pr-16 text-base resize-none outline-none transition-all"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)", lineHeight: 1.6 }}
            onFocus={(e) => { e.target.style.borderColor = "var(--color-cyan2)"; e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.1)"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--color-border)"; e.target.style.boxShadow = "none"; }}
          />
          <button onClick={() => handleStart()} disabled={!input.trim()} className="absolute bottom-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30" style={{ background: "var(--color-cyan2)", color: "#000" }}>
            <ArrowRight size={18} />
          </button>
        </motion.div>

        {/* Suggestions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-2 mb-12">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => handleStart(s)} className="px-3 py-1.5 rounded-lg text-sm transition-colors" style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "var(--color-text)"; (e.target as HTMLElement).style.borderColor = "var(--color-border2)"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--color-muted)"; (e.target as HTMLElement).style.borderColor = "var(--color-border)"; }}
            >
              {s}
            </button>
          ))}
        </motion.div>

        {/* Skills Grid */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--color-muted)" }}>Quick Start Skills</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {skills.map((skill, i) => (
              <motion.button
                key={skill.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => handleStart(skill.prompt)}
                className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-cyan2)"; (e.currentTarget as HTMLElement).style.background = "var(--color-surface2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLElement).style.background = "var(--color-surface)"; }}
              >
                <span className="text-2xl">{skill.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-white">{skill.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{skill.description}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: <Code2 size={18} />, label: "Code Editor", desc: "Monaco editor with syntax highlighting" },
            { icon: <Terminal size={18} />, label: "Live Terminal", desc: "Streaming shell execution" },
            { icon: <Globe size={18} />, label: "Browser Preview", desc: "Live preview of web apps" },
            { icon: <Cpu size={18} />, label: "11 Tools", desc: "Files, search, web, git & more" },
          ].map((f, i) => (
            <div key={i} className="p-3 rounded-xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <div className="mb-2" style={{ color: "var(--color-cyan)" }}>{f.icon}</div>
              <div className="text-sm font-medium text-white">{f.label}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
