import React from "react";
import { getSocket } from "@/src/socket/socket";

export default function DebugPanel() {
  const [logs, setLogs] = React.useState<string[]>([]);
  const [groqStatus, setGroqStatus] = React.useState<string>("untested");
  const [socketStatus, setSocketStatus] = React.useState<string>("unknown");

  const addLog = (msg: string) => setLogs(p => [`${new Date().toLocaleTimeString()} ${msg}`, ...p.slice(0, 30)]);

  React.useEffect(() => {
    const s = getSocket();
    setSocketStatus(s.connected ? "✅ connected" : "❌ disconnected");
    s.on("connect", () => { setSocketStatus("✅ connected"); addLog("Socket connected: " + s.id); });
    s.on("disconnect", (r) => { setSocketStatus("❌ disconnected: " + r); addLog("Socket disconnected: " + r); });
    s.onAny((event, ...args) => {
      if (event !== "message_token") addLog(`← ${event}: ${JSON.stringify(args).slice(0, 100)}`);
    });
  }, []);

  const testGroq = async () => {
    setGroqStatus("testing...");
    addLog("Testing Groq...");
    try {
      const r = await fetch("/api/test-groq");
      const d = await r.json();
      if (d.ok) { setGroqStatus("✅ " + d.reply); addLog("Groq OK: " + d.reply); }
      else { setGroqStatus("❌ " + d.error); addLog("Groq ERROR: " + d.error); }
    } catch (e: any) { setGroqStatus("❌ fetch failed: " + e.message); addLog("fetch failed: " + e.message); }
  };

  const testSend = () => {
    const s = getSocket();
    addLog(`Emitting test send_message. connected=${s.connected}`);
    s.emit("send_message", { conversation_id: "debug-test", content: "hello", model: "llama-3.1-8b-instant" });
  };

  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, width: 380, background: "#0a0a0f", border: "1px solid #f87171", borderRadius: 12, padding: 12, zIndex: 9999, fontFamily: "monospace", fontSize: 11 }}>
      <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 8 }}>🔧 DEBUG PANEL</div>
      <div style={{ color: "#6b7280", marginBottom: 4 }}>Socket: <span style={{ color: "#c9d1e0" }}>{socketStatus}</span></div>
      <div style={{ color: "#6b7280", marginBottom: 8 }}>Groq: <span style={{ color: "#c9d1e0" }}>{groqStatus}</span></div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={testGroq} style={{ background: "#1a1a24", border: "1px solid #2a2a38", color: "#38bdf8", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>Test Groq</button>
        <button onClick={testSend} style={{ background: "#1a1a24", border: "1px solid #2a2a38", color: "#fbbf24", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>Test Send</button>
        <button onClick={() => setLogs([])} style={{ background: "#1a1a24", border: "1px solid #2a2a38", color: "#6b7280", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>Clear</button>
      </div>
      <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {logs.map((l, i) => <div key={i} style={{ color: l.includes("ERROR") || l.includes("❌") ? "#f87171" : l.includes("✅") ? "#4ade80" : "#6b7280", wordBreak: "break-all" }}>{l}</div>)}
        {logs.length === 0 && <div style={{ color: "#3a3a4a" }}>No events yet...</div>}
      </div>
    </div>
  );
}
