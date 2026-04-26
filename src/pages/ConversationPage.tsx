import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Terminal as TerminalIcon, FileCode, FolderOpen, Globe, Maximize2, Minimize2, MoreHorizontal, Pencil, ChevronLeft, Cpu } from "lucide-react";
import { useConversationStore } from "@/src/stores/conversation-store";
import { useEventStore } from "@/src/stores/event-store";
import { useAgentStore } from "@/src/stores/agent-store";
import { useSettingsStore } from "@/src/stores/settings-store";
import { getSocket, joinConversation, sendAgentMessage } from "@/src/socket/socket";
import { getConversation, updateConversation, getModels } from "@/src/api/conversations";
import { cn } from "@/src/lib/utils";
import ChatInterface from "@/src/components/chat/ChatInterface";
import Terminal from "@/src/components/terminal/Terminal";
import FileExplorer from "@/src/components/files/FileExplorer";
import CodeEditor from "@/src/components/editor/CodeEditor";

type Tab = "terminal" | "files" | "editor" | "browser";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveConversationId, updateConversation: updateStore } = useConversationStore();
  const { addMessage, appendToken, finalizeMessage, addToolEvent, clearAll } = useEventStore();
  const { setStatus } = useAgentStore();
  const { selectedModel } = useSettingsStore();
  const [activeTab, setActiveTab] = React.useState<Tab>("terminal");
  const [selectedFilePath, setSelectedFilePath] = React.useState<string | null>(null);
  const [chatWidth, setChatWidth] = React.useState(380);
  const [panelMaximized, setPanelMaximized] = React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [models, setModels] = React.useState<any[]>([]);
  const [convModel, setConvModel] = React.useState(selectedModel);
  const titleRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!id) return;
    setActiveConversationId(id);
    clearAll();
    joinConversation(id);
    getModels().then(setModels);
    getConversation(id).then((data) => {
      data.messages?.forEach((msg: any) => addMessage(msg));
      setTitle(data.title || "New Conversation");
      setConvModel(data.model || selectedModel);
    });
    const initialMsg = sessionStorage.getItem(`initial_msg_${id}`);
    if (initialMsg) { sendAgentMessage(id, initialMsg, selectedModel); sessionStorage.removeItem(`initial_msg_${id}`); }

    const socket = getSocket();
    socket.on("agent_status", ({ status }) => setStatus(status));
    socket.on("message_start", (msg) => addMessage({ ...msg, content: "", isStreaming: true }));
    socket.on("message_token", ({ id: msgId, token }) => appendToken(msgId, token));
    socket.on("message_done", ({ id: msgId }) => finalizeMessage(msgId));
    socket.on("tool_use", (event) => addToolEvent({ type: "tool_use", ...event }));
    socket.on("tool_result", (event) => addToolEvent({ type: "tool_result", ...event }));
    return () => {
      ["agent_status", "message_start", "message_token", "message_done", "tool_use", "tool_result"].forEach((e) => socket.off(e));
    };
  }, [id]);

  const saveTitle = async () => {
    setEditingTitle(false);
    if (!id || !title.trim()) return;
    await updateConversation(id, { title });
    updateStore(id, { title });
  };

  const changeModel = async (model: string) => {
    setConvModel(model);
    if (id) await updateConversation(id, { model });
  };

  const handleFileSelect = (path: string) => {
    setSelectedFilePath(path);
    setActiveTab("editor");
  };

  if (!id) return null;

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "terminal", label: "Terminal", icon: TerminalIcon },
    { id: "files", label: "Files", icon: FolderOpen },
    { id: "editor", label: "Editor", icon: FileCode },
    { id: "browser", label: "Preview", icon: Globe },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat Panel */}
      {!panelMaximized && (
        <div style={{ width: chatWidth, minWidth: 280, maxWidth: 600 }} className="flex-shrink-0 h-full">
          <ChatInterface conversationId={id} />
        </div>
      )}

      {/* Resize Handle */}
      {!panelMaximized && (
        <div
          className="w-1 hover:w-1.5 cursor-col-resize transition-all flex-shrink-0 z-20"
          style={{ background: "var(--color-border)" }}
          onMouseDown={(e) => {
            const startX = e.clientX; const startW = chatWidth;
            const move = (ev: MouseEvent) => { const nw = startW + ev.clientX - startX; if (nw > 280 && nw < 700) setChatWidth(nw); };
            const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-cyan2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-border)")}
        />
      )}

      {/* Right Panel */}
      <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: "var(--color-bg)" }}>
        {/* Top Bar */}
        <div className="h-12 border-b flex items-center px-4 gap-3 flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          {panelMaximized && (
            <button onClick={() => setPanelMaximized(false)} className="p-1.5 rounded" style={{ color: "var(--color-muted)" }}>
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 flex-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: activeTab === tab.id ? "var(--color-surface3)" : "transparent",
                    color: activeTab === tab.id ? "white" : "var(--color-muted)",
                    border: activeTab === tab.id ? "1px solid var(--color-border2)" : "1px solid transparent",
                  }}>
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Title editor */}
          <div className="flex items-center gap-2">
            {editingTitle ? (
              <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                className="text-xs px-2 py-1 rounded outline-none" autoFocus
                style={{ background: "var(--color-surface2)", border: "1px solid var(--color-cyan2)", color: "var(--color-text)", width: 200 }} />
            ) : (
              <button onClick={() => setEditingTitle(true)} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors" style={{ color: "var(--color-muted)" }}>
                <span className="truncate max-w-32">{title}</span>
                <Pencil size={10} />
              </button>
            )}
          </div>

          {/* Model selector */}
          <select value={convModel} onChange={(e) => changeModel(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg outline-none"
            style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <button onClick={() => setPanelMaximized(!panelMaximized)} className="p-1.5 rounded transition-colors" style={{ color: "var(--color-muted)" }}>
            {panelMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          <div className={cn("absolute inset-0", activeTab !== "terminal" && "hidden")}><Terminal conversationId={id} /></div>
          <div className={cn("absolute inset-0", activeTab !== "files" && "hidden")}><FileExplorer conversationId={id} onFileSelect={handleFileSelect} activePath={selectedFilePath} /></div>
          <div className={cn("absolute inset-0", activeTab !== "editor" && "hidden")}><CodeEditor conversationId={id} filePath={selectedFilePath} /></div>
          <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-4", activeTab !== "browser" && "hidden")} style={{ background: "var(--color-bg)" }}>
            <Globe size={48} style={{ color: "var(--color-faint)" }} />
            <p className="text-sm font-mono" style={{ color: "var(--color-faint)" }}>No preview available</p>
            <p className="text-xs" style={{ color: "var(--color-faint)" }}>Run a dev server and it will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
