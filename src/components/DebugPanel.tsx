import React from "react";
import { getSocket } from "@/src/socket/socket";

export default function DebugPanel() {
  const [logs, setLogs] = React.useState<string[]>([]);
  const [groqStatus, setGroqStatus] = React.useState("untested");
  const [socketStatus, setSocketStatus] = React.useState("unknown");
  const [serverUrl, setServerUrl] = React.useState("");

  const addLog = (msg: string) =>
    setLogs((p) => [`${new Date().toLocaleTimeString()} ${msg}`, ...p.slice(0, 40)]);

  React.useEffect(() => {
    const hostname = window.location.hostname;
    const url = hostname === "localhost" ? "http://localhost:3000" : window.location.origin;
    setServerUrl(url);

    const s = getSocket();
    setSocketStatus(s.connected ? "✅ connected" : "⏳ connecting...");

    s.on("connect", () => { setSocketStatus("✅ connected " + s.id?.slice(0,6)); addLog("✅ Socket connected: " + s.id); });
    s.on("disconnect", (r: string) => { setSocketStatus("❌ " + r); addLog("❌ Disconnected: " + r); });
    s.on("connect_error", (e: any) => { setSocketStatus("❌ " + e.message); addLog("❌ Error: " + e.message); });
    s.onAny((event: string, ...args: any[]) => {
      if (event !== "message_token") addLog(`← ${event}: ${JSON.stringify(args).slice(0, 120)}`);
    });
  }, []);

  const testGroq = async () => {
    addLog("Testing Groq API...");
    setGroqStatus("testing...");
    try {
      const r = await fetch("/api/test-groq");
      const d = await r.json();
      if (d.ok) { setGroqStatus("✅ " + d.reply); addLog("✅ Groq works: " + d.reply); }
      else { setGroqStatus("❌ " + d.error); addLog("❌ Groq error: " + d.error); }
    } catch (e: any) {
      setGroqStatus("❌ " + e.message);
      addLog("❌ Fetch failed: " + e.message);
    }
  };

  const testSocket = () => {
    const s = getSocket();
    addLog(`Testing socket emit. connected=${s.connected}`);
    s.emit("send_message", { conversation_id: "debug-test", content: "ping", model: "llama-3.1-8b-instant" });
  };

  return (
    <div style={{
      position: "fixed", bottom: 16, right: 16, width: 400,
      background: "#0a0a0f", border: "2px solid #f87171",
      borderRadius: 12, padding: 14, zIndex: 99999,
      fontFamily: "monospace", fontSize: 11, color: "#c9d1e0",
    }}>
      <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 8, fontSize: 13 }}>🔧 DEBUG PANEL</div>
      <div style={{ marginBottom: 3 }}>Server URL: <span style={{ color: "#38bdf8" }}>{serverUrl}</span></div>
      <div style={{ marginBottom: 3 }}>Socket: <span style={{ color: "#c9d1e0" }}>{socketStatus}</span></div>
      <div style={{ marginBottom: 10 }}>Groq: <span style={{ color: "#c9d1e0" }}>{groqStatus}</span></div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={testGroq} style={{ background: "#1a1a24", border: "1px solid #38bdf8", color: "#38bdf8", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Test Groq</button>
        <button onClick={testSocket} style={{ background: "#1a1a24", border: "1px solid #fbbf24", color: "#fbbf24", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Test Socket</button>
        <button onClick={() => setLogs([])} style={{ background: "#1a1a24", border: "1px solid #3a3a4a", color: "#6b7280", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Clear</button>
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {logs.length === 0 && <div style={{ color: "#3a3a4a" }}>No events yet...</div>}
        {logs.map((l, i) => (
          <div key={i} style={{ color: l.includes("❌") ? "#f87171" : l.includes("✅") ? "#4ade80" : "#6b7280", marginBottom: 2, wordBreak: "break-all" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
