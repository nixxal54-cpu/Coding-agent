import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MessageSquare, Clock, Bot } from "lucide-react";
import { createConversation, getConversations } from "@/src/api/conversations";
import { useConversationStore, Conversation } from "@/src/stores/conversation-store";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils";

export default function Home() {
  const navigate = useNavigate();
  const { conversations, setConversations, setActiveConversationId } = useConversationStore();
  const [input, setInput] = React.useState("");

  React.useEffect(() => {
    getConversations().then(setConversations);
  }, []);

  const handleStart = async () => {
    if (!input.trim()) return;
    const conv = await createConversation({ title: input.split("\n")[0].slice(0, 50) });
    setConversations([conv, ...conversations]);
    setActiveConversationId(conv.id);
    navigate(`/conversations/${conv.id}`);
    
    // In a real app, we'd send the message via socket after redirecting
    // We'll handle the initial message logic in the ConversationPage mount
    sessionStorage.setItem(`initial_msg_${conv.id}`, input);
  };

  return (
    <div className="h-full overflow-y-auto bg-bg-base flex flex-col items-center pt-24 px-6 pb-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-bg-base mx-auto mb-6 shadow-lg shadow-accent/20">
          <Bot size={40} />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Groq Coding Agent</h1>
        <p className="text-text-secondary text-lg">What do you want to build today?</p>
      </motion.div>

      <div className="w-full max-w-2xl relative group mb-20">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your project or task..."
          className="w-full bg-bg-secondary border border-border rounded-3xl p-6 pr-32 min-h-[120px] text-lg focus:outline-none focus:ring-2 focus:ring-accent/50 group-hover:border-accent/30 transition-all shadow-xl"
        />
        <button
          onClick={handleStart}
          disabled={!input.trim()}
          className="absolute bottom-4 right-4 bg-accent text-bg-base px-6 py-2.5 rounded-2xl font-semibold flex items-center gap-2 hover:bg-accent/90 disabled:opacity-50 disabled:grayscale transition-all"
        >
          <Plus size={20} />
          <span>Start Coding</span>
        </button>
      </div>

      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock size={20} className="text-text-muted" />
            Recent Projects
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {conversations.slice(0, 6).map((conv, i) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                setActiveConversationId(conv.id);
                navigate(`/conversations/${conv.id}`);
              }}
              className="bg-bg-secondary border border-border p-5 rounded-2xl cursor-pointer hover:border-accent/50 hover:bg-bg-hover transition-all group flex flex-col gap-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 bg-bg-tertiary rounded-lg text-text-muted group-hover:text-accent transition-colors">
                  <MessageSquare size={18} />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                  <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Idle</span>
                </div>
              </div>
              <p className="font-medium text-text-primary group-hover:text-accent transition-colors line-clamp-2 min-h-[3rem]">
                {conv.title || "Untitled Conversation"}
              </p>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs text-text-muted">{new Date(conv.created_at).toLocaleDateString()}</span>
                <span className="text-xs text-text-muted">{conv.message_count || 0} messages</span>
              </div>
            </motion.div>
          ))}
          
          <button 
             onClick={() => navigate("/")}
             className="bg-bg-secondary/30 border border-dashed border-border p-5 rounded-2xl flex flex-col items-center justify-center gap-2 text-text-muted hover:text-text-primary hover:border-text-muted transition-all"
          >
            <Plus size={24} />
            <span className="text-sm font-medium">Create New</span>
          </button>
        </div>
      </div>
    </div>
  );
}
