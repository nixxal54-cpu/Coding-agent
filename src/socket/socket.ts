// src/socket/socket.ts
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";

let socket: Socket;

export function getSocket(): Socket {
  if (!socket) {
    // Always connect via same origin — Vite proxy handles /socket.io → :3000 in dev,
    // and Express serves both frontend + socket on the same port in prod.
    console.log("[Socket] Connecting to:", window.location.origin);

    socket = io(window.location.origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"], // prefer websocket, fall back to polling
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socket.on("connect", () => {
      console.log("[Socket] ✅ Connected. ID:", socket.id);
      toast.success("Connected to server");
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] ❌ Disconnected:", reason);
      toast.error("Disconnected: " + reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
      toast.error("Connection error: " + err.message);
    });

    socket.onAny((event, ...args) => {
      if (event !== "message_token") {
        console.log("[Socket] ←", event, args);
      }
    });
  }
  return socket;
}

// ... rest unchanged

export function joinConversation(id: string) {
  const s = getSocket();
  console.log("[Socket] joinConversation:", id, "| connected:", s.connected);
  if (s.connected) {
    s.emit("join_conversation", { conversation_id: id });
  } else {
    s.once("connect", () => {
      s.emit("join_conversation", { conversation_id: id });
      console.log("[Socket] → join_conversation (after connect)");
    });
  }
}

export function sendAgentMessage(id: string, content: string, model?: string) {
  const s = getSocket();
  const payload = { conversation_id: id, content, model };
  console.log("[Socket] sendAgentMessage:", payload, "| connected:", s.connected);
  if (s.connected) {
    s.emit("send_message", payload);
  } else {
    toast.error("Not connected to server!");
    s.once("connect", () => s.emit("send_message", payload));
  }
}

export function runTerminalCommand(id: string, command: string) {
  getSocket().emit("terminal_run", { conversation_id: id, command });
}
