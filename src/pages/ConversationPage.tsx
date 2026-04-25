import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Terminal as TerminalIcon, 
  FileCode, 
  Layout, 
  Globe,
  Maximize2,
  Minimize2
} from "lucide-react";
import { useConversationStore } from "@/src/stores/conversation-store";
import { useEventStore } from "@/src/stores/event-store";
import { useAgentStore } from "@/src/stores/agent-store";
import { getSocket, joinConversation, sendAgentMessage } from "@/src/socket/socket";
import { getConversation } from "@/src/api/conversations";
import { cn } from "@/src/lib/utils";
import ChatInterface from "@/src/components/chat/ChatInterface";
import Terminal from "@/src/components/terminal/Terminal";
import FileExplorer from "@/src/components/files/FileExplorer";
import CodeEditor from "@/src/components/editor/CodeEditor";

type Tab = "terminal" | "files" | "editor" | "browser";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveConversationId } = useConversationStore();
  const { addMessage, appendToken, finalizeMessage, addToolEvent, clearAll } = useEventStore();
  const { setStatus } = useAgentStore();
  
  const [activeTab, setActiveTab] = React.useState<Tab>("terminal");
  const [selectedFilePath, setSelectedFilePath] = React.useState<string | null>(null);
  const [chatWidth, setChatWidth] = React.useState(400); // px

  React.useEffect(() => {
    if (!id) return;
    setActiveConversationId(id);
    clearAll();
    
    // Join socket room
    joinConversation(id);
    
    // Load existing messages
    getConversation(id).then((data) => {
        data.messages.forEach((msg: any) => addMessage(msg));
    });

    // Handle initial message from session storage
    const initialMsg = sessionStorage.getItem(`initial_msg_${id}`);
    if (initialMsg) {
        sendAgentMessage(id, initialMsg);
        sessionStorage.removeItem(`initial_msg_${id}`);
    }

    // Socket listeners
    const socket = getSocket();
    socket.on("agent_status", ({ status }) => setStatus(status));
    socket.on("message_start", (msg) => addMessage({ ...msg, content: "", isStreaming: true }));
    socket.on("message_token", ({ id: msgId, token }) => appendToken(msgId, token));
    socket.on("message_done", ({ id: msgId }) => finalizeMessage(msgId));
    socket.on("tool_use", (event) => addToolEvent({ type: "tool_use", ...event }));
    socket.on("tool_result", (event) => addToolEvent({ type: "tool_result", ...event }));
    socket.on("error", ({ message }) => console.error(message));

    return () => {
      socket.off("agent_status");
      socket.off("message_start");
      socket.off("message_token");
      socket.off("message_done");
      socket.off("tool_use");
      socket.off("tool_result");
      socket.off("error");
    };
  }, [id]);

  const handleFileSelect = (path: string) => {
    setSelectedFilePath(path);
    setActiveTab("editor");
  };

  if (!id) return null;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Center Panel (Chat) */}
      <div 
        style={{ width: chatWidth }}
        className="h-full flex-shrink-0"
      >
        <ChatInterface conversationId={id} />
      </div>

      {/* Resize Handle */}
      <div 
        className="w-1 hover:w-1.5 bg-border hover:bg-accent cursor-col-resize transition-all shrink-0 z-20"
        onMouseDown={(e) => {
            const startX = e.clientX;
            const startWidth = chatWidth;
            const move = (moveE: MouseEvent) => {
                const newWidth = startWidth + (moveE.clientX - startX);
                if (newWidth > 300 && newWidth < 800) setChatWidth(newWidth);
            };
            const up = () => {
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
        }}
      />

      {/* Right Panel (Tools) */}
      <div className="flex-1 h-full flex flex-col bg-bg-secondary overflow-hidden">
        {/* Tabs */}
        <div className="h-12 border-b border-border flex items-center px-4 justify-between flex-shrink-0">
          <div className="flex items-center gap-1">
             <TabButton 
                active={activeTab === "terminal"} 
                onClick={() => setActiveTab("terminal")}
                icon={<TerminalIcon size={14} />}
                label="Terminal"
             />
             <TabButton 
                active={activeTab === "files"} 
                onClick={() => setActiveTab("files")}
                icon={<Layout size={14} />}
                label="Files"
             />
             <TabButton 
                active={activeTab === "editor"} 
                onClick={() => setActiveTab("editor")}
                icon={<FileCode size={14} />}
                label="Editor"
             />
             <TabButton 
                active={activeTab === "browser"} 
                onClick={() => setActiveTab("browser")}
                icon={<Globe size={14} />}
                label="Browser"
             />
          </div>
          <button className="text-text-muted hover:text-text-primary p-2">
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 relative overflow-hidden">
          <div className={cn("absolute inset-0", activeTab !== "terminal" && "hidden")}>
            <Terminal conversationId={id} />
          </div>
          <div className={cn("absolute inset-0", activeTab !== "files" && "hidden")}>
            <FileExplorer conversationId={id} onFileSelect={handleFileSelect} activePath={selectedFilePath || undefined} />
          </div>
          <div className={cn("absolute inset-0", activeTab !== "editor" && "hidden")}>
            <CodeEditor conversationId={id} filePath={selectedFilePath} />
          </div>
          <div className={cn("absolute inset-0", activeTab !== "browser" && "hidden")}>
            <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-30 gap-4">
              <Globe size={64} strokeWidth={1} />
              <p className="text-sm font-mono tracking-widest uppercase">No browser activity yet</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
        active 
          ? "bg-bg-tertiary text-text-primary border border-border" 
          : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
