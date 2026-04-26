--- START OF FILE Coding-agent-main/src/components/chat/ChatInterface.tsx ---
import React from "react";
import {
  Send, Square, Bot, User, ChevronDown, ChevronRight,
  Terminal as TerminalIcon, FileText, Search,
  Globe, FolderOpen, Pencil, Trash2, Move, ChevronUp, Zap, CheckCircle2,
  ListTodo, Hammer, ShieldCheck
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

    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    sendAgentMessage(conversationId, text, selectedModel);
    setInput("");
    if (textRef.current) textRef.current.style.height = "auto";
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

  const allItems = React.useMemo(() => {
    const msgs = messages.map((m) => ({ ...m, _type: "message" as const }));
    const tools = toolEvents.map((t) => ({ ...t, id: `${t.tool}-${t.timestamp}`, role: "tool" as const, content: t.result || JSON.stringify(t.args), _type: "tool" as const }));
    return [...msgs, ...tools].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, toolEvents]);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="h-14 flex items-center px-5 gap-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0 transition-all",
          isRunning ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-gray-600")} />
        <span className="text-sm font-semibold tracking-tight text-white">APEX Workspace</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">
        {allItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50 py-20">
            <Bot size={48} className="text-zinc-600" />
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

      {/* Input area */}
      <div className="flex-shrink-0 p-4 pt-2" style={{ background: "var(--color-bg)" }}>
        <div className="relative rounded-2xl overflow-visible transition-all duration-200"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          
          <textarea
            ref={textRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
            }}
            onKeyDown={handleKey}
            placeholder="Ask APEX to build, debug, or explore..."
            rows={1}
            className="w-full bg-transparent text-[15px] resize-none outline-none py-4 px-4 pb-12"
            style={{ color: "var(--color-text)", maxHeight: 200, lineHeight: 1.5 }}
          />

          {/* Bottom Toolbar inside the input box */}
          <div className="absolute bottom-2 right-2 left-2 flex items-center justify-between">
            {/* Model picker popup & button */}
            <div className="relative">
              <AnimatePresence>
                {modelPickerOpen && (
                  <motion.div
                    ref={pickerRef}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 bottom-full mb-2 rounded-2xl overflow-hidden z-50 w-[300px]"
                    style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border2)", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}
                  >
                    <div className="p-2 overflow-y-auto" style={{ maxHeight: 260 }}>
                      {models.map((m) => (
                        <button
                          key={m.id}
                          onPointerDown={(e) => { e.preventDefault(); setSelectedModel(m.id); setModelPickerOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-zinc-700/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium" style={{ color: selectedModel === m.id ? "white" : "var(--color-text)" }}>
                              {m.name}
                            </span>
                          </div>
                          {selectedModel === m.id && <CheckCircle2 size={14} className="text-blue-500 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); setModelPickerOpen((v) => !v); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--color-muted)" }}
              >
                <span className="truncate max-w-[150px]">{displayName}</span>
                {modelPickerOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              </button>
            </div>

            {/* Send button */}
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); send(); }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm"
              style={{
                background: hasInput && !isRunning ? "var(--color-text)" : "var(--color-surface3)",
                color: hasInput && !isRunning ? "#000" : "var(--color-muted)",
                cursor: hasInput && !isRunning ? "pointer" : "default",
              }}
            >
              {isRunning ? <Square size={12} /> : <ArrowUpIcon size={14} strokeWidth={3} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponent replacing Send with Lovable's up arrow
function ArrowUpIcon({ size, strokeWidth }: { size: number, strokeWidth: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

// ---- Generative UI / Message Parser ----
function parseGenerativeUI(content: string) {
  const parts = [];
  const regex = /(<plan>[\s\S]*?<\/plan>|<execute>[\s\S]*?<\/execute>|<verify>[\s\S]*?<\/verify>)/gi;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIdx) parts.push({ type: "text", content: content.slice(lastIdx, match.index) });
    
    const tagMatch = match[0];
    if (tagMatch.startsWith("<plan>")) {
      parts.push({ type: "plan", content: tagMatch.slice(6, -7).trim() });
    } else if (tagMatch.startsWith("<execute>")) {
      parts.push({ type: "execute", content: tagMatch.slice(9, -10).trim() });
    } else if (tagMatch.startsWith("<verify>")) {
      parts.push({ type: "verify", content: tagMatch.slice(8, -9).trim() });
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < content.length) parts.push({ type: "text", content: content.slice(lastIdx) });

  return parts;
}

function MessageItem({ msg }: { msg: any }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end mb-2">
        <div className="max-w-[80%] rounded-3xl rounded-tr-sm px-5 py-3 text-[15px]"
          style={{ background: "var(--color-surface2)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}>
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
      </motion.div>
    );
  }

  // Agent Message with Generative UI
  const parts = parseGenerativeUI(msg.content);

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 max-w-[95%]">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
        style={{ background: "var(--color-cyan)", color: "#000" }}>
        <Bot size={16} />
      </div>
      <div className="flex-1 min-w-0 pt-1.5">
        {parts.map((p, i) => {
          if (p.type === "plan") return (
            <div key={i} className="gen-ui-card">
              <div className="gen-ui-header text-blue-400"><ListTodo size={14} /> Agent Plan</div>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{p.content}</ReactMarkdown>
              </div>
            </div>
          );
          if (p.type === "execute") return (
            <div key={i} className="gen-ui-card">
              <div className="gen-ui-header text-yellow-400"><Hammer size={14} /> Execution</div>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{p.content}</ReactMarkdown>
              </div>
            </div>
          );
          if (p.type === "verify") return (
            <div key={i} className="gen-ui-card">
              <div className="gen-ui-header text-green-400"><ShieldCheck size={14} /> Verification</div>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{p.content}</ReactMarkdown>
              </div>
            </div>
          );
          
          return p.content ? (
            <div key={i} className="prose prose-invert prose-sm max-w-none mb-3">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{p.content}</ReactMarkdown>
            </div>
          ) : null;
        })}
      </div>
    </motion.div>
  );
}

// ---- Tool event item ----
function ToolItem({ event }: { event: any }) {
  const [expanded, setExpanded] = React.useState(false);
  const Icon = TOOL_ICONS[event.tool] || Bot;
  const color = TOOL_COLORS[event.tool] || "var(--color-muted)";
  const isResult = event.type === "tool_result";
  const content = event.result || JSON.stringify(event.args, null, 2) || "";
  const preview = content.split("\n").slice(0, 1).join("\n");

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
      className="ml-12 mr-8 rounded-xl overflow-hidden text-[13px] font-mono my-1"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors"
        style={{ borderBottom: expanded ? "1px solid var(--color-border)" : "none" }}>
        <Icon size={14} style={{ color, flexShrink: 0 }} />
        <span style={{ color }}>{event.tool}</span>
        {event.args?.command && <span className="ml-1 truncate text-zinc-500">{event.args.command}</span>}
        {event.args?.path && <span className="ml-1 truncate text-zinc-500">{event.args.path}</span>}
        <span className="ml-auto flex-shrink-0 text-zinc-600">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 overflow-x-auto text-zinc-400" style={{ maxHeight: 240, overflowY: "auto" }}>
          <pre className="whitespace-pre-wrap break-all text-[12px]">{content}</pre>
        </div>
      )}
      {!expanded && isResult && content && (
        <div className="px-3 pb-2 pt-0.5 text-zinc-500">
          <pre className="whitespace-pre-wrap break-all text-[11px] truncate opacity-80">{preview}</pre>
        </div>
      )}
    </motion.div>
  );
}
--- END OF FILE Coding-agent-main/src/components/chat/ChatInterface.tsx ---
