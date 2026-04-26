import React from "react";
import {
  Send, Square, Bot, User, ChevronDown, ChevronRight,
  CheckCircle2, Terminal as TerminalIcon, FileText, Search,
  Globe, FolderOpen, Pencil, Trash2, Move,
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
  const { selectedModel } = useSettingsStore();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);

  // Reset stuck status when conversation changes
  React.useEffect(() => {
    reset();
  }, [conversationId]);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  React.useEffect(() => { if (atBottom) scrollToBottom(); }, [messages, toolEvents]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAtBottom(scrollHeight - scrollTop - clientHeight < 60);
  };

  // Single send function — no disabled guard, guard is only visual
  const send = React.useCallback(() => {
    const text = input.trim();
    if (!text) return;
    if (status === "running") return;
    sendAgentMessage(conversationId, text, selectedModel);
    setInput("");
    if (textRef.current) {
      textRef.current.value = "";
      textRef.current.style.height = "auto";
    }
  }, [input, status, conversationId, selectedModel]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  const renderItems = () => {
    const items: React.ReactNode[] = [];
    messages.forEach((msg, i) => {
      items.push(<MessageItem key={msg.id} msg={msg} />);
      const nextTs = messages[i + 1]?.timestamp || new Date(Date.now() + 1).toISOString();
      const relevant = toolEvents.filter((e) => e.timestamp >= msg.timestamp && e.timestamp < nextTs);
      if (relevant.length > 0) items.push(<ToolEventGroup key={`tools-${i}`} events={relevant} />);
    });
    return items;
  };

  const isRunning = status === "running";
  const hasInput = input.trim().length > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="h-12 flex items-center px-4 gap-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0 transition-all",
          isRunning ? "bg-green-400 animate-pulse" : "bg-gray-600")} />
        <span className="text-sm font-semibold">Agent Chat</span>
        {isRunning && (
          <span className="text-xs font-mono ml-auto animate-pulse" style={{ color: "var(--color-cyan)" }}>
            ● thinking…
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5"
        style={{ overscrollBehavior: "contain" }}>
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40 py-20">
            <Bot size={36} style={{ color: "var(--color-muted)" }} />
            <p className="text-sm text-center" style={{ color: "var(--color-muted)" }}>
              APEX is ready. Describe what you want to build.
            </p>
          </div>
        ) : renderItems()}

        <AnimatePresence>
          {!atBottom && (
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={scrollToBottom}
              className="fixed bottom-28 right-4 w-9 h-9 rounded-full flex items-center justify-center shadow-lg z-20"
              style={{ background: "var(--color-surface3)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
              <ChevronDown size={16} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input area — flat flex row, no overflow:hidden, no absolute positioning */}
      <div className="flex-shrink-0 border-t p-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="flex items-end gap-2 rounded-2xl px-4 py-2"
          style={{ background: "var(--color-surface2)", border: `1px solid ${hasInput ? "var(--color-border2)" : "var(--color-border)"}`, transition: "border-color 0.15s" }}>
          <textarea
            ref={textRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder={isRunning ? "Agent is working…" : "Message APEX…"}
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none"
            style={{
              color: "var(--color-text)",
              fontFamily: "var(--font-sans)",
              maxHeight: 160,
              lineHeight: 1.6,
              paddingTop: 6,
              paddingBottom: 6,
            }}
          />

          {/* Send button — NO disabled attribute (disabling blocks pointer events on iOS) */}
          <button
            type="button"
            onClick={send}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: hasInput && !isRunning ? "var(--color-cyan2)" : "var(--color-surface3)",
              opacity: hasInput && !isRunning ? 1 : 0.45,
              cursor: hasInput && !isRunning ? "pointer" : "default",
              border: "none",
              transition: "background 0.15s, opacity 0.15s",
            }}>
            {isRunning
              ? <Square size={14} color="var(--color-red)" />
              : <Send size={14} color={hasInput ? "#000" : "var(--color-muted)"} />
            }
          </button>
        </div>
        <p className="text-center text-xs mt-1.5 hidden md:block" style={{ color: "var(--color-faint)" }}>
          Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageItem({ msg }: { msg: AgentMessage }) {
  const isUser = msg.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
        style={{ background: isUser ? "var(--color-surface3)" : "var(--color-cyan2)" }}>
        {isUser ? <User size={13} style={{ color: "var(--color-text)" }} /> : <Bot size={13} color="#000" />}
      </div>
      <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}
        style={{ maxWidth: "calc(100% - 48px)" }}>
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
          {isUser ? "You" : "APEX"}
        </div>
        <div className={cn("rounded-2xl px-4 py-3 text-sm leading-relaxed w-full",
          isUser ? "rounded-tr-sm" : "rounded-tl-sm")}
          style={{ background: isUser ? "var(--color-surface2)" : "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          {isUser ? (
            <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</p>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{msg.content}</ReactMarkdown>
              {msg.isStreaming && <span className="animate-blink inline-block w-2 h-4 bg-current align-middle ml-0.5" />}
            </div>
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--color-faint)" }}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

function ToolEventGroup({ events }: { events: any[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const uses = events.filter((e) => e.type === "tool_use");
  const results = events.filter((e) => e.type === "tool_result");

  return (
    <div className="flex flex-col gap-1" style={{ marginLeft: 36 }}>
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs py-1 flex-wrap text-left"
        style={{ color: "var(--color-muted)" }}>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="font-mono">{uses.length} tool call{uses.length > 1 ? "s" : ""}</span>
        <span style={{ color: "var(--color-faint)" }}>—</span>
        {uses.slice(0, 3).map((u, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {React.createElement(TOOL_ICONS[u.tool] || TerminalIcon, {
              size: 10,
              style: { color: TOOL_COLORS[u.tool] || "var(--color-cyan)" },
            })}
            <span className="font-mono hidden sm:inline" style={{ color: TOOL_COLORS[u.tool] || "var(--color-cyan)" }}>
              {u.tool}
            </span>
          </span>
        ))}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {uses.map((u, i) => {
              const r = results[i];
              return (
                <div key={i} className="mb-2 rounded-lg overflow-hidden"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
                  <div className="px-3 py-2 flex items-center gap-2 flex-wrap"
                    style={{ background: "var(--color-surface2)", borderBottom: "1px solid var(--color-border)" }}>
                    {React.createElement(TOOL_ICONS[u.tool] || TerminalIcon, {
                      size: 13,
                      style: { color: TOOL_COLORS[u.tool] || "var(--color-cyan)" },
                    })}
                    <span className="text-xs font-mono font-semibold" style={{ color: TOOL_COLORS[u.tool] }}>
                      {u.tool}
                    </span>
                    {(u.args?.command || u.args?.path || u.args?.query) && (
                      <span className="text-xs font-mono truncate" style={{ color: "var(--color-muted)", maxWidth: 180 }}>
                        {u.args?.command || u.args?.path || u.args?.query}
                      </span>
                    )}
                    {r && <CheckCircle2 size={13} className="ml-auto flex-shrink-0" style={{ color: "var(--color-green)" }} />}
                  </div>
                  {r && (
                    <pre className="text-xs p-3 overflow-x-auto font-mono leading-relaxed"
                      style={{ color: "var(--color-muted)", background: "var(--color-bg)", maxHeight: 200, margin: 0 }}>
                      {String(r.result).slice(0, 2000)}
                      {String(r.result).length > 2000 ? "\n…[truncated]" : ""}
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
