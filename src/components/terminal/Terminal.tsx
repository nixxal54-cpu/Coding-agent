import React from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { getSocket, runTerminalCommand } from "@/src/socket/socket";
import { Play, Trash2, ChevronUp } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

export default function Terminal({ conversationId }: { conversationId: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<XTerm | null>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const [command, setCommand] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [histIdx, setHistIdx] = React.useState(-1);
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    if (!containerRef.current || termRef.current) return;
    const term = new XTerm({
      theme: { background: "#080b0f", foreground: "#e2eaf4", cursor: "#38bdf8", cursorAccent: "#080b0f", black: "#080b0f", brightBlack: "#6b8299", red: "#f87171", brightRed: "#f87171", green: "#4ade80", brightGreen: "#4ade80", yellow: "#fbbf24", brightYellow: "#fbbf24", blue: "#38bdf8", brightBlue: "#38bdf8", magenta: "#a78bfa", brightMagenta: "#a78bfa", cyan: "#38bdf8", brightCyan: "#38bdf8", white: "#e2eaf4", brightWhite: "#ffffff" },
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      scrollback: 3000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;
    term.writeln("\x1b[1;36m╔══════════════════════════════╗\x1b[0m");
    term.writeln("\x1b[1;36m║    APEX Agent Terminal       ║\x1b[0m");
    term.writeln("\x1b[1;36m╚══════════════════════════════╝\x1b[0m");
    term.writeln("\x1b[90mType commands below or let the agent run them automatically.\x1b[0m");
    term.writeln("");

    const resizeObserver = new ResizeObserver(() => { try { fit.fit(); } catch {} });
    resizeObserver.observe(containerRef.current);

    const socket = getSocket();
    socket.on("terminal_start", ({ command }: any) => {
      term.writeln(`\x1b[1;33m$ ${command}\x1b[0m`);
      setRunning(true);
    });
    socket.on("terminal_data", ({ data }: any) => { term.write(data); });
    socket.on("terminal_done", () => { term.writeln("\x1b[90m[done]\x1b[0m"); setRunning(false); });
    socket.on("tool_use", ({ tool, args }: any) => {
      if (tool === "run_command" && args?.command) {
        term.writeln(`\x1b[1;33m$ ${args.command}\x1b[0m`);
      }
    });
    socket.on("tool_result", ({ tool, result }: any) => {
      if (tool === "run_command") {
        term.writeln(String(result));
      }
    });

    return () => {
      socket.off("terminal_start"); socket.off("terminal_data"); socket.off("terminal_done");
      socket.off("tool_use"); socket.off("tool_result");
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  const run = () => {
    if (!command.trim() || running) return;
    setHistory((h) => [command, ...h.slice(0, 50)]);
    setHistIdx(-1);
    runTerminalCommand(conversationId, command);
    setCommand("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { run(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next); setCommand(history[next] || "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next); setCommand(next === -1 ? "" : history[next]);
    }
  };

  const clear = () => { termRef.current?.clear(); };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-bg)" }}>
      <div ref={containerRef} className="flex-1 p-2" />
      <div className="border-t flex items-center gap-2 px-3 py-2" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <span className="font-mono text-xs flex-shrink-0" style={{ color: "var(--color-cyan)" }}>$</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKey}
          placeholder={running ? "Running..." : "Enter command..."}
          disabled={running}
          className="flex-1 bg-transparent text-sm font-mono outline-none disabled:opacity-50"
          style={{ color: "var(--color-text)", fontFamily: "var(--font-mono)" }}
        />
        <button onClick={clear} className="p-1.5 rounded transition-colors" style={{ color: "var(--color-muted)" }}><Trash2 size={13} /></button>
        <button onClick={run} disabled={!command.trim() || running} className="px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-30" style={{ background: "var(--color-cyan2)", color: "#000" }}>
          <Play size={12} fill="#000" /> Run
        </button>
      </div>
    </div>
  );
}
