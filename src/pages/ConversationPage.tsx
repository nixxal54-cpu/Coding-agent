--- START OF FILE Coding-agent-main/src/pages/ConversationPage.tsx ---
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Terminal as TerminalIcon, FileCode, FolderOpen, Globe,
  Maximize2, Minimize2, Pencil, ArrowLeft, Cpu, MessageSquare, RotateCcw, ExternalLink
} from "lucide-react";
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
type MobileView = "chat" | "tools";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveConversationId, updateConversation: updateStore } = useConversationStore();
  const { addMessage, appendToken, finalizeMessage, addToolEvent, clearAll } = useEventStore();
  const { setStatus } = useAgentStore();
  const { selectedModel } = useSettingsStore();
  const [activeTab, setActiveTab] = React.useState<Tab>("editor");
  const [mobileView, setMobileView] = React.useState<MobileView>("chat");
  const [selectedFilePath, setSelectedFilePath] = React.useState<string | null>(null);
  const [chatWidth, setChatWidth] = React.useState(420);
  const [panelMaximized, setPanelMaximized] = React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [title, setTitle] = React.useState("");

  React.useEffect(() => {
    if (!id) return;
    setActiveConversationId(id);
    clearAll();
    joinConversation(id);
    getConversation(id).then((data) => {
      data.messages?.forEach((msg: any) => addMessage(msg));
      setTitle(data.title || "New Project");
    });
    const initialMsg = sessionStorage.getItem(`initial_msg_${id}`);
    if (initialMsg) {
      sendAgentMessage(id, initialMsg, selectedModel);
      sessionStorage.removeItem(`initial_msg_${id}`);
    }
    const socket = getSocket();
    socket.on("agent_status", ({ status }) => setStatus(status));
    socket.on("message_start", (msg) => addMessage({ ...msg, content: "", isStreaming: true }));
    socket.on("message_token", ({ id: msgId, token }) => appendToken(msgId, token));
    socket.on("message_done", ({ id: msgId }) => finalizeMessage(msgId));
    socket.on("tool_use", (event) => addToolEvent({ type: "tool_use", ...event }));
    socket.on("tool_result", (event) => addToolEvent({ type: "tool_result", ...event }));
    return () => {
      ["agent_status","message_start","message_token","message_done","tool_use","tool_result"].forEach((e) => socket.off(e));
    };
  }, [id]);

  const saveTitle = async () => {
    setEditingTitle(false);
    if (!id || !title.trim()) return;
    await updateConversation(id, { title });
    updateStore(id, { title });
  };

  const handleFileSelect = (path: string) => {
    setSelectedFilePath(path);
    setActiveTab("editor");
    setMobileView("tools");
  };

  if (!id) return null;

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "files", label: "Files", icon: FolderOpen },
    { id: "editor", label: "Editor", icon: FileCode },
    { id: "terminal", label: "Terminal", icon: TerminalIcon },
    { id: "browser", label: "Preview", icon: Globe },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      <div className="hidden md:flex flex-1 overflow-hidden p-2 gap-2">
        {/* Chat Panel */}
        {!panelMaximized && (
          <div style={{ width: chatWidth, minWidth: 320, maxWidth: 800 }} className="flex-shrink-0 h-full rounded-2xl overflow-hidden border border-zinc-800">
            <ChatInterface conversationId={id} />
          </div>
        )}

        {/* Resize Handle */}
        {!panelMaximized && (
          <div
            className="w-1.5 hover:bg-zinc-700 cursor-col-resize transition-all rounded-full z-20"
            onMouseDown={(e) => {
              const startX = e.clientX; const startW = chatWidth;
              const move = (ev: MouseEvent) => { const nw = startW + ev.clientX - startX; if (nw > 300 && nw < 800) setChatWidth(nw); };
              const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
              window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
            }}
          />
        )}

        {/* Workspace Panel */}
        <div className="flex-1 h-full flex flex-col rounded-2xl overflow-hidden border border-zinc-800" style={{ background: "var(--color-surface)" }}>
          <ToolsTopBar
            tabs={TABS} activeTab={activeTab} setActiveTab={setActiveTab}
            panelMaximized={panelMaximized} setPanelMaximized={setPanelMaximized}
            editingTitle={editingTitle} setEditingTitle={setEditingTitle}
            title={title} setTitle={setTitle} saveTitle={saveTitle}
          />
          <ToolsContent activeTab={activeTab} conversationId={id} selectedFilePath={selectedFilePath} onFileSelect={handleFileSelect} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        <div className="h-14 flex items-center px-4 gap-3 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
          <button onClick={() => navigate("/")} className="text-zinc-400"><ArrowLeft size={20} /></button>
          <span className="text-[15px] font-semibold text-white truncate">{title || "Workspace"}</span>
        </div>
        <div className="flex border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
          <button onClick={() => setMobileView("chat")} className="flex-1 py-3 text-sm font-medium flex justify-center gap-2 transition-colors" style={{ color: mobileView === "chat" ? "white" : "var(--color-muted)", borderBottom: mobileView === "chat" ? "2px solid white" : "2px solid transparent" }}><MessageSquare size={16} /> Chat</button>
          <button onClick={() => { setActiveTab("editor"); setMobileView("tools"); }} className="flex-1 py-3 text-sm font-medium flex justify-center gap-2 transition-colors" style={{ color: mobileView === "tools" ? "white" : "var(--color-muted)", borderBottom: mobileView === "tools" ? "2px solid white" : "2px solid transparent" }}><FileCode size={16} /> Code</button>
        </div>
        <div className="flex-1 overflow-hidden">
          {mobileView === "chat" ? <ChatInterface conversationId={id} /> : <ToolsContent activeTab={activeTab} conversationId={id} selectedFilePath={selectedFilePath} onFileSelect={handleFileSelect} />}
        </div>
      </div>
    </div>
  );
}

function ToolsTopBar({ tabs, activeTab, setActiveTab, panelMaximized, setPanelMaximized, editingTitle, setEditingTitle, title, setTitle, saveTitle }: any) {
  return (
    <div className="h-14 border-b border-zinc-800 bg-[#0e0e11] flex items-center px-4 gap-4 flex-shrink-0">
      {/* Title */}
      {editingTitle ? (
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); }}
          autoFocus className="text-sm px-2 py-1 rounded outline-none bg-zinc-800 text-white w-48 border border-blue-500" />
      ) : (
        <button onClick={() => setEditingTitle(true)} className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors max-w-48">
          <span className="truncate">{title}</span><Pencil size={12} />
        </button>
      )}

      {/* Tabs */}
      <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50 flex-1 justify-center max-w-[400px] mx-auto">
        {tabs.map((tab: any) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center justify-center gap-2 flex-1 py-1.5 rounded-lg text-[13px] font-medium transition-all"
              style={{ background: activeTab === tab.id ? "var(--color-surface3)" : "transparent", color: activeTab === tab.id ? "white" : "var(--color-muted)", boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.2)" : "none" }}>
              <Icon size={14} /> <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <button onClick={() => setPanelMaximized(!panelMaximized)} className="p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white ml-auto">
        {panelMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );
}

function BrowserPreview() {
  const [url, setUrl] = React.useState("http://localhost:5173");
  const [iframeKey, setIframeKey] = React.useState(0);

  return (
    <div className="flex flex-col h-full bg-[#1e1e24]">
      {/* Mock Browser URL Bar */}
      <div className="h-12 bg-[#2a2a35] flex items-center px-4 gap-3 border-b border-zinc-800/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <button onClick={() => setIframeKey(k => k + 1)} className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400 ml-2">
          <RotateCcw size={14} />
        </button>
        <div className="flex-1 max-w-2xl bg-[#1e1e24] border border-zinc-700/50 rounded-lg px-3 py-1.5 flex items-center shadow-inner">
          <Globe size={14} className="text-zinc-500 mr-2" />
          <input value={url} onChange={e => setUrl(e.target.value)} className="bg-transparent flex-1 text-[13px] outline-none text-zinc-300 font-mono" />
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400">
          <ExternalLink size={14} />
        </a>
      </div>
      <div className="flex-1 bg-white">
        <iframe key={iframeKey} src={url} className="w-full h-full border-none bg-white" title="Preview" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" />
      </div>
    </div>
  );
}

function ToolsContent({ activeTab, conversationId, selectedFilePath, onFileSelect }: any) {
  return (
    <div className="flex-1 overflow-hidden relative h-full bg-[#0e0e11]">
      <div className={cn("absolute inset-0", activeTab !== "terminal" && "hidden")}><Terminal conversationId={conversationId} /></div>
      <div className={cn("absolute inset-0", activeTab !== "files" && "hidden")}><FileExplorer conversationId={conversationId} onFileSelect={onFileSelect} activePath={selectedFilePath} /></div>
      <div className={cn("absolute inset-0", activeTab !== "editor" && "hidden")}><CodeEditor conversationId={conversationId} filePath={selectedFilePath} /></div>
      <div className={cn("absolute inset-0", activeTab !== "browser" && "hidden")}><BrowserPreview /></div>
    </div>
  );
}
--- END OF FILE Coding-agent-main/src/pages/ConversationPage.tsx ---
