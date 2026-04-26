import React from "react";
import { Send, Paperclip, Square, Bot, User, ChevronDown, ChevronRight, CheckCircle2, Loader2, Terminal as TerminalIcon, FileText, Search, Globe, FolderOpen, Pencil, Trash2, Move, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useEventStore, AgentMessage } from "@/src/stores/event-store";
import { useAgentStore } from "@/src/stores/agent-store";
import { sendAgentMessage } from "@/src/socket/socket";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useSettingsStore } from "@/src/stores/settings-store";

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
  const { status } = useAgentStore();
  const { selectedModel } = useSettingsStore();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  React.useEffect(() => { if (atBottom) scrollToBottom(); }, [messages, toolEvents]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAtBottom(scrollHeight - scrollTop - clientHeight < 60);
  };

  const handleSend = () => {
    if (!input.trim() || status === "running") return;
    sendAgentMessage(conversationId, input, selectedModel);
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  // Group messages with tool events between them
  const renderItems = () => {
    const items: React.ReactNode[] = [];
    messages.forEach((msg, i) => {
      items.push(<MessageItem key={msg.id} msg={msg} />);
      const nextTs = messages[i + 1]?.timestamp || new Date(Date.now() + 1).toISOString();
      const relevant = toolEvents.filter((e) => e.timestamp >= msg.timestamp && e.timestamp < nextTs);
      if (relevant.length > 0) {
        items.push(<ToolEventGroup key={`tools-${i}`} events={relevant} />);
      }
    });
    return items;
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="h-12 flex items-center px-5 gap-3 border-b flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className={cn("w-2 h-2 rounded-full transition-all", status === "running" ? "bg-green-400 animate-pulse" : "bg-gray-500")} />
        <span className="text-sm font-semibold">Agent Chat</span>
        {status === "running" && <span className="text-xs font-mono ml-auto animate-pulse" style={{ color: "var(--color-cyan)" }}>● thinking…</span>}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
            <Bot size={40} style={{ color: "var(--color-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>APEX is ready. Ask anything.</p>
          </div>
        ) : renderItems()}

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {!atBottom && (
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={scrollToBottom}
              className="fixed bottom-24 right-8 w-9 h-9 rounded-full flex items-center justify-center shadow-lg z-10"
              style={{ background: "var(--color-surface3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
              <ChevronDown size={16} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-4 border-t" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="relative rounded-2xl overflow-hidden" style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>
          <textarea
            ref={textRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKey}
            placeholder={status === "running" ? "Agent is working..." : "Message APEX... (Enter to send)"}
            disabled={status === "running"}
            rows={1}
            className="w-full px-4 pt-3.5 pb-12 text-sm resize-none outline-none bg-transparent disabled:opacity-50"
            style={{ color: "var(--color-text)", fontFamily: "var(--font-sans)", maxHeight: 200 }}
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button className="p-2 rounded-lg transition-colors" style={{ color: "var(--color-muted)" }}>
              <Paperclip size={16} />
            </button>
            {status === "running" ? (
              <button className="p-2 rounded-xl flex items-center justify-center" style={{ background: "var(--color-red)", color: "white" }}>
                <Square size={14} fill="white" />
              </button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim()}
                className="p-2 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: "var(--color-cyan2)", color: "#000" }}>
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="text-center mt-2 text-xs" style={{ color: "var(--color-faint)" }}>
          Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

function MessageItem({ msg }: { msg: AgentMessage }) {
  const isUser = msg.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: isUser ? "var(--color-surface3)" : "var(--color-cyan2)" }}>
        {isUser ? <User size={13} style={{ color: "var(--color-text)" }} /> : <Bot size={13} color="#000" />}
      </div>
      <div className={cn("max-w-[85%]", isUser ? "items-end" : "items-start", "flex flex-col gap-1")}>
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
          {isUser ? "You" : "APEX"}
        </div>
        <div className={cn("rounded-2xl px-4 py-3 text-sm leading-relaxed", isUser ? "rounded-tr-sm" : "rounded-tl-sm")}
          style={{ background: isUser ? "var(--color-surface2)" : "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
          {isUser ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{msg.content}</ReactMarkdown>
              {msg.isStreaming && <span className="animate-blink inline-block w-2 h-4 bg-current align-middle ml-0.5" />}
            </div>
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--color-faint)" }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </motion.div>
  );
}

function ToolEventGroup({ events }: { events: any[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const uses = events.filter((e) => e.type === "tool_use");
  const results = events.filter((e) => e.type === "tool_result");

  return (
    <div className="ml-10 flex flex-col gap-1">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-xs py-1 group" style={{ color: "var(--color-muted)" }}>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="font-mono">{uses.length} tool call{uses.length > 1 ? "s" : ""}</span>
        <span style={{ color: "var(--color-faint)" }}>—</span>
        {uses.map((u, i) => (
          <span key={i} className="flex items-center gap-1">
            {React.createElement(TOOL_ICONS[u.tool] || TerminalIcon, { size: 11, style: { color: TOOL_COLORS[u.tool] || "var(--color-cyan)" } })}
            <span style={{ color: TOOL_COLORS[u.tool] || "var(--color-cyan)" }} className="font-mono">{u.tool}</span>
          </span>
        ))}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {uses.map((u, i) => {
              const r = results[i];
              return (
                <div key={i} className="mb-2 rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
                  <div className="px-3 py-2 flex items-center gap-2" style={{ background: "var(--color-surface2)", borderBottom: "1px solid var(--color-border)" }}>
                    {React.createElement(TOOL_ICONS[u.tool] || TerminalIcon, { size: 13, style: { color: TOOL_COLORS[u.tool] || "var(--color-cyan)" } })}
                    <span className="text-xs font-mono font-semibold" style={{ color: TOOL_COLORS[u.tool] }}>{u.tool}</span>
                    {u.args?.command && <span className="text-xs font-mono truncate max-w-xs" style={{ color: "var(--color-muted)" }}>{u.args.command}</span>}
                    {u.args?.path && <span className="text-xs font-mono truncate max-w-xs" style={{ color: "var(--color-muted)" }}>{u.args.path}</span>}
                    {u.args?.query && <span className="text-xs font-mono truncate max-w-xs" style={{ color: "var(--color-muted)" }}>{u.args.query}</span>}
                    {r && <CheckCircle2 size={13} className="ml-auto flex-shrink-0" style={{ color: "var(--color-green)" }} />}
                  </div>
                  {r && (
                    <pre className="text-xs p-3 overflow-x-auto max-h-48 font-mono leading-relaxed" style={{ color: "var(--color-muted)", background: "var(--color-bg)" }}>
                      {String(r.result).slice(0, 2000)}{String(r.result).length > 2000 ? "\n...[truncated]" : ""}
                    </pre>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
