import React from "react";
import {
  Send, Square, Bot, User, ChevronDown, ChevronRight,
  Terminal as TerminalIcon, FileText, Search,
  Globe, FolderOpen, Pencil, Trash2, Move, ChevronUp, Zap, CheckCircle2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useEventStore } from "@/src/stores/event-store";
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
  const { messages, toolEvents, addMessage } = useEventStore();
  const { status, reset } = useAgentStore();
  const { selectedModel, setSelectedModel } = useSettingsStore();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [modelPickerOpen, setModelPickerOpen] = React.useState(false);
  const [models, setModels] = React.useState<any[]>([]);
  const pickerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { reset(); }, [conversationId]);
  React.useEffect(() => { getModels().then(setModels); }, []);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
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

  const send = () => {
    const text = input.trim();
    if (!text || status === "running") return;

    // Immediately add user message to the store so it appears in chat
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);

    sendAgentMessage(conversationId, text, selectedModel);
    setInput("");
    if (textRef.current) {
      textRef.current.style.height = "auto";
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isRunning = status === "running";
  const hasInput = input.trim().length > 0;
  const currentModel = models.find((m) => m.id === selectedModel);
  const displayName = currentModel?.name ?? selectedModel;

  // Merge messages and tool events into a single timeline sorted by timestamp
  const allItems = React.useMemo(() => {
    const msgs = messages.map((m) => ({ ...m, _type: "message" as const }));
    const tools = toolEvents.map((t) => ({ ...t, id: `${t.tool}-${t.timestamp}`, role: "tool" as const, content: t.result || JSON.stringify(t.args), _type: "tool" as const }));
    return [...msgs, ...tools].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, toolEvents]);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="h-12 flex items-center px-4 gap-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0 transition-all",
          isRunning ? "bg-green-400 animate-pulse" : "bg-gray-600")} />
        <span className="text-sm font-semibold">Agent Chat</span>
        <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono"
          style={{ background: "var(--color-surface2)", color: "var(--color-cyan)", border: "1px solid var(--color-border)" }}>
          <Zap size={10} />
          Groq
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
        {allItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40 py-20">
            <Bot size={36} />
            <p className="text-sm">Describe your project to start.</p>
          </div>
        ) : (
          allItems.map((item) =>
            item._type === "tool"
              ? <ToolItem key={item.id} event={item as any} />
              : <MessageItem key={item.id} msg={item as any} />
          )
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t p-3 relative"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>

        {/* Model picker popup — opens upward */}
        <AnimatePresence>
          {modelPickerOpen && (
            <motion.div
              ref={pickerRef}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.13 }}
              className="absolute left-3 right-3 bottom-full mb-2 rounded-2xl overflow-hidden z-50"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
              }}
            >
              <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--color-border)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
                  Groq Models
                </p>
              </div>
              <div className="p-2 overflow-y-auto" style={{ maxHeight: 260 }}>
                {models.map((m) => (
                  <button
                    key={m.id}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setSelectedModel(m.id);
                      setModelPickerOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                    style={{
                      background: selectedModel === m.id ? "rgba(14,165,233,0.1)" : "transparent",
                      border: `1px solid ${selectedModel === m.id ? "rgba(14,165,233,0.4)" : "transparent"}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
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
                    {selectedModel === m.id && <CheckCircle2 size={14} style={{ color: "var(--color-cyan)", flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input box */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>

          {/* Textarea row */}
          <div className="flex items-end px-3 pt-2 gap-2">
            <textarea
              ref={textRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onKeyDown={handleKey}
              placeholder="Message APEX..."
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none outline-none py-2"
              style={{ color: "var(--color-text)", maxHeight: 140, lineHeight: 1.5 }}
            />
          </div>

          {/* Bottom toolbar row: model picker + send */}
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            {/* Model selector button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setModelPickerOpen((v) => !v);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: modelPickerOpen ? "var(--color-surface3)" : "var(--color-surface)",
                color: "var(--color-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span className="truncate" style={{ maxWidth: 130 }}>{displayName}</span>
              {modelPickerOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            </button>

            {/* Send button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                send();
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: hasInput && !isRunning ? "var(--color-cyan2)" : "var(--color-surface3)",
                opacity: hasInput && !isRunning ? 1 : 0.4,
                border: "none",
                cursor: hasInput && !isRunning ? "pointer" : "default",
                flexShrink: 0,
              }}
            >
              {isRunning
                ? <Square size={13} style={{ color: "var(--color-text)" }} />
                : <Send size={13} color={hasInput ? "#000" : "#666"} />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Tool event item ----
function ToolItem({ event }: { event: any }) {
  const [expanded, setExpanded] = React.useState(false);
  const Icon = TOOL_ICONS[event.tool] || Bot;
  const color = TOOL_COLORS[event.tool] || "var(--color-muted)";
  const isResult = event.type === "tool_result";
  const content = event.result || JSON.stringify(event.args, null, 2) || "";
  const lines = content.split("\n");
  const preview = lines.slice(0, 2).join("\n");
  const hasMore = lines.length > 2;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden text-xs font-mono"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ borderBottom: expanded ? "1px solid var(--color-border)" : "none" }}>
        <Icon size={12} style={{ color, flexShrink: 0 }} />
        <span style={{ color }}>{event.tool}</span>
        {event.args?.command && (
          <span className="ml-1 truncate opacity-60" style={{ color: "var(--color-muted)" }}>{event.args.command}</span>
        )}
        {event.args?.path && (
          <span className="ml-1 truncate opacity-60" style={{ color: "var(--color-muted)" }}>{event.args.path}</span>
        )}
        <span className="ml-auto flex-shrink-0" style={{ color: "var(--color-muted)" }}>
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 overflow-x-auto" style={{ color: "var(--color-muted)", maxHeight: 240, overflowY: "auto" }}>
          <pre className="whitespace-pre-wrap break-all text-[11px]">{content}</pre>
        </div>
      )}
      {!expanded && isResult && content && (
        <div className="px-3 pb-2 pt-0.5" style={{ color: "var(--color-muted)" }}>
          <pre className="whitespace-pre-wrap break-all text-[11px] opacity-60">{preview}{hasMore ? "\n..." : ""}</pre>
        </div>
      )}
    </motion.div>
  );
}

// ---- Message item ----
function MessageItem({ msg }: { msg: any }) {
  const isUser = msg.role === "user";

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>
          <Bot size={14} style={{ color: "var(--color-cyan)" }} />
        </div>
      )}
      <div
        className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", isUser ? "rounded-tr-sm" : "rounded-tl-sm")}
        style={{
          background: isUser ? "var(--color-cyan2)" : "var(--color-surface)",
          color: isUser ? "#000" : "var(--color-text)",
          border: isUser ? "none" : "1px solid var(--color-border)",
        }}>
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {msg.content || "▋"}
            </ReactMarkdown>
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
