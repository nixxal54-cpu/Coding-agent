import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Terminal as TerminalIcon, FileCode, FolderOpen, Globe,
  Maximize2, Minimize2, Pencil, ArrowLeft, MessageSquare, RotateCcw,
  ExternalLink, Check, X
} from "lucide-react";
import toast from "react-hot-toast";
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
  const [chatWidth, setChatWidth] = React.useState(400);
  const [panelMaximized, setPanelMaximized] = React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [titleInput, setTitleInput] = React.useState("");
  const isDragging = React.useRef(false);

  React.useEffect(() => {
    if (!id) return;
    setActiveConversationId(id);
    clearAll();
    const socket = getSocket();

    const onAgentStatus = ({ status }: any) => setStatus(status);
    const onMessageStart = (msg: any) => addMessage({ ...msg, content: "", isStreaming: true });
    const onMessageToken = ({ id: msgId, token }: any) => appendToken(msgId, token);
    const onMessageDone = ({ id: msgId }: any) => finalizeMessage(msgId);
    const onToolUse = (event: any) => addToolEvent({ type: "tool_use", ...event });
    const onToolResult = (event: any) => addToolEvent({ type: "tool_result", ...event });
    const onError = ({ message }: any) => {
      toast.error("Agent error: " + message);
      setStatus("idle");
      addMessage({ id: `error-${Date.now()}`, role: "assistant", content: `⚠️ **Error:** ${message}`, timestamp: new Date().toISOString() });
    };
    const onJoined = (data: any) => {
      const initialMsg = sessionStorage.getItem(`initial_msg_${id}`);
      if (initialMsg) { sendAgentMessage(id, initialMsg, selectedModel); sessionStorage.removeItem(`initial_msg_${id}`); }
    };

    socket.on("joined", onJoined);
    socket.on("agent_status", onAgentStatus);
    socket.on("message_start", onMessageStart);
    socket.on("message_token", onMessageToken);
    socket.on("message_done", onMessageDone);
    socket.on("tool_use", onToolUse);
    socket.on("tool_result", onToolResult);
    socket.on("agent_error", onError);

    getConversation(id).then((data) => {
      data.messages?.forEach((msg: any) => addMessage(msg));
      setTitle(data.title || "New Project");
      setTitleInput(data.title || "New Project");
    });
    joinConversation(id);

    return () => {
      socket.off("joined", onJoined);
      socket.off("agent_status", onAgentStatus);
      socket.off("message_start", onMessageStart);
      socket.off("message_token", onMessageToken);
      socket.off("message_done", onMessageDone);
      socket.off("tool_use", onToolUse);
      socket.off("tool_result", onToolResult);
      socket.off("agent_error", onError);
    };
  }, [id]);

  const saveTitle = async () => {
    setEditingTitle(false);
    if (!id || !titleInput.trim() || titleInput === title) return;
    setTitle(titleInput);
    await updateConversation(id, { title: titleInput });
    updateStore(id, { title: titleInput });
  };

  const cancelTitle = () => {
    setEditingTitle(false);
    setTitleInput(title);
  };

  const handleFileSelect = (path: string) => {
    setSelectedFilePath(path);
    setActiveTab("editor");
    setMobileView("tools");
  };

  if (!id) return null;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "files",    label: "Files",    icon: FolderOpen },
    { id: "editor",   label: "Editor",   icon: FileCode },
    { id: "terminal", label: "Terminal", icon: TerminalIcon },
    { id: "browser",  label: "Preview",  icon: Globe },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--color-bg)" }}>
      {/* ── Desktop layout ── */}
      <div className="hidden md:flex flex-1 overflow-hidden gap-0">
        {/* Chat panel */}
        {!panelMaximized && (
          <div
            style={{ width: chatWidth, minWidth: 300, maxWidth: 680, flexShrink: 0 }}
            className="h-full border-r"
            style={{ width: chatWidth, minWidth: 300, maxWidth: 680, flexShrink: 0, borderRight: "1px solid var(--color-border)" }}
          >
            <ChatInterface conversationId={id} />
          </div>
        )}

        {/* Resize handle */}
        {!panelMaximized && (
          <div
            className="w-[3px] cursor-col-resize z-20 flex-shrink-0 group"
            style={{ background: "transparent" }}
            onMouseDown={(e) => {
              isDragging.current = true;
              const startX = e.clientX;
              const startW = chatWidth;
              const move = (ev: MouseEvent) => {
                if (!isDragging.current) return;
                const nw = startW + ev.clientX - startX;
                if (nw > 280 && nw < 700) setChatWidth(nw);
              };
              const up = () => {
                isDragging.current = false;
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
              };
              window.addEventListener("mousemove", move);
              window.addEventListener("mouseup", up);
            }}
          >
            <div className="w-full h-full group-hover:bg-cyan-500/30 transition-colors duration-150" />
          </div>
        )}

        {/* Workspace panel */}
        <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: "var(--color-surface)" }}>
          <WorkspaceTopBar
            tabs={TABS} activeTab={activeTab} setActiveTab={setActiveTab}
            panelMaximized={panelMaximized} setPanelMaximized={setPanelMaximized}
            editingTitle={editingTitle} setEditingTitle={setEditingTitle}
            title={title} titleInput={titleInput} setTitleInput={setTitleInput}
            saveTitle={saveTitle} cancelTitle={cancelTitle}
          />
          <WorkspaceContent activeTab={activeTab} conversationId={id} selectedFilePath={selectedFilePath} onFileSelect={handleFileSelect} />
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        <div className="h-12 flex items-center px-4 gap-3 border-b flex-shrink-0"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <button onClick={() => navigate("/")} style={{ color: "var(--color-muted)" }}>
            <ArrowLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-white truncate flex-1">{title}</span>
        </div>
        <div className="flex border-b flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          {[
            { key: "chat", icon: MessageSquare, label: "Chat" },
            { key: "tools", icon: FileCode, label: "Code" },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key}
              onClick={() => { if (key === "tools") setActiveTab("editor"); setMobileView(key as MobileView); }}
              className="flex-1 py-2.5 text-xs font-medium flex justify-center gap-2 items-center transition-colors"
              style={{
                color: mobileView === key ? "white" : "var(--color-muted)",
                borderBottom: mobileView === key ? "2px solid var(--color-cyan)" : "2px solid transparent",
              }}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {mobileView === "chat"
            ? <ChatInterface conversationId={id} />
            : <WorkspaceContent activeTab={activeTab} conversationId={id} selectedFilePath={selectedFilePath} onFileSelect={handleFileSelect} />
          }
        </div>
      </div>
    </div>
  );
}

function WorkspaceTopBar({ tabs, activeTab, setActiveTab, panelMaximized, setPanelMaximized, editingTitle, setEditingTitle, title, titleInput, setTitleInput, saveTitle, cancelTitle }: any) {
  return (
    <div className="h-[52px] border-b flex items-center px-4 gap-3 flex-shrink-0"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>

      {/* Editable title */}
      <div className="flex items-center gap-1.5 min-w-0 flex-shrink">
        {editingTitle ? (
          <div className="flex items-center gap-1.5">
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") cancelTitle(); }}
              autoFocus
              className="text-sm px-2.5 py-1 rounded-lg outline-none w-44"
              style={{ background: "var(--color-surface2)", border: "1px solid var(--color-cyan2)", color: "white" }}
            />
            <button onClick={saveTitle} className="p-1 rounded" style={{ color: "var(--color-green)" }}><Check size={13} /></button>
            <button onClick={cancelTitle} className="p-1 rounded" style={{ color: "var(--color-muted)" }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setEditingTitle(true)}
            className="flex items-center gap-1.5 max-w-[160px] group"
            title="Rename project">
            <span className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{title}</span>
            <Pencil size={11} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--color-muted)" }} />
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 flex-1 justify-center">
        <div className="flex items-center p-1 rounded-xl gap-0.5" style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>
          {tabs.map((tab: any) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: isActive ? "var(--color-surface3)" : "transparent",
                  color: isActive ? "white" : "var(--color-muted)",
                  boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.25)" : "none",
                }}>
                <Icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Maximize */}
      <button onClick={() => setPanelMaximized(!panelMaximized)}
        className="p-2 rounded-lg transition-colors flex-shrink-0"
        style={{ color: "var(--color-muted)", background: "transparent" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface2)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--color-muted)"; }}>
        {panelMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );
}

function BrowserPreview() {
  const [url, setUrl] = React.useState("http://localhost:5173");
  const [iframeKey, setIframeKey] = React.useState(0);

  return (
    <div className="flex flex-col h-full" style={{ background: "#0d0d14" }}>
      <div className="h-11 flex items-center px-4 gap-3 border-b" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f87171" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#fbbf24" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#34d399" }} />
        </div>
        <button onClick={() => setIframeKey((k) => k + 1)} className="p-1 rounded" style={{ color: "var(--color-muted)" }}>
          <RotateCcw size={13} />
        </button>
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
          <Globe size={12} style={{ color: "var(--color-muted)", flexShrink: 0 }} />
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            className="bg-transparent flex-1 outline-none font-mono text-xs"
            style={{ color: "var(--color-text)" }} />
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="p-1 rounded" style={{ color: "var(--color-muted)" }}>
          <ExternalLink size={13} />
        </a>
      </div>
      <div className="flex-1 bg-white">
        <iframe key={iframeKey} src={url} className="w-full h-full border-none"
          title="Preview" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" />
      </div>
    </div>
  );
}

function WorkspaceContent({ activeTab, conversationId, selectedFilePath, onFileSelect }: any) {
  return (
    <div className="flex-1 overflow-hidden relative h-full" style={{ background: "var(--color-bg)" }}>
      <div className={cn("absolute inset-0", activeTab !== "terminal" && "hidden")}><Terminal conversationId={conversationId} /></div>
      <div className={cn("absolute inset-0", activeTab !== "files"    && "hidden")}><FileExplorer conversationId={conversationId} onFileSelect={onFileSelect} activePath={selectedFilePath} /></div>
      <div className={cn("absolute inset-0", activeTab !== "editor"   && "hidden")}><CodeEditor conversationId={conversationId} filePath={selectedFilePath} /></div>
      <div className={cn("absolute inset-0", activeTab !== "browser"  && "hidden")}><BrowserPreview /></div>
    </div>
  );
}
