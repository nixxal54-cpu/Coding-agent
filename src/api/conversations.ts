import { api } from "./axios";

export const getConversations = () =>
  api.get("/api/conversations").then((r) => r.data);

export const createConversation = (data?: { title?: string; initial_message?: string }) =>
  api.post("/api/conversations", data || {}).then((r) => r.data);

export const getConversation = (id: string) =>
  api.get(`/api/conversations/${id}`).then((r) => r.data);

export const deleteConversation = (id: string) =>
  api.delete(`/api/conversations/${id}`).then((r) => r.data);

export const getFiles = (conversationId: string, path = "") =>
  api.get(`/api/conversations/${conversationId}/files`, { params: { path } }).then((r) => r.data);

export const getFileContent = (conversationId: string, path: string) =>
  api.get(`/api/conversations/${conversationId}/files/content`, { params: { path } }).then((r) => r.data);

export const getSettings = () =>
  api.get("/api/settings").then((r) => r.data);
