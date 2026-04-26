import { io, Socket } from "socket.io-client";

let socket: Socket;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, { transports: ["websocket", "polling"] });
    socket.on("connect", () => console.log("Socket connected:", socket.id));
    socket.on("disconnect", () => console.log("Socket disconnected"));
  }
  return socket;
}

export function joinConversation(id: string) {
  getSocket().emit("join_conversation", { conversation_id: id });
}

export function sendAgentMessage(id: string, content: string, model?: string) {
  getSocket().emit("send_message", { conversation_id: id, content, model });
}

export function runTerminalCommand(id: string, command: string) {
  getSocket().emit("terminal_run", { conversation_id: id, command });
}
