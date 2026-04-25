import React from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useEventStore } from "@/src/stores/event-store";
import { api } from "@/src/api/axios";

interface TerminalProps {
  conversationId: string;
}

export default function Terminal({ conversationId }: TerminalProps) {
  const terminalRef = React.useRef<HTMLDivElement>(null);
  const xtermRef = React.useRef<XTerm | null>(null);
  const { toolEvents } = useEventStore();
  const [input, setInput] = React.useState("");

  React.useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#0d0f11",
        foreground: "#e6edf3",
        cursor: "#58a6ff",
        selectionBackground: "rgba(88, 166, 255, 0.3)",
        black: "#484f58",
        red: "#f85149",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#e6edf3",
      },
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    term.writeln("\x1b[32mWelcome to the Agent Terminal\x1b[0m");
    term.writeln("Ready for action.");
    term.write("\r\n$ ");

    xtermRef.current = term;

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      term.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Listen for tool results specifically run_command
  React.useEffect(() => {
    if (!xtermRef.current) return;
    
    // Sort events by timestamp and get the latest
    const lastEvent = toolEvents[toolEvents.length - 1];
    if (lastEvent?.type === "tool_result" && lastEvent.tool === "run_command") {
        xtermRef.current.writeln(`\r\n\x1b[34m[Agent Command Result]\x1b[0m`);
        xtermRef.current.writeln(lastEvent.result || "");
        xtermRef.current.write("\r\n$ ");
    } else if (lastEvent?.type === "tool_use" && lastEvent.tool === "run_command") {
        xtermRef.current.writeln(`\r\n\x1b[32m$ ${lastEvent.args?.command}\x1b[0m`);
    }
  }, [toolEvents]);

  const handleManualCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !xtermRef.current) return;

    const cmd = input.trim();
    xtermRef.current.writeln(`\x1b[32m$ ${cmd}\x1b[0m`);
    setInput("");

    try {
      const { data } = await api.post("/api/terminal/run", {
        conversation_id: conversationId,
        command: cmd
      });
      xtermRef.current.writeln(data.output);
      xtermRef.current.write("\r\n$ ");
    } catch (err) {
      xtermRef.current.writeln(`\x1b[31mError: ${err}\x1b[0m`);
      xtermRef.current.write("\r\n$ ");
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-base overflow-hidden p-4">
      <div className="flex-1 w-full xterm-container overflow-hidden" ref={terminalRef} />
      <div className="mt-4 border-t border-border pt-4">
        <form onSubmit={handleManualCommand} className="flex gap-2">
          <span className="text-accent font-mono py-2">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Run manual command..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-text-primary font-mono text-sm"
          />
        </form>
      </div>
    </div>
  );
}
