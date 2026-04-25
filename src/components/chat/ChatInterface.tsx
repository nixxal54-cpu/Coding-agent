import React from "react";
import { 
  Send, 
  Paperclip, 
  ChevronDown, 
  ChevronRight, 
  Terminal as TerminalIcon,
  FileCode,
  CheckCircle2,
  Clock,
  Bot
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useEventStore, AgentMessage } from "@/src/stores/event-store";
import { useAgentStore } from "@/src/stores/agent-store";
import { sendAgentMessage } from "@/src/socket/socket";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface ChatInterfaceProps {
  conversationId: string;
}

export default function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const [input, setInput] = React.useState("");
  const { messages, toolEvents } = useEventStore();
  const { status } = useAgentStore();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, toolEvents]);

  const handleSend = () => {
    if (!input.trim() || status === "running") return;
    sendAgentMessage(conversationId, input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-bg-base">
      <div className="h-14 border-bottom border-border flex items-center px-6 justify-between flex-shrink-0 bg-bg-secondary/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full",
            status === "running" ? "bg-accent-green animate-pulse" : "bg-text-muted"
          )} />
          <span className="font-medium">Agent Chat</span>
        </div>
        {status === "running" && (
          <span className="text-xs text-text-secondary animate-pulse">Agent is thinking...</span>
        )}
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 scroll-smooth"
      >
        {messages.map((msg, i) => (
          <React.Fragment key={msg.id}>
            <MessageItem msg={msg} />
            {/* Show tool events that happened after this user message but before next assistant message */}
            <ToolEventsList 
               after={msg.timestamp} 
               before={messages[i+1]?.timestamp || new Date().toISOString()} 
               events={toolEvents}
            />
          </React.Fragment>
        ))}
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-4 opacity-50">
            <Bot size={48} />
            <p>How can I help you build today?</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-bg-base border-t border-border">
        <div className="max-w-4xl mx-auto relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="w-full bg-bg-tertiary text-text-primary rounded-2xl p-4 pr-32 min-h-[56px] max-h-48 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 border border-border group-hover:border-accent/30 transition-all"
            rows={1}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <button className="p-2 text-text-muted hover:text-text-primary transition-colors">
              <Paperclip size={20} />
            </button>
            <button 
              onClick={handleSend}
              disabled={!input.trim() || status === "running"}
              className="p-2 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:bg-bg-hover text-bg-base rounded-xl transition-all"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageItem({ msg }: { msg: AgentMessage }) {
  const isUser = msg.role === "user";
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col gap-2 max-w-[85%]",
        isUser ? "self-end items-end" : "self-start items-start"
      )}
    >
      {!isUser && (
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center text-bg-base">
            <Bot size={14} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Agent</span>
        </div>
      )}
      <div className={cn(
        "px-4 py-3 rounded-2xl text-sm leading-relaxed",
        isUser ? "bg-bg-tertiary text-text-primary border border-border" : "text-text-primary markdown-body"
      )}>
        {isUser ? (
          msg.content
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {msg.content}
          </ReactMarkdown>
        )}
        {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-accent animate-pulse ml-1 align-middle" />}
      </div>
      <span className="text-[10px] text-text-muted font-mono uppercase">
        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </motion.div>
  );
}

function ToolEventsList({ events, after, before }: { events: any[], after: string, before: string }) {
  const relevantEvents = events.filter(e => e.timestamp >= after && e.timestamp < before);
  if (relevantEvents.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 my-2 ml-4 border-l-2 border-border pl-4">
      {relevantEvents.map((event, idx) => (
        <ToolEventItem key={idx} event={event} />
      ))}
    </div>
  );
}

function ToolEventItem({ event }: { event: any }) {
  const [expanded, setExpanded] = React.useState(false);
  const isResult = event.type === "tool_result";
  
  if (isResult) {
    return (
       <div className="flex flex-col gap-1">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent transition-colors py-1"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <CheckCircle2 size={14} className="text-accent-green" />
            <span className="font-mono">Output: {event.tool}</span>
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-bg-secondary p-3 rounded-lg border border-border font-mono text-[11px] whitespace-pre-wrap max-h-64 overflow-y-auto mt-1">
                  {event.result}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
       </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-text-secondary py-1">
      <div className="w-1 h-1 rounded-full bg-accent animate-ping" />
      <TerminalIcon size={14} className="text-accent" />
      <span className="font-mono">Running: <span className="text-text-primary">{event.tool}</span></span>
      {event.args?.command && <span className="text-accent/70 ml-1 truncate max-w-xs">{event.args.command}</span>}
      {event.args?.path && <span className="text-accent/70 ml-1 truncate max-w-xs">{event.args.path}</span>}
    </div>
  );
}
