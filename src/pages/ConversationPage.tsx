import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Terminal as TerminalIcon, FileCode, FolderOpen, Globe,
  Maximize2, Minimize2, Pencil, ArrowLeft, Cpu, MessageSquare,
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
  const [activeTab, setActiveTab] = React.useState<Tab>("terminal");
  const [mobileView, setMobileView] = React.useState<MobileView>("chat");
  const [selectedFilePath, setSelectedFilePath] = React.useState<string | null>(null);
  const [chatWidth, setChatWidth] = React.useState(380);
  const [panelMaximized, setPanelMaximized] = React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [models, setModels] = React.useState<any[]>([]);
  const [convModel, setConvModel] = React.useState(selectedModel);

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
      ["agent_status","message_start","message_token","message_done","tool_use","tool_result"]
        .forEach((e) => socket.off(e));
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
    setMobileView("tools");
  };

  if (!id) return null;

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "terminal", label: "Terminal", icon: TerminalIcon },
    { id: "files", label: "Files", icon: FolderOpen },
    { id: "editor", label: "Editor", icon: FileCode },
    { id: "browser", label: "Preview", icon: Globe },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Desktop layout ─────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Chat panel */}
        {!panelMaximized && (
          <div style={{ width: chatWidth, minWidth: 280, maxWidth: 600 }} className="flex-shrink-0 h-full">
            <ChatInterface conversationId={id} />
          </div>
        )}

        {/* Resize handle */}
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

        {/* Tools panel */}
        <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: "var(--color-bg)" }}>
          <ToolsTopBar
            tabs={TABS} activeTab={activeTab} setActiveTab={setActiveTab}
            panelMaximized={panelMaximized} setPanelMaximized={setPanelMaximized}
            editingTitle={editingTitle} setEditingTitle={setEditingTitle}
            title={title} setTitle={setTitle} saveTitle={saveTitle}
            models={models} convModel={convModel} changeModel={changeModel}
            onBack={() => setPanelMaximized(false)}
            showBack={panelMaximized}
          />
          <ToolsContent activeTab={activeTab} conversationId={id} selectedFilePath={selectedFilePath} onFileSelect={handleFileSelect} />
        </div>
      </div>

      {/* ── Mobile layout ──────────────────────────────── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        {/* Mobile top bar */}
        <div className="h-12 flex items-center px-3 gap-2 border-b flex-shrink-0"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <button onClick={() => navigate("/")} className="p-2 rounded-lg flex-shrink-0" style={{ color: "var(--color-muted)" }}>
            <ArrowLeft size={18} />
          </button>
          <span className="text-sm font-semibold truncate flex-1">{title || "Conversation"}</span>
          {models.length > 0 && (
            <select value={convModel} onChange={(e) => changeModel(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg outline-none flex-shrink-0"
              style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-muted)", maxWidth: 110 }}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
        </div>

        {/* Mobile view switcher */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <button onClick={() => setMobileView("chat")}
            className="flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            style={{ color: mobileView === "chat" ? "var(--color-cyan)" : "var(--color-muted)", borderBottom: mobileView === "chat" ? "2px solid var(--color-cyan)" : "2px solid transparent" }}>
            <MessageSquare size={14} /> Chat
          </button>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileView("tools"); }}
              className="flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              style={{ color: mobileView === "tools" && activeTab === tab.id ? "var(--color-cyan)" : "var(--color-muted)", borderBottom: mobileView === "tools" && activeTab === tab.id ? "2px solid var(--color-cyan)" : "2px solid transparent" }}>
              {React.createElement(tab.icon, { size: 13 })}
              <span className="hidden xs:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Mobile content */}
        <div className="flex-1 overflow-hidden">
          {mobileView === "chat" ? (
            <ChatInterface conversationId={id} />
          ) : (
            <ToolsContent activeTab={activeTab} conversationId={id} selectedFilePath={selectedFilePath} onFileSelect={handleFileSelect} />
          )}
        </div>
      </div>
    </div>
  );
}

function ToolsTopBar({ tabs, activeTab, setActiveTab, panelMaximized, setPanelMaximized, editingTitle, setEditingTitle, title, setTitle, saveTitle, models, convModel, changeModel, onBack, showBack }: any) {
  return (
    <div className="h-12 border-b flex items-center px-3 gap-2 flex-shrink-0"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      {showBack && (
        <button onClick={onBack} className="p-1.5 rounded flex-shrink-0" style={{ color: "var(--color-muted)" }}>
          <ArrowLeft size={15} />
        </button>
      )}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {tabs.map((tab: any) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
              style={{
                background: activeTab === tab.id ? "var(--color-surface3)" : "transparent",
                color: activeTab === tab.id ? "white" : "var(--color-muted)",
                border: activeTab === tab.id ? "1px solid var(--color-border2)" : "1px solid transparent",
              }}>
              <Icon size={12} />
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* Title editor */}
      {editingTitle ? (
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
          autoFocus className="text-xs px-2 py-1 rounded outline-none flex-shrink-0"
          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-cyan2)", color: "var(--color-text)", width: 160 }} />
      ) : (
        <button onClick={() => setEditingTitle(true)}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors flex-shrink-0 max-w-32"
          style={{ color: "var(--color-muted)" }}>
          <span className="truncate">{title}</span>
          <Pencil size={10} className="flex-shrink-0" />
        </button>
      )}
      {models.length > 0 && (
        <select value={convModel} onChange={(e) => changeModel(e.target.value)}
          className="text-xs px-2 py-1 rounded-lg outline-none flex-shrink-0"
          style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-muted)", fontFamily: "var(--font-mono)", maxWidth: 130 }}>
          {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
      <button onClick={() => setPanelMaximized(!panelMaximized)}
        className="p-1.5 rounded transition-colors flex-shrink-0" style={{ color: "var(--color-muted)" }}>
        {panelMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );
}

function ToolsContent({ activeTab, conversationId, selectedFilePath, onFileSelect }: any) {
  return (
    <div className="flex-1 overflow-hidden relative h-full">
      <div className={cn("absolute inset-0", activeTab !== "terminal" && "hidden")}>
        <Terminal conversationId={conversationId} />
      </div>
      <div className={cn("absolute inset-0", activeTab !== "files" && "hidden")}>
        <FileExplorer conversationId={conversationId} onFileSelect={onFileSelect} activePath={selectedFilePath} />
      </div>
      <div className={cn("absolute inset-0", activeTab !== "editor" && "hidden")}>
        <CodeEditor conversationId={conversationId} filePath={selectedFilePath} />
      </div>
      <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-3", activeTab !== "browser" && "hidden")}
        style={{ background: "var(--color-bg)" }}>
        <Globe size={40} style={{ color: "var(--color-faint)" }} />
        <p className="text-sm font-mono" style={{ color: "var(--color-faint)" }}>No preview available</p>
      </div>
    </div>
  );
}
