import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";

let socket: Socket;

export function getSocket(): Socket {
  if (!socket) {
    console.log("[Socket] Initializing socket connection to", window.location.origin);
    socket = io(window.location.origin, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      console.log("[Socket] ✅ Connected. ID:", socket.id);
      toast.success("Connected to server");
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] ❌ Disconnected. Reason:", reason);
      toast.error("Disconnected: " + reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
      toast.error("Connection error: " + err.message);
    });

    // Log ALL incoming events for debugging
    socket.onAny((event, ...args) => {
      console.log("[Socket] ← received:", event, args);
    });
  }
  return socket;
}

export function joinConversation(id: string) {
  const s = getSocket();
  console.log("[Socket] joinConversation:", id, "| connected:", s.connected);
  if (s.connected) {
    s.emit("join_conversation", { conversation_id: id });
    console.log("[Socket] → emitted join_conversation");
  } else {
    console.warn("[Socket] Not connected yet, queuing join for:", id);
    s.once("connect", () => {
      s.emit("join_conversation", { conversation_id: id });
      console.log("[Socket] → emitted join_conversation (after connect)");
    });
  }
}

export function sendAgentMessage(id: string, content: string, model?: string) {
  const s = getSocket();
  const payload = { conversation_id: id, content, model };
  console.log("[Socket] sendAgentMessage:", payload, "| connected:", s.connected);
  if (s.connected) {
    s.emit("send_message", payload);
    console.log("[Socket] → emitted send_message");
  } else {
    console.warn("[Socket] Not connected, queuing send_message");
    toast.error("Not connected to server yet, retrying...");
    s.once("connect", () => {
      s.emit("send_message", payload);
      console.log("[Socket] → emitted send_message (after connect)");
    });
  }
}

export function runTerminalCommand(id: string, command: string) {
  const s = getSocket();
  console.log("[Socket] runTerminalCommand:", command);
  s.emit("terminal_run", { conversation_id: id, command });
}
