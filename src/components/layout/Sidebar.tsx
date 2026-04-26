import React from "react";
import { Bot, Plus, MessageSquare, Settings, Trash2, ChevronRight, Pin, Search, X, Zap } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useConversationStore } from "@/src/stores/conversation-store";
import { createConversation, getConversations, deleteConversation, updateConversation } from "@/src/api/conversations";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversations, setConversations, activeConversationId, setActiveConversationId, removeConversation, updateConversation: updateStore } = useConversationStore();
  const [search, setSearch] = React.useState("");
  const [showSearch, setShowSearch] = React.useState(false);

  React.useEffect(() => { getConversations().then(setConversations); }, []);

  const handleNew = async () => {
    const conv = await createConversation({ title: "New Conversation" });
    setConversations([conv, ...conversations]);
    setActiveConversationId(conv.id);
    navigate(`/conversations/${conv.id}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteConversation(id);
    removeConversation(id);
    if (activeConversationId === id) { setActiveConversationId(null); navigate("/"); }
  };

  const handlePin = async (id: string, pinned: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateConversation(id, { pinned: !pinned });
    updateStore(id, { pinned: !pinned });
  };

  const filtered = conversations.filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));
  const pinned = filtered.filter((c) => c.pinned);
  const recent = filtered.filter((c) => !c.pinned);

  return (
    <aside className="w-[260px] h-screen flex flex-col border-r" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      {/* Header */}
      <div className="h-14 flex items-center px-4 gap-3 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-glow" style={{ background: "var(--color-cyan2)" }}>
          <Zap size={16} color="#000" fill="#000" />
        </div>
        <span className="font-bold text-white tracking-tight">APEX</span>
        <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--color-surface3)", color: "var(--color-cyan)" }}>v2</span>
      </div>

      {/* Actions */}
      <div className="p-3 flex gap-2 border-b" style={{ borderColor: "var(--color-border)" }}>
        <button onClick={handleNew} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90" style={{ background: "var(--color-cyan2)", color: "#000" }}>
          <Plus size={15} /> New Chat
        </button>
        <button onClick={() => setShowSearch(!showSearch)} className="p-2 rounded-lg transition-colors" style={{ background: showSearch ? "var(--color-surface3)" : "var(--color-surface2)", color: showSearch ? "var(--color-cyan)" : "var(--color-muted)" }}>
          <Search size={16} />
        </button>
      </div>

      {/* Search */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="p-3 pt-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)" }}>
                <Search size={13} style={{ color: "var(--color-muted)" }} />
                <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." className="flex-1 bg-transparent text-sm outline-none" style={{ color: "var(--color-text)" }} />
                {search && <button onClick={() => setSearch("")}><X size={12} style={{ color: "var(--color-muted)" }} /></button>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto p-2">
        {pinned.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-muted)" }}>Pinned</div>
            {pinned.map((c) => <ConvItem key={c.id} conv={c} active={activeConversationId === c.id} onPin={handlePin} onDelete={handleDelete} onClick={() => { setActiveConversationId(c.id); navigate(`/conversations/${c.id}`); }} />)}
          </div>
        )}
        {recent.length > 0 && (
          <div>
            {pinned.length > 0 && <div className="px-2 py-1 text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--color-muted)" }}>Recent</div>}
            {recent.map((c) => <ConvItem key={c.id} conv={c} active={activeConversationId === c.id} onPin={handlePin} onDelete={handleDelete} onClick={() => { setActiveConversationId(c.id); navigate(`/conversations/${c.id}`); }} />)}
          </div>
        )}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: "var(--color-muted)" }}>
            {search ? "No results" : "No conversations yet"}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t" style={{ borderColor: "var(--color-border)" }}>
        <button onClick={() => navigate("/settings")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80" style={{ color: "var(--color-muted)" }}>
          <Settings size={15} /> Settings
        </button>
      </div>
    </aside>
  );
}

function ConvItem({ conv, active, onClick, onPin, onDelete }: any) {
  const [hover, setHover] = React.useState(false);
  return (
    <motion.div
      layout
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative flex items-center gap-2 px-2 py-2.5 rounded-lg cursor-pointer mb-0.5 transition-colors"
      style={{ background: active ? "var(--color-surface3)" : hover ? "var(--color-surface2)" : "transparent", borderLeft: active ? "2px solid var(--color-cyan)" : "2px solid transparent" }}
    >
      <MessageSquare size={13} className="flex-shrink-0" style={{ color: active ? "var(--color-cyan)" : "var(--color-muted)" }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: active ? "white" : "var(--color-text)" }}>{conv.title}</div>
        <div className="text-xs" style={{ color: "var(--color-muted)" }}>{conv.message_count || 0} msgs · {new Date(conv.updated_at).toLocaleDateString()}</div>
      </div>
      {(hover || active) && (
        <div className="flex items-center gap-0.5">
          <button onClick={(e) => onPin(conv.id, conv.pinned, e)} className="p-1 rounded opacity-60 hover:opacity-100" style={{ color: conv.pinned ? "var(--color-cyan)" : "var(--color-muted)" }}><Pin size={11} /></button>
          <button onClick={(e) => onDelete(conv.id, e)} className="p-1 rounded opacity-60 hover:opacity-100" style={{ color: "var(--color-red)" }}><Trash2 size={11} /></button>
        </div>
      )}
    </motion.div>
  );
}
