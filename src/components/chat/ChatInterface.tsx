import React from "react";
import {
  Send, Square, Bot, User, ChevronDown, ChevronRight,
  CheckCircle2, Terminal as TerminalIcon, FileText, Search,
  Globe, FolderOpen, Pencil, Trash2, Move, ChevronUp, Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useEventStore, AgentMessage } from "@/src/stores/event-store";
import { useAgentStore } from "@/src/stores/agent-store";
import { sendAgentMessage } from "@/src/socket/socket";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useSettingsStore } from "@/src/stores/settings-store";
import { getModels } from "@/src/api/conversations";

const TOOL_ICONS: Record<string, any> = {
  run_command: TerminalIcon, read_file: FileText, write_file: FileText, edit_file: Pencil,
  list_files: FolderOpen, delete_file: Trash2, search_files: Search, create_directory: FolderOpen,
  move_file: Move, get_project_info: Bot, web_search: Globe,
};
const TOOL_COLORS: Record<string, string> = {
  run_command: "var(--color-yellow)", read_file: "var(--color-cyan)", write_file: "var(--color-green)",
  edit_file: "var(--color-purple)", list_files: "var(--color-cyan)", delete_file: "var(--color-red)",
  search_files: "var(--color-cyan)", web_search: "var(--color-cyan)", create_directory: "var(--color-green)",
  move_file: "var(--color-yellow)", get_project_info: "var(--color-purple)",
};

export default function ChatInterface({ conversationId }: { conversationId: string }) {
  const [input, setInput] = React.useState("");
  const { messages, toolEvents } = useEventStore();
  const { status, reset } = useAgentStore();
  const { selectedModel, setSelectedModel } = useSettingsStore();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [modelPickerOpen, setModelPickerOpen] = React.useState(false);
  const [models, setModels] = React.useState<any[]>([]);
  const modelPickerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { reset(); }, [conversationId]);
  React.useEffect(() => { getModels().then(setModels); }, []);

  // Close picker on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  React.useEffect(() => { if (atBottom) scrollToBottom(); }, [messages, toolEvents]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAtBottom(scrollHeight - scrollTop - clientHeight < 60);
  };

  const send = React.useCallback(() => {
    const text = input.trim();
    if (!text || status === "running") return;
    sendAgentMessage(conversationId, text, selectedModel);
    setInput("");
    if (textRef.current) textRef.current.style.height = "auto";
  }, [input, status, conversationId, selectedModel]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isRunning = status === "running";
  const hasInput = input.trim().length > 0;
  const currentModel = models.find((m) => m.id === selectedModel);
  const displayModelName = currentModel?.name ?? selectedModel.split("-").slice(0, 3).join(" ");

  return (
    <div className="flex flex-col h-full relative" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="h-12 flex items-center px-4 gap-3 border-b z-10"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0 transition-all",
          isRunning ? "bg-green-400 animate-pulse" : "bg-gray-600")} />
        <span className="text-sm font-semibold">Agent Chat</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono"
            style={{ background: "var(--color-surface2)", color: "var(--color-cyan)", border: "1px solid var(--color-border)" }}>
            <Zap size={10} />
            Groq
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40 py-20">
            <Bot size={36} />
            <p className="text-sm">Describe your project to start.</p>
          </div>
        ) : (
          messages.map((msg) => <MessageItem key={msg.id} msg={msg} />)
        )}
      </div>

      {/* Input Area */}
      <div className="relative z-50 border-t p-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>

        {/* Model Picker Popup */}
        <AnimatePresence>
          {modelPickerOpen && (
            <motion.div
              ref={modelPickerRef}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl overflow-hidden z-50"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "0 -8px 32px rgba(0,0,0,0.4)" }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
                  Select Model · Groq
                </p>
              </div>
              <div className="p-2 max-h-72 overflow-y-auto">
                {models.map((m) => (
                  <button
                    key={m.id}
                    onPointerDown={(e) => { e.preventDefault(); setSelectedModel(m.id); setModelPickerOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: selectedModel === m.id ? "rgba(14,165,233,0.1)" : "transparent",
                      border: `1px solid ${selectedModel === m.id ? "var(--color-cyan2)" : "transparent"}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: selectedModel === m.id ? "white" : "var(--color-text)" }}>
                          {m.name}
                        </span>
                        {m.recommended && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                            style={{ background: "rgba(14,165,233,0.15)", color: "var(--color-cyan)" }}>★ best</span>
                        )}
                        {m.fast && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                            style={{ background: "rgba(74,222,128,0.15)", color: "var(--color-green)" }}>⚡ fast</span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>{m.description}</p>
                      )}
                    </div>
                    {selectedModel === m.id && (
                      <CheckCircle2 size={14} style={{ color: "var(--color-cyan)", flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>

          {/* Model selector button — left side of input bar */}
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); setModelPickerOpen((v) => !v); }}
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all self-end mb-1"
            style={{
              background: modelPickerOpen ? "var(--color-surface3)" : "transparent",
              color: "var(--color-muted)",
              border: "1px solid var(--color-border)",
              maxWidth: 160,
            }}
          >
            <span className="truncate">{displayModelName}</span>
            {modelPickerOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>

          <textarea
            ref={textRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={handleKey}
            placeholder="Message APEX..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none py-2"
            style={{ color: "var(--color-text)", maxHeight: 160 }}
          />

          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); send(); }}
            className="flex-shrink-0 mb-1"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: hasInput && !isRunning ? "var(--color-cyan2)" : "var(--color-surface3)",
              opacity: hasInput && !isRunning ? 1 : 0.45,
              cursor: "pointer",
              border: "none",
              zIndex: 100,
              flexShrink: 0,
            }}>
            {isRunning ? <Square size={14} /> : <Send size={14} color={hasInput ? "#000" : "#666"} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- MessageItem ----
function MessageItem({ msg }: { msg: AgentMessage }) {
  const isUser = msg.role === "user";
  const [expanded, setExpanded] = React.useState(false);

  if (msg.type === "tool_use" || msg.type === "tool_result") {
    const Icon = TOOL_ICONS[msg.tool || ""] || Bot;
    const color = TOOL_COLORS[msg.tool || ""] || "var(--color-muted)";
    const isResult = msg.type === "tool_result";
    const lines = (msg.content || "").split("\n");
    const preview = lines.slice(0, 3).join("\n");
    const hasMore = lines.length > 3;

    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl overflow-hidden text-xs font-mono"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left"
          style={{ borderBottom: expanded ? "1px solid var(--color-border)" : "none" }}>
          <Icon size={12} style={{ color, flexShrink: 0 }} />
          <span style={{ color }}>{msg.tool}</span>
          {msg.args?.command && <span className="ml-1 truncate opacity-60" style={{ color: "var(--color-muted)" }}>{msg.args.command}</span>}
          {msg.args?.path && <span className="ml-1 truncate opacity-60" style={{ color: "var(--color-muted)" }}>{msg.args.path}</span>}
          <span className="ml-auto flex-shrink-0" style={{ color: "var(--color-muted)" }}>
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
        </button>
        {expanded && (
          <div className="px-3 py-2 overflow-x-auto" style={{ color: "var(--color-muted)", maxHeight: 300, overflowY: "auto" }}>
            <pre className="whitespace-pre-wrap break-all text-[11px]">{msg.content || JSON.stringify(msg.args, null, 2)}</pre>
          </div>
        )}
        {!expanded && isResult && (
          <div className="px-3 pb-2 pt-1" style={{ color: "var(--color-muted)" }}>
            <pre className="whitespace-pre-wrap break-all text-[11px] opacity-70">{preview}{hasMore ? "\n..." : ""}</pre>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>
          <Bot size={14} style={{ color: "var(--color-cyan)" }} />
        </div>
      )}
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm",
        isUser ? "rounded-tr-sm" : "rounded-tl-sm")}
        style={{
          background: isUser ? "var(--color-cyan2)" : "var(--color-surface)",
          color: isUser ? "#000" : "var(--color-text)",
          border: isUser ? "none" : "1px solid var(--color-border)",
        }}>
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{msg.content || "▋"}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>
          <User size={14} style={{ color: "var(--color-muted)" }} />
        </div>
      )}
    </motion.div>
  );
}
