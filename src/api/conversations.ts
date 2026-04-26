import axios from "./axios";

export const getConversations = () => axios.get("/api/conversations").then((r) => r.data);
export const createConversation = (data?: any) => axios.post("/api/conversations", data).then((r) => r.data);
export const getConversation = (id: string) => axios.get(`/api/conversations/${id}`).then((r) => r.data);
export const updateConversation = (id: string, data: any) => axios.patch(`/api/conversations/${id}`, data).then((r) => r.data);
export const deleteConversation = (id: string) => axios.delete(`/api/conversations/${id}`).then((r) => r.data);
export const getFiles = (id: string, path?: string) => axios.get(`/api/conversations/${id}/files`, { params: { path } }).then((r) => r.data);
export const getFileContent = (id: string, path: string) => axios.get(`/api/conversations/${id}/files/content`, { params: { path } }).then((r) => r.data);
export const writeFileContent = (id: string, path: string, content: string) => axios.post(`/api/conversations/${id}/files/write`, { path, content }).then((r) => r.data);
export const deleteFile = (id: string, path: string) => axios.delete(`/api/conversations/${id}/files`, { data: { path } }).then((r) => r.data);
export const getSkills = () => axios.get("/api/skills").then((r) => r.data);
export const getModels = () => axios.get("/api/models").then((r) => r.data);
export const getSettings = () => axios.get("/api/settings").then((r) => r.data);
