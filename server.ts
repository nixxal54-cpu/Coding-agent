import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const WORKSPACE_DIR = path.join(process.cwd(), "agent_workspace");
const DATA_DIR = path.join(process.cwd(), "agent_data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");

for (const dir of [WORKSPACE_DIR, DATA_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });
app.use(express.json({ limit: "10mb" }));

// --- Persistence ---
async function loadConversations() {
  try { return JSON.parse(await fs.readFile(CONVERSATIONS_FILE, "utf-8")); }
  catch { return {}; }
}
async function saveConversations(data: any) {
  await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify(data, null, 2));
}
let conversationsDB: Record<string, any> = await loadConversations();

// --- Groq Models (all available) ---
const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Most capable, best for complex tasks", recommended: true },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", description: "Ultra-fast, great for quick tasks", fast: true },
  { id: "llama3-70b-8192", name: "Llama 3 70B", description: "Reliable and powerful" },
  { id: "llama3-8b-8192", name: "Llama 3 8B", description: "Lightweight and fast" },
  { id: "gemma2-9b-it", name: "Gemma 2 9B", description: "Google's efficient model" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", description: "Large context, 32K tokens" },
  { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 70B", description: "Strong reasoning model" },
  { id: "qwen-qwq-32b", name: "Qwen QwQ 32B", description: "Advanced reasoning & math" },
];

// --- Skills ---
const SKILLS: Record<string, any> = {
  "create-react": { name: "Create React + Vite", description: "Scaffold a React+Vite+TypeScript+Tailwind app", icon: "⚛️", prompt: "Create a new React app using Vite with TypeScript and Tailwind CSS v4. Set up proper folder structure (src/components, src/pages, src/hooks). Install all deps and verify it works." },
  "create-nextjs": { name: "Create Next.js App", description: "Scaffold a Next.js app with App Router", icon: "▲", prompt: "Create a new Next.js app with App Router, TypeScript, and Tailwind CSS. Set up project structure and install all dependencies." },
  "create-express": { name: "Create Express API", description: "REST API with Express + TypeScript", icon: "🚀", prompt: "Create a REST API using Express.js with TypeScript. Include cors, helmet, morgan middleware, error handling, and sample CRUD routes. Add README with API docs." },
  "create-python": { name: "Create Python App", description: "Python project with venv", icon: "🐍", prompt: "Create a Python project with virtual environment, requirements.txt, and proper structure. Set up a main.py entry point." },
  "debug-code": { name: "Debug Code", description: "Find and fix bugs in workspace", icon: "🐛", prompt: "Analyze all code in my workspace, identify any bugs or errors, fix them, and explain what you changed." },
  "add-tests": { name: "Add Unit Tests", description: "Generate tests for your code", icon: "✅", prompt: "Analyze the code in my workspace and write comprehensive unit tests using the appropriate framework." },
  "code-review": { name: "Code Review", description: "Detailed code quality review", icon: "👀", prompt: "Perform a thorough code review: check for code quality, security issues, performance, and best practices. Give actionable feedback." },
  "add-docker": { name: "Dockerize App", description: "Add Docker support", icon: "🐳", prompt: "Add Docker support to the workspace project: Dockerfile, .dockerignore, and docker-compose.yml." },
  "generate-readme": { name: "Generate README", description: "Create a comprehensive README", icon: "📝", prompt: "Analyze my project and generate a comprehensive README.md with: overview, features, installation, usage, and contribution guide." },
  "optimize": { name: "Optimize Performance", description: "Profile and optimize code", icon: "⚡", prompt: "Analyze the codebase for performance bottlenecks, unnecessary re-renders, memory leaks, and fix them." },
};

// --- Helpers ---
function getWorkspace(id: string) { return path.join(WORKSPACE_DIR, id); }
async function ensureWorkspace(id: string) {
  const p = getWorkspace(id);
  await fs.mkdir(p, { recursive: true });
  return p;
}

function getGroqClient(): OpenAI {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set. Add it to your .env file: GROQ_API_KEY=your_key_here");
  return new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
}

function runCommand(command: string, cwd: string, timeout = 120000): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const shell = spawn("bash", ["-c", command], { cwd });
    let output = "";
    shell.stdout.on("data", (d) => (output += d.toString()));
    shell.stderr.on("data", (d) => (output += d.toString()));
    shell.on("close", (code) => resolve({ output: output || "(no output)", exitCode: code || 0 }));
    const t = setTimeout(() => { shell.kill(); resolve({ output: output + "\n[Timed out]", exitCode: -1 }); }, timeout);
    shell.on("close", () => clearTimeout(t));
  });
}

function runCommandStreaming(command: string, cwd: string, onData: (d: string) => void, timeout = 120000): Promise<void> {
  return new Promise((resolve) => {
    const shell = spawn("bash", ["-c", command], { cwd });
    shell.stdout.on("data", (d) => onData(d.toString()));
    shell.stderr.on("data", (d) => onData(d.toString()));
    shell.on("close", () => resolve());
    const t = setTimeout(() => { shell.kill(); onData("\n[Timed out]\n"); resolve(); }, timeout);
    shell.on("close", () => clearTimeout(t));
  });
}

async function listDirectory(workspace: string, relPath = ""): Promise<any[]> {
  const fullPath = path.join(workspace, relPath);
  const ignored = ["node_modules", ".git", "dist", ".next", "__pycache__", ".venv", "venv", ".DS_Store"];
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const items = await Promise.all(entries.map(async (e) => {
      if (ignored.includes(e.name)) return null;
      const rel = path.join(relPath, e.name);
      const item: any = { name: e.name, path: rel, type: e.isDirectory() ? "directory" : "file" };
      if (e.isDirectory()) { item.children = await listDirectory(workspace, rel); }
      else { try { const s = await fs.stat(path.join(workspace, rel)); item.size = s.size; } catch {} }
      return item;
    }));
    return items.filter(Boolean).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
  } catch { return []; }
}

// --- Tools ---
const TOOLS: any[] = [
  { type: "function", function: { name: "run_command", description: "Run a bash command in the workspace. Use for installs, tests, git, etc.", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } },
  { type: "function", function: { name: "read_file", description: "Read file contents (first 8000 chars)", parameters: { type: "object", properties: { path: { type: "string" }, start_line: { type: "number" }, end_line: { type: "number" } }, required: ["path"] } } },
  { type: "function", function: { name: "write_file", description: "Write content to a file (creates dirs automatically)", parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "edit_file", description: "Replace a specific string in a file. For targeted edits.", parameters: { type: "object", properties: { path: { type: "string" }, old_str: { type: "string" }, new_str: { type: "string" } }, required: ["path", "old_str", "new_str"] } } },
  { type: "function", function: { name: "list_files", description: "List files in directory", parameters: { type: "object", properties: { path: { type: "string" }, recursive: { type: "boolean" } } } } },
  { type: "function", function: { name: "delete_file", description: "Delete a file or directory", parameters: { type: "object", properties: { path: { type: "string" }, recursive: { type: "boolean" } }, required: ["path"] } } },
  { type: "function", function: { name: "search_files", description: "Search for text in files using grep", parameters: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" }, file_pattern: { type: "string" } }, required: ["pattern"] } } },
  { type: "function", function: { name: "create_directory", description: "Create a directory", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "move_file", description: "Move or rename a file", parameters: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] } } },
  { type: "function", function: { name: "get_project_info", description: "Get workspace/project overview", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "web_search", description: "Search the web for docs, solutions, packages", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
];

const SYSTEM_PROMPT = `You are APEX, an elite AI coding agent. You write production-quality code, debug issues autonomously, and build complete applications.

## Capabilities
- Read, write, edit files with surgical precision
- Run terminal commands, install packages, manage deps
- Debug and fix errors automatically
- Search the web for docs and solutions
- Build any app: React, Next.js, Python, Node, Go, etc.

## Rules
1. Think step by step, then act decisively
2. Always verify your work by running the code
3. Handle errors automatically — debug and retry
4. Write clean, typed, production-ready code
5. Be concise in explanations, verbose in code quality`;

async function executeTool(name: string, args: any, workspace: string): Promise<string> {
  switch (name) {
    case "run_command": {
      const { output, exitCode } = await runCommand(args.command, workspace);
      return `[exit: ${exitCode}]\n${output}`.slice(0, 10000);
    }
    case "read_file": {
      try {
        let c = await fs.readFile(path.join(workspace, args.path), "utf-8");
        if (args.start_line || args.end_line) {
          const lines = c.split("\n");
          c = lines.slice((args.start_line || 1) - 1, args.end_line || lines.length).join("\n");
        }
        return c.length > 8000 ? c.slice(0, 8000) + "\n...[truncated]" : c;
      } catch (e: any) { return `Error: ${e.message}`; }
    }
    case "write_file": {
      try {
        const p = path.join(workspace, args.path);
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(p, args.content, "utf-8");
        return `✓ Written: ${args.path} (${args.content.length} chars)`;
      } catch (e: any) { return `Error: ${e.message}`; }
    }
    case "edit_file": {
      try {
        const p = path.join(workspace, args.path);
        let c = await fs.readFile(p, "utf-8");
        if (!c.includes(args.old_str)) return `Error: Pattern not found in ${args.path}`;
        await fs.writeFile(p, c.replace(args.old_str, args.new_str), "utf-8");
        return `✓ Edited: ${args.path}`;
      } catch (e: any) { return `Error: ${e.message}`; }
    }
    case "list_files": {
      const items = await listDirectory(workspace, args.path || "");
      if (args.recursive) {
        const flatten = (items: any[], prefix = ""): string[] =>
          items.flatMap((i) => i.type === "directory" ? [`📁 ${prefix + i.name}/`, ...flatten(i.children || [], prefix + i.name + "/")] : [`📄 ${prefix + i.name}`]);
        return flatten(items).join("\n") || "(empty)";
      }
      return items.map((i) => `${i.type === "directory" ? "📁" : "📄"} ${i.name}`).join("\n") || "(empty)";
    }
    case "delete_file": {
      try { await fs.rm(path.join(workspace, args.path), { recursive: !!args.recursive, force: true }); return `✓ Deleted: ${args.path}`; }
      catch (e: any) { return `Error: ${e.message}`; }
    }
    case "search_files": {
      const sp = args.path ? path.join(workspace, args.path) : workspace;
      const fa = args.file_pattern ? `--include="${args.file_pattern}"` : "";
      const { output } = await runCommand(`grep -rn ${fa} "${args.pattern}" . 2>/dev/null | head -50`, sp);
      return output || "No matches found";
    }
    case "create_directory": {
      try { await fs.mkdir(path.join(workspace, args.path), { recursive: true }); return `✓ Created: ${args.path}`; }
      catch (e: any) { return `Error: ${e.message}`; }
    }
    case "move_file": {
      try { await fs.rename(path.join(workspace, args.from), path.join(workspace, args.to)); return `✓ Moved: ${args.from} → ${args.to}`; }
      catch (e: any) { return `Error: ${e.message}`; }
    }
    case "get_project_info": {
      let info = "";
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(workspace, "package.json"), "utf-8"));
        info += `Project: ${pkg.name} v${pkg.version}\nDeps: ${Object.keys(pkg.dependencies || {}).join(", ")}\n`;
      } catch {}
      const { output } = await runCommand("find . -type f | grep -v node_modules | grep -v .git | wc -l", workspace);
      info += `Files: ${output.trim()}`;
      return info || "Empty workspace";
    }
    case "web_search": {
      try {
        const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1`);
        const d: any = await r.json();
        return [d.AbstractText, ...(d.RelatedTopics || []).slice(0, 5).map((t: any) => t.Text)].filter(Boolean).join("\n\n") || "No results. Try run_command with curl.";
      } catch { return "Search failed. Try run_command with curl for specific docs."; }
    }
    default: return `Unknown tool: ${name}`;
  }
}

// --- API Routes ---
app.get("/api/health", (_, res) => res.json({ status: "ok", version: "2.0.0", provider: "groq" }));
app.get("/api/skills", (_, res) => res.json(Object.entries(SKILLS).map(([id, s]) => ({ id, ...s }))));
app.get("/api/models", (_, res) => res.json(GROQ_MODELS));
app.get("/api/settings", (_, res) => res.json({ has_groq_key: !!process.env.GROQ_API_KEY, provider: "groq" }));

app.get("/api/conversations", (_, res) => {
  const result = Object.values(conversationsDB)
    .sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map(({ messages, ...meta }: any) => meta);
  res.json(result);
});
app.post("/api/conversations", async (req, res) => {
  const id = uuidv4();
  const conv = { id, title: req.body.title || "New Conversation", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "idle", message_count: 0, model: req.body.model || "llama-3.3-70b-versatile", messages: [], pinned: false, tags: [] };
  conversationsDB[id] = conv;
  await ensureWorkspace(id); await saveConversations(conversationsDB);
  res.json(conv);
});
app.get("/api/conversations/:id", (req, res) => {
  const c = conversationsDB[req.params.id];
  if (!c) return res.status(404).json({ error: "Not found" });
  res.json(c);
});
app.patch("/api/conversations/:id", async (req, res) => {
  const c = conversationsDB[req.params.id];
  if (!c) return res.status(404).json({ error: "Not found" });
  Object.assign(c, req.body); await saveConversations(conversationsDB); res.json(c);
});
app.delete("/api/conversations/:id", async (req, res) => {
  delete conversationsDB[req.params.id]; await saveConversations(conversationsDB);
  try { await fs.rm(getWorkspace(req.params.id), { recursive: true, force: true }); } catch {}
  res.json({ success: true });
});
app.get("/api/conversations/:id/files", async (req, res) => {
  res.json(await listDirectory(getWorkspace(req.params.id), (req.query.path as string) || ""));
});
app.get("/api/conversations/:id/files/content", async (req, res) => {
  try { res.json({ content: await fs.readFile(path.join(getWorkspace(req.params.id), req.query.path as string), "utf-8") }); }
  catch { res.status(500).json({ error: "Cannot read file" }); }
});
app.post("/api/conversations/:id/files/write", async (req, res) => {
  try {
    const p = path.join(getWorkspace(req.params.id), req.body.path);
    await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, req.body.content, "utf-8"); res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/conversations/:id/files", async (req, res) => {
  try { await fs.rm(path.join(getWorkspace(req.params.id), req.body.path), { recursive: true, force: true }); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});
app.post("/api/terminal/run", async (req, res) => {
  const w = await ensureWorkspace(req.body.conversation_id);
  const { output, exitCode } = await runCommand(req.body.command, w);
  res.json({ output, exitCode });
});

// --- Socket ---
io.on("connection", (socket) => {
  socket.on("join_conversation", ({ conversation_id }) => { socket.join(conversation_id); socket.emit("joined", { conversation_id }); });

  socket.on("terminal_run", async ({ conversation_id, command }) => {
    const w = await ensureWorkspace(conversation_id);
    socket.emit("terminal_start", { command });
    await runCommandStreaming(command, w, (data) => socket.emit("terminal_data", { data }));
    socket.emit("terminal_done");
  });

  socket.on("send_message", async ({ conversation_id, content, model }) => {
    if (!conversationsDB[conversation_id]) {
      conversationsDB[conversation_id] = { id: conversation_id, title: content.slice(0, 60), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "running", message_count: 0, messages: [], model: model || "llama-3.3-70b-versatile", pinned: false, tags: [] };
    }
    const conv = conversationsDB[conversation_id];
    const selectedModel = model || conv.model || "llama-3.3-70b-versatile";
    const userMsg = { id: uuidv4(), role: "user", content, timestamp: new Date().toISOString() };
    conv.messages.push(userMsg); conv.updated_at = new Date().toISOString(); conv.status = "running";
    io.to(conversation_id).emit("agent_status", { status: "running" });
    const assistantId = uuidv4();
    io.to(conversation_id).emit("message_start", { id: assistantId, role: "assistant", timestamp: new Date().toISOString() });

    const history: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...conv.messages.slice(-20).map((m: any) => ({ role: m.role, content: m.content }))];
    const workspace = await ensureWorkspace(conversation_id);
    let fullResponse = "";

    try {
      const client = getGroqClient();
      let loops = 0;
      while (loops++ < 12) {
        const stream = await (client.chat.completions.create as any)({ model: selectedModel, messages: history, tools: TOOLS, tool_choice: "auto", stream: true, temperature: 0.3 });
        let currentContent = ""; let toolCalls: any[] = [];
        for await (const chunk of stream as AsyncIterable<any>) {
          const delta = (chunk as any).choices[0]?.delta;
          if (delta?.content) { currentContent += delta.content; fullResponse += delta.content; io.to(conversation_id).emit("message_token", { id: assistantId, token: delta.content }); }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: "", function: { name: "", arguments: "" } };
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }
        }
        if (currentContent) history.push({ role: "assistant", content: currentContent });
        if (toolCalls.length > 0) {
          const atm: any = { role: "assistant", tool_calls: toolCalls.map((tc) => ({ id: tc.id, type: "function", function: tc.function })) };
          if (currentContent) atm.content = currentContent;
          history.push(atm);
          for (const tc of toolCalls) {
            const name = tc.function.name; let args: any = {};
            try { args = JSON.parse(tc.function.arguments); } catch {}
            io.to(conversation_id).emit("tool_use", { tool: name, args, timestamp: new Date().toISOString() });
            const result = await executeTool(name, args, workspace);
            io.to(conversation_id).emit("tool_result", { tool: name, result, timestamp: new Date().toISOString() });
            history.push({ role: "tool", tool_call_id: tc.id, content: result });
          }
          continue;
        }
        break;
      }
    } catch (e: any) {
      const msg = e.message || "Error"; io.to(conversation_id).emit("error", { message: msg }); fullResponse += `\n\n⚠️ Error: ${msg}`;
    }

    conv.messages.push({ id: assistantId, role: "assistant", content: fullResponse, timestamp: new Date().toISOString() });
    conv.message_count = conv.messages.length; conv.updated_at = new Date().toISOString(); conv.status = "idle";
    if (conv.messages.length === 2) conv.title = content.slice(0, 60);
    await saveConversations(conversationsDB);
    io.to(conversation_id).emit("message_done", { id: assistantId });
    io.to(conversation_id).emit("agent_status", { status: "idle" });
  });
});

if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

httpServer.listen(PORT, "0.0.0.0", () => console.log(`\n🚀 APEX Agent → http://localhost:${PORT}\n`));
