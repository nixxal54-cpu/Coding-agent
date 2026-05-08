import React from "react";
import {
  Send, Square, Bot, ChevronDown, ChevronRight,
  Terminal as TerminalIcon, FileText, Search,
  Globe, FolderOpen, Pencil, Trash2, Move, Zap,
  CheckCircle2, Copy, Check, Play, ListTodo, Hammer, ShieldCheck, AlertCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useEventStore } from "@/src/stores/event-store";
import { useAgentStore } from "@/src/stores/agent-store";
import { sendAgentMessage, getSocket } from "@/src/socket/socket";
import toast from "react-hot-toast";
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
  run_command: "#fbbf24", read_file: "#38bdf8", write_file: "#4ade80",
  edit_file: "#a78bfa", list_files: "#38bdf8", delete_file: "#f87171",
  search_files: "#38bdf8", web_search: "#38bdf8", create_directory: "#4ade80",
  move_file: "#fbbf24", get_project_info: "#a78bfa",
};

// ─── Code block with copy + lang badge ──────────────────────────────────────
function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const lang = className?.replace("language-", "") || "text";

  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-lang">{lang}</span>
        <button onClick={copy} className="code-copy-btn">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{children}</code>
      </pre>
    </div>
  );
}

// ─── Markdown renderer with proper code blocks ───────────────────────────────
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          code({ node, className, children, ...props }: any) {
            const isInline = !className;
            if (isInline) {
              return <code className="inline-code" {...props}>{children}</code>;
            }
            return <CodeBlock className={className}>{String(children).replace(/\n$/, "")}</CodeBlock>;
          },
          pre({ children }: any) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChatInterface({ conversationId }: { conversationId: string }) {
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef("");
  const { messages, toolEvents, addMessage } = useEventStore();
  const { status, reset } = useAgentStore();
  const statusRef = React.useRef(status);
  const { selectedModel, setSelectedModel } = useSettingsStore();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  const [modelPickerOpen, setModelPickerOpen] = React.useState(false);
  const [models, setModels] = React.useState<any[]>([]);
  const pickerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { reset(); }, [conversationId]);
  React.useEffect(() => { statusRef.current = status; }, [status]);
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

  const stop = () => getSocket().emit("stop_agent", { conversation_id: conversationId });

  const send = () => {
    const text = inputRef.current.trim();
    if (!text) return;
    if (statusRef.current === "running") { toast.error("Agent is busy, please wait..."); return; }
    addMessage({ id: `user-${Date.now()}`, role: "user" as const, content: text, timestamp: new Date().toISOString() });
    sendAgentMessage(conversationId, text, selectedModel);
    inputRef.current = "";
    setInput("");
    if (textRef.current) textRef.current.style.height = "auto";
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isRunning = status === "running";
  const hasInput = input.trim().length > 0;
  const currentModel = models.find((m) => m.id === selectedModel);
  const displayName = currentModel?.name ?? (selectedModel?.split("/").pop() ?? "Model");

  const allItems = React.useMemo(() => {
    const msgs = messages.map((m) => ({ ...m, _type: "message" as const }));
    const tools = toolEvents.map((t) => ({
      ...t, id: `${t.tool}-${t.timestamp}`, role: "tool" as const,
      content: t.result || JSON.stringify(t.args), _type: "tool" as const,
    }));
    return [...msgs, ...tools].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, toolEvents]);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="chat-header">
        <div className={cn("status-dot", isRunning && "status-dot--running")} />
        <span className="chat-header-title">APEX</span>
        {isRunning && (
          <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 text-xs font-mono" style={{ color: "var(--color-yellow)" }}>
            <span className="thinking-dots">thinking</span>
          </motion.div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
        {allItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 opacity-40">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>
              <Zap size={22} style={{ color: "var(--color-cyan)" }} />
            </div>
            <p className="text-sm font-medium">What are we building today?</p>
          </div>
        ) : (
          allItems.map((item) =>
            item._type === "tool"
              ? <ToolItem key={item.id} event={item as any} />
              : <MessageItem key={item.id} msg={item as any} />
          )
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3" style={{ background: "var(--color-bg)" }}>
        <div className="input-shell">
          <textarea
            ref={textRef}
            value={input}
            onChange={(e) => {
              inputRef.current = e.target.value;
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
            }}
            onKeyDown={handleKey}
            placeholder="Ask APEX to build, debug, or explore..."
            rows={1}
            className="input-textarea"
          />
          <div className="input-toolbar">
            {/* Model picker */}
            <div className="relative" ref={pickerRef}>
              <AnimatePresence>
                {modelPickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.13 }}
                    className="model-picker"
                  >
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onPointerDown={(e) => { e.preventDefault(); setSelectedModel(m.id); setModelPickerOpen(false); }}
                        className={cn("model-picker-item", selectedModel === m.id && "model-picker-item--active")}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{m.name}</span>
                            {m.recommended && <span className="model-badge model-badge--recommended">★ best</span>}
                            {m.fast && <span className="model-badge model-badge--fast">⚡ fast</span>}
                            {m.audio && <span className="model-badge model-badge--audio">🎙 audio</span>}
                          </div>
                          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-muted)" }}>{m.description}</p>
                        </div>
                        {selectedModel === m.id && <CheckCircle2 size={14} style={{ color: "var(--color-cyan)", flexShrink: 0 }} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); setModelPickerOpen((v) => !v); }}
                className="model-trigger"
              >
                <span className="truncate max-w-[140px] text-xs">{displayName}</span>
                <ChevronDown size={11} style={{ transform: modelPickerOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </button>
            </div>

            {/* Send / Stop */}
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); if (isRunning) stop(); else send(); }}
              className={cn("send-btn", (hasInput || isRunning) && "send-btn--active")}
            >
              {isRunning ? <Square size={11} fill="currentColor" /> : <ArrowUp size={14} />}
            </button>
          </div>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: "var(--color-faint)" }}>
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  );
}

function ArrowUp({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

// ─── Generative UI parser ────────────────────────────────────────────────────
function parseGenerativeUI(content: string) {
  const parts: { type: string; content: string }[] = [];
  const regex = /(<plan>[\s\S]*?<\/plan>|<execute>[\s\S]*?<\/execute>|<verify>[\s\S]*?<\/verify>)/gi;
  let lastIdx = 0, match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIdx) parts.push({ type: "text", content: content.slice(lastIdx, match.index) });
    if (match[0].startsWith("<plan>")) parts.push({ type: "plan", content: match[0].slice(6, -7).trim() });
    else if (match[0].startsWith("<execute>")) parts.push({ type: "execute", content: match[0].slice(9, -10).trim() });
    else if (match[0].startsWith("<verify>")) parts.push({ type: "verify", content: match[0].slice(8, -9).trim() });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < content.length) parts.push({ type: "text", content: content.slice(lastIdx) });
  return parts;
}

// ─── Message item ─────────────────────────────────────────────────────────────
function MessageItem({ msg }: { msg: any }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="user-bubble">{msg.content}</div>
      </motion.div>
    );
  }

  const parts = parseGenerativeUI(msg.content || "");

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <div className="agent-avatar">
        <Zap size={14} style={{ color: "#000" }} />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        {msg.isStreaming && !msg.content && (
          <div className="flex items-center gap-1.5 py-2">
            <span className="streaming-dot" style={{ animationDelay: "0ms" }} />
            <span className="streaming-dot" style={{ animationDelay: "150ms" }} />
            <span className="streaming-dot" style={{ animationDelay: "300ms" }} />
          </div>
        )}
        {parts.map((p, i) => {
          if (p.type === "plan") return (
            <div key={i} className="gen-card gen-card--plan">
              <div className="gen-card-header"><ListTodo size={13} /> Agent Plan</div>
              <MarkdownContent content={p.content} />
            </div>
          );
          if (p.type === "execute") return (
            <div key={i} className="gen-card gen-card--execute">
              <div className="gen-card-header"><Hammer size={13} /> Execution</div>
              <MarkdownContent content={p.content} />
            </div>
          );
          if (p.type === "verify") return (
            <div key={i} className="gen-card gen-card--verify">
              <div className="gen-card-header"><ShieldCheck size={13} /> Verification</div>
              <MarkdownContent content={p.content} />
            </div>
          );
          return p.content ? <MarkdownContent key={i} content={p.content} /> : null;
        })}
      </div>
    </motion.div>
  );
}

// ─── Tool item ────────────────────────────────────────────────────────────────
function ToolItem({ event }: { event: any }) {
  const [expanded, setExpanded] = React.useState(false);
  const Icon = TOOL_ICONS[event.tool] || Bot;
  const color = TOOL_COLORS[event.tool] || "var(--color-muted)";
  const isResult = event.type === "tool_result";
  const content = event.result || JSON.stringify(event.args, null, 2) || "";
  const isError = content.toLowerCase().startsWith("error");
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="tool-card"
      style={{ marginLeft: "2.5rem" }}
    >
      <button onClick={() => setExpanded(!expanded)} className="tool-card-header">
        <Icon size={13} style={{ color, flexShrink: 0 }} />
        <span className="tool-name" style={{ color }}>{event.tool}</span>
        {event.args?.command && <span className="tool-arg">{event.args.command}</span>}
        {event.args?.path && <span className="tool-arg">{event.args.path}</span>}
        {event.args?.query && <span className="tool-arg">{event.args.query}</span>}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {isResult && isError && <AlertCircle size={12} style={{ color: "var(--color-red)" }} />}
          {isResult && !isError && <CheckCircle2 size={12} style={{ color: "var(--color-green)" }} />}
          <ChevronRight size={12} style={{ color: "var(--color-muted)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="tool-card-body">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono" style={{ color: "var(--color-muted)" }}>
                  {isResult ? "output" : "args"}
                </span>
                <button onClick={copy} className="flex items-center gap-1 text-xs" style={{ color: "var(--color-muted)" }}>
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="tool-output">{content}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
