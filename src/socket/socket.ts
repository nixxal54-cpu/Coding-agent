import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io("/", {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}

export function joinConversation(conversationId: string) {
  getSocket().emit("join_conversation", { conversation_id: conversationId });
}

export function sendAgentMessage(conversationId: string, content: string) {
  getSocket().emit("send_message", {
    conversation_id: conversationId,
    content,
  });
}
