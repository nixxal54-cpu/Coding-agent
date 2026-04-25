import React from "react";
import { 
  Bot, 
  Plus, 
  History, 
  Settings, 
  Trash2, 
  X 
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useConversationStore } from "@/src/stores/conversation-store";
import { createConversation, getConversations, deleteConversation } from "@/src/api/conversations";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    conversations, 
    setConversations, 
    activeConversationId, 
    setActiveConversationId,
    removeConversation
  } = useConversationStore();
  const [showHistory, setShowHistory] = React.useState(false);

  React.useEffect(() => {
    getConversations().then(setConversations);
  }, [setConversations]);

  const handleNewConversation = async () => {
    const conv = await createConversation();
    setConversations([conv, ...conversations]);
    setActiveConversationId(conv.id);
    navigate(`/conversations/${conv.id}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteConversation(id);
    removeConversation(id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
      navigate("/");
    }
  };

  return (
    <>
      <aside className="w-[75px] h-screen bg-bg-secondary border-r border-border flex flex-col items-center py-6 gap-8 z-50">
        <div 
          className="cursor-pointer hover:scale-110 transition-transform text-accent"
          onClick={() => navigate("/")}
        >
          <Bot size={32} />
        </div>

        <nav className="flex flex-col gap-6 flex-1">
          <button 
            onClick={handleNewConversation}
            className="p-3 bg-bg-tertiary hover:bg-bg-hover rounded-xl text-text-primary transition-colors"
            title="New Conversation"
          >
            <Plus size={24} />
          </button>

          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "p-3 rounded-xl transition-colors",
              showHistory ? "bg-accent text-white" : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            )}
            title="History"
          >
            <History size={24} />
          </button>
        </nav>

        <button className="p-3 text-text-muted hover:text-text-primary transition-colors">
          <Settings size={24} />
        </button>
      </aside>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 75 }}
            exit={{ x: -300 }}
            className="fixed top-0 bottom-0 w-80 bg-bg-secondary border-r border-border shadow-2xl z-40 p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold">History</h2>
              <button 
                onClick={() => setShowHistory(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    navigate(`/conversations/${conv.id}`);
                    setShowHistory(false);
                  }}
                  className={cn(
                    "p-4 rounded-xl cursor-pointer group relative flex flex-col gap-1 transition-all",
                    activeConversationId === conv.id 
                      ? "bg-bg-tertiary border border-accent/30" 
                      : "hover:bg-bg-hover border border-transparent"
                  )}
                >
                  <span className="font-medium truncate pr-6">{conv.title || "Untitled Conversation"}</span>
                  <span className="text-xs text-text-muted">
                    {new Date(conv.created_at).toLocaleDateString()} • {conv.message_count || 0} messages
                  </span>
                  
                  <button
                    onClick={(e) => handleDelete(conv.id, e)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-accent-red hover:scale-110 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="text-center py-12 text-text-muted">
                  No history yet
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
