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

  React.useEffect(() => { reset(); }, [conversationId]);

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
    console.log("Send triggered. Input:", input, "Status:", status); // DEBUG LOG
    const text = input.trim();
    if (!text) return;
    if (status === "running") {
        console.log("Blocked: Agent is already running");
        return;
    }

    sendAgentMessage(conversationId, text, selectedModel);
    setInput("");
    if (textRef.current) {
      textRef.current.style.height = "auto";
    }
  }, [input, status, conversationId, selectedModel]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isRunning = status === "running";
  const hasInput = input.trim().length > 0;

  return (
    <div className="flex flex-col h-full relative" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <div className="h-12 flex items-center px-4 gap-3 border-b z-10"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0 transition-all",
          isRunning ? "bg-green-400 animate-pulse" : "bg-gray-600")} />
        <span className="text-sm font-semibold">Agent Chat</span>
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
            messages.map((msg, i) => <MessageItem key={msg.id} msg={msg} />)
        )}
      </div>

      {/* Input Area - Forced to top with Z-Index */}
      <div className="relative z-50 border-t p-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="flex items-end gap-2 rounded-2xl px-4 py-2"
          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>
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
            onPointerDown={(e) => {
                e.preventDefault(); // Prevents focus loss on mobile
                send();
            }}
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
              cursor: "pointer", // Keep pointer active so event hits
              border: "none",
              zIndex: 100
            }}>
            {isRunning ? <Square size={14} /> : <Send size={14} color={hasInput ? "#000" : "#666"} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ... MessageItem stays the same as your previous code ...
