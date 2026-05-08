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
import { spawn, ChildProcess } from "child_process";
import { v4 as uuidv4 } from "uuid";
import * as http from "http";
import * as net from "net";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const WORKSPACE_DIR = path.join(process.cwd(), "agent_workspace");
const DATA_DIR = path.join(process.cwd(), "agent_data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");

for (const dir of [WORKSPACE_DIR, DATA_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"],
  allowEIO3: true,
});
app.use(express.json({ limit: "20mb" }));

// --- Dev server tracking ---
interface DevServer { port: number; process: ChildProcess; url: string; }
const devServers: Map<string, DevServer> = new Map();
let nextPort = 4000;

// --- Proxy for live preview ---
app.use("/preview/:convId", (req: any, res: any) => {
  const ds = devServers.get(req.params.convId);
  if (!ds) return res.status(404).send("<h2>No preview server running</h2><p>Ask the agent to start the dev server.</p>");
  const proxyPath = req.url || "/";
  const options = { hostname: "127.0.0.1", port: ds.port, path: proxyPath, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${ds.port}` } };
  const proxyReq = http.request(options, (proxyRes: any) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => res.status(502).send("<h2>Preview server not ready yet</h2><p>Wait a moment and refresh.</p>"));
  req.pipe(proxyReq);
});

// --- Persistence ---
async function loadConversations() {
  try { return JSON.parse(await fs.readFile(CONVERSATIONS_FILE, "utf-8")); } catch { return {}; }
}
async function saveConversations(data: any) {
  await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify(data, null, 2));
}
let conversationsDB: Record<string, any> = await loadConversations();

const GROQ_MODELS = [
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", description: "Most powerful — best reasoning", recommended: true },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", description: "Fast & capable", fast: true },
  { id: "groq/compound", name: "Groq Compound", description: "Agentic + web search" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout", description: "Multimodal, 10M ctx" },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Production-grade" },
  { id: "qwen/qwen3-32b", name: "Qwen3 32B", description: "Strong reasoning & math" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", description: "Ultra-fast", fast: true },
];

const SKILLS: Record<string, any> = {
  "create-react": { name: "Create React + Vite", description: "Scaffold React+Vite+TypeScript+Tailwind", icon: "⚛️", prompt: "Create a new React app using Vite with TypeScript and Tailwind CSS v4. Set up proper folder structure with src/components, src/pages, src/hooks. Create all necessary files including package.json, vite.config.ts, tailwind config, and a beautiful landing page. Run npm install." },
  "create-nextjs": { name: "Create Next.js App", description: "Scaffold Next.js with App Router", icon: "▲", prompt: "Create a complete Next.js 15 app with App Router, TypeScript, and Tailwind CSS. Create all necessary files, a proper layout, and a beautiful homepage. Run npm install." },
  "create-express": { name: "Create Express API", description: "REST API with Express + TypeScript", icon: "🚀", prompt: "Create a production REST API with Express.js, TypeScript, cors, helmet, express-validator, and CRUD routes for a users resource. Include README and run npm install." },
  "create-python": { name: "Create Python App", description: "Python project with structure", icon: "🐍", prompt: "Create a well-structured Python project with pyproject.toml, src layout, example module, pytest tests, and README." },
  "debug-code": { name: "Debug Code", description: "Find and fix all bugs", icon: "🐛", prompt: "Analyze all code in my workspace. Identify every bug, type error, or runtime issue. Fix them all and explain the changes." },
  "add-docker": { name: "Dockerize App", description: "Production Docker setup", icon: "🐳", prompt: "Add complete Docker support: multi-stage Dockerfile, .dockerignore, docker-compose.yml, and README section." },
  "generate-readme": { name: "Generate README", description: "Comprehensive project README", icon: "📝", prompt: "Analyze my project and create a beautiful README.md with: badges, overview, features, installation, usage examples, and contribution guide." },
  "add-tests": { name: "Add Unit Tests", description: "Comprehensive test suite", icon: "✅", prompt: "Write a comprehensive test suite for my project covering edge cases and aiming for high coverage." },
};

function getWorkspace(id: string) { return path.join(WORKSPACE_DIR, id); }
async function ensureWorkspace(id: string) { const p = getWorkspace(id); await fs.mkdir(p, { recursive: true }); return p; }

function getGroqClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set. Add it to your .env file.");
  return new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
}

function runCommand(command: string, cwd: string, timeout = 120000): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const shell = spawn("bash", ["-c", command], { cwd });
    let output = "";
    shell.stdout.on("data", (d: any) => (output += d.toString()));
    shell.stderr.on("data", (d: any) => (output += d.toString()));
    const t = setTimeout(() => { shell.kill(); resolve({ output: output + "\n[Timed out]", exitCode: -1 }); }, timeout);
    shell.on("close", (code: any) => { clearTimeout(t); resolve({ output: output || "(no output)", exitCode: code || 0 }); });
  });
}

function runCommandStreaming(command: string, cwd: string, onData: (d: string) => void, timeout = 120000): Promise<void> {
  return new Promise((resolve) => {
    const shell = spawn("bash", ["-c", command], { cwd });
    shell.stdout.on("data", (d: any) => onData(d.toString()));
    shell.stderr.on("data", (d: any) => onData(d.toString()));
    const t = setTimeout(() => { shell.kill(); onData("\n[Timed out]\n"); resolve(); }, timeout);
    shell.on("close", () => { clearTimeout(t); resolve(); });
  });
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(800);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    s.on("timeout", () => resolve(false));
    s.connect(port, "127.0.0.1");
  });
}

async function waitForPort(port: number, maxWait = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await isPortOpen(port)) return true;
    await new Promise(r => setTimeout(r, 600));
  }
  return false;
}

async function listDirectory(workspace: string, relPath = ""): Promise<any[]> {
  const fullPath = path.join(workspace, relPath);
  const ignored = ["node_modules", ".git", "dist", ".next", "__pycache__", ".venv", "venv", ".DS_Store", ".cache", "build", ".turbo", "coverage"];
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
    return (items.filter(Boolean) as any[]).sort((a: any, b: any) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
  } catch { return []; }
}

const TOOLS: any[] = [
  { type: "function", function: { name: "write_file", description: "Write content to a file. Creates parent directories automatically. USE THIS for ALL code — never put code in your text response.", parameters: { type: "object", properties: { path: { type: "string", description: "Relative path from workspace root, e.g. src/App.tsx" }, content: { type: "string", description: "Complete file content to write" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "edit_file", description: "Replace an exact string in an existing file. For surgical edits.", parameters: { type: "object", properties: { path: { type: "string" }, old_str: { type: "string", description: "Exact text to find" }, new_str: { type: "string", description: "Replacement text" } }, required: ["path", "old_str", "new_str"] } } },
  { type: "function", function: { name: "patch_file", description: "Apply multiple targeted replacements to a file in one call.", parameters: { type: "object", properties: { path: { type: "string" }, patches: { type: "array", items: { type: "object", properties: { old_str: { type: "string" }, new_str: { type: "string" } }, required: ["old_str", "new_str"] } } }, required: ["path", "patches"] } } },
  { type: "function", function: { name: "read_file", description: "Read file contents. Optional line range.", parameters: { type: "object", properties: { path: { type: "string" }, start_line: { type: "number" }, end_line: { type: "number" } }, required: ["path"] } } },
  { type: "function", function: { name: "run_command", description: "Run a bash command (synchronous). Use for npm install, git, tests, builds. For dev servers use start_dev_server.", parameters: { type: "object", properties: { command: { type: "string" }, timeout_seconds: { type: "number" } }, required: ["command"] } } },
  { type: "function", function: { name: "start_dev_server", description: "Start a dev server in the background and return a live preview URL. Detects the port automatically.", parameters: { type: "object", properties: { command: { type: "string", description: "Command to start the server, e.g. 'npm run dev'" }, expected_port: { type: "number" } }, required: ["command"] } } },
  { type: "function", function: { name: "list_files", description: "List directory contents", parameters: { type: "object", properties: { path: { type: "string" }, recursive: { type: "boolean" } } } } },
  { type: "function", function: { name: "delete_file", description: "Delete a file or directory", parameters: { type: "object", properties: { path: { type: "string" }, recursive: { type: "boolean" } }, required: ["path"] } } },
  { type: "function", function: { name: "search_files", description: "Search for text in files using grep", parameters: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" }, file_pattern: { type: "string" } }, required: ["pattern"] } } },
  { type: "function", function: { name: "create_directory", description: "Create a directory", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "move_file", description: "Move or rename a file", parameters: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] } } },
  { type: "function", function: { name: "get_project_info", description: "Get workspace overview: file count, package.json, README", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "web_search", description: "Search the web for docs, solutions, packages", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
];

const SYSTEM_PROMPT = `You are APEX, an elite AI coding agent with full filesystem and terminal access to a sandboxed workspace.

╔══════════════════════════════════════════════════════════════╗
║  ABSOLUTE RULE: NEVER write code blocks in your text.       ║
║  ALL code MUST go through write_file or edit_file tools.    ║
║  Code in text response = WRONG. Always use tools for code.  ║
╚══════════════════════════════════════════════════════════════╝

WORKFLOW FORMAT — Use this structure for ALL coding tasks:

<plan>
Numbered list of what you'll do. Be specific and concise.
</plan>

<execute>
Brief description of what you're doing in this phase.
Then make your tool calls.
</execute>

<verify>
Show verification: command output, test results, or confirm what was created.
</verify>

RULES:
1. Pure conversation (greetings, questions, discussions) → reply naturally, no tags, no tools
2. Any coding task → ALWAYS use <plan>/<execute>/<verify> tags
3. NEVER show code in your text. Write ALL code via write_file/edit_file
4. After creating files, always run commands to verify: npm install, npm run build, etc.
5. For dev servers/apps that need to be viewed: use start_dev_server (gives live preview)
6. Complete tasks FULLY. Don't stop at "you can now do X" — do X yourself
7. If a command fails, read the error, fix the issue, and retry

Code standards:
- TypeScript: strict, proper types
- React: functional components, hooks
- CSS: Tailwind when available
- Always include error handling
- Write production-ready code`;

async function executeTool(name: string, args: any, workspace: string, conversationId: string, emit: (e: string, d: any) => void): Promise<string> {
  switch (name) {
    case "write_file": {
      try {
        const p = path.join(workspace, args.path);
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(p, args.content, "utf-8");
        emit("file_changed", { path: args.path, action: "write", size: args.content.length });
        return `✓ Written: ${args.path} (${args.content.length} chars)`;
      } catch (e: any) { return `Error: ${e.message}`; }
    }
    case "edit_file": {
      try {
        const p = path.join(workspace, args.path);
        let c = await fs.readFile(p, "utf-8");
        if (!c.includes(args.old_str)) return `Error: Pattern not found in ${args.path}. The old_str must exactly match existing content.`;
        await fs.writeFile(p, c.split(args.old_str).join(args.new_str), "utf-8");
        emit("file_changed", { path: args.path, action: "edit" });
        return `✓ Edited: ${args.path}`;
      } catch (e: any) { return `Error: ${e.message}`; }
    }
    case "patch_file": {
      try {
        const p = path.join(workspace, args.path);
        let c = await fs.readFile(p, "utf-8");
        const errors: string[] = [];
        for (const patch of args.patches) {
          if (!c.includes(patch.old_str)) { errors.push(`Not found: "${patch.old_str.slice(0, 40)}"`); continue; }
          c = c.split(patch.old_str).join(patch.new_str);
        }
        await fs.writeFile(p, c, "utf-8");
        emit("file_changed", { path: args.path, action: "edit" });
        return errors.length ? `⚠ Partial patch: ${errors.join("; ")}` : `✓ Patched: ${args.path} (${args.patches.length} changes)`;
      } catch (e: any) { return `Error: ${e.message}`; }
    }
    case "read_file": {
      try {
        let c = await fs.readFile(path.join(workspace, args.path), "utf-8");
        if (args.start_line || args.end_line) {
          const lines = c.split("\n");
          c = lines.slice((args.start_line || 1) - 1, args.end_line || lines.length).join("\n");
        }
        return c.length > 10000 ? c.slice(0, 10000) + "\n...[truncated]" : c;
      } catch (e: any) { return `Error reading ${args.path}: ${e.message}`; }
    }
    case "run_command": {
      const timeout = (args.timeout_seconds || 120) * 1000;
      const { output, exitCode } = await runCommand(args.command, workspace, timeout);
      return `[exit: ${exitCode}]\n${output}`.slice(0, 12000);
    }
    case "start_dev_server": {
      const existing = devServers.get(conversationId);
      if (existing) { try { existing.process.kill("SIGTERM"); } catch {} devServers.delete(conversationId); }
      const port = args.expected_port || nextPort++;
      if (nextPort > 4999) nextPort = 4000;
      let cmd = args.command;
      if (!cmd.includes("--port") && !cmd.includes("-p ")) {
        if (cmd.match(/npm run (dev|start)/)) cmd = cmd.replace(/npm run (\w+)/, `npm run $1 -- --port ${port}`);
        else if (cmd.includes("vite")) cmd += ` --port ${port}`;
        else if (cmd.match(/flask|uvicorn|fastapi/)) cmd += ` --port ${port}`;
        else cmd = `PORT=${port} ${cmd}`;
      }
      const proc = spawn("bash", ["-c", cmd], { cwd: workspace, env: { ...process.env, PORT: String(port) } });
      proc.stdout?.on("data", (d: any) => emit("terminal_data", { data: d.toString() }));
      proc.stderr?.on("data", (d: any) => emit("terminal_data", { data: d.toString() }));
      devServers.set(conversationId, { port, process: proc, url: `/preview/${conversationId}/` });
      const ready = await waitForPort(port, 30000);
      if (ready) {
        const previewUrl = `/preview/${conversationId}/`;
        emit("preview_ready", { url: previewUrl, port });
        return `✓ Dev server running on port ${port}. Preview URL: ${previewUrl}`;
      }
      return `⚠ Server started but port ${port} not ready after 30s. Check terminal output for errors.`;
    }
    case "list_files": {
      const items = await listDirectory(workspace, args.path || "");
      if (args.recursive) {
        const flat = (items: any[], pre = ""): string[] => items.flatMap((i: any) => i.type === "directory" ? [`📁 ${pre + i.name}/`, ...flat(i.children || [], pre + i.name + "/")] : [`  ${pre + i.name}`]);
        return flat(items).join("\n") || "(empty)";
      }
      return items.map((i: any) => `${i.type === "directory" ? "📁" : "  "} ${i.name}`).join("\n") || "(empty)";
    }
    case "delete_file": {
      try { await fs.rm(path.join(workspace, args.path), { recursive: !!args.recursive, force: true }); emit("file_changed", { path: args.path, action: "delete" }); return `✓ Deleted: ${args.path}`; }
      catch (e: any) { return `Error: ${e.message}`; }
    }
    case "search_files": {
      const sp = args.path ? path.join(workspace, args.path) : workspace;
      const fa = args.file_pattern ? `--include="${args.file_pattern}"` : "";
      const { output } = await runCommand(`grep -rn ${fa} "${args.pattern.replace(/"/g, '\\"')}" . 2>/dev/null | head -60`, sp);
      return output.trim() || "No matches found";
    }
    case "create_directory": {
      try { await fs.mkdir(path.join(workspace, args.path), { recursive: true }); return `✓ Created: ${args.path}`; }
      catch (e: any) { return `Error: ${e.message}`; }
    }
    case "move_file": {
      try { await fs.rename(path.join(workspace, args.from), path.join(workspace, args.to)); emit("file_changed", { path: args.to, action: "write" }); return `✓ Moved: ${args.from} → ${args.to}`; }
      catch (e: any) { return `Error: ${e.message}`; }
    }
    case "get_project_info": {
      let info = "";
      try { const pkg = JSON.parse(await fs.readFile(path.join(workspace, "package.json"), "utf-8")); info += `📦 ${pkg.name} v${pkg.version}\nScripts: ${Object.keys(pkg.scripts || {}).join(", ")}\nDeps: ${Object.keys(pkg.dependencies || {}).slice(0, 15).join(", ")}\n`; } catch {}
      try { info += `\nREADME:\n${(await fs.readFile(path.join(workspace, "README.md"), "utf-8")).slice(0, 400)}`; } catch {}
      const { output } = await runCommand("find . -type f | grep -v node_modules | grep -v .git | wc -l", workspace);
      info += `\nTotal files: ${output.trim()}`;
      return info || "Empty workspace";
    }
    case "web_search": {
      try {
        const { output } = await runCommand(`curl -sL "https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1&skip_disambig=1" 2>/dev/null`, workspace, 15000);
        const d = JSON.parse(output);
        const results = [d.AbstractText, d.Answer, ...(d.RelatedTopics || []).slice(0, 5).map((t: any) => t.Text)].filter(Boolean);
        return results.length > 0 ? results.join("\n\n") : `No instant answer for "${args.query}".`;
      } catch { return "Search failed."; }
    }
    default: return `Unknown tool: ${name}`;
  }
}

// API
app.get("/api/health", (_, res) => res.json({ status: "ok", version: "3.0.0" }));
app.get("/api/skills", (_, res) => res.json(Object.entries(SKILLS).map(([id, s]) => ({ id, ...s }))));
app.get("/api/models", (_, res) => res.json(GROQ_MODELS));
app.get("/api/settings", (_, res) => res.json({ has_groq_key: !!process.env.GROQ_API_KEY }));
app.get("/api/conversations", (_, res) => {
  const result = Object.values(conversationsDB).sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).map(({ messages, ...meta }: any) => meta);
  res.json(result);
});
app.post("/api/conversations", async (req, res) => {
  const id = uuidv4();
  const conv = { id, title: req.body.title || "New Project", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "idle", message_count: 0, model: req.body.model || "llama-3.3-70b-versatile", messages: [], pinned: false };
  conversationsDB[id] = conv; await ensureWorkspace(id); await saveConversations(conversationsDB); res.json(conv);
});
app.get("/api/conversations/:id", (req, res) => { const c = conversationsDB[req.params.id]; if (!c) return res.status(404).json({ error: "Not found" }); res.json(c); });
app.patch("/api/conversations/:id", async (req, res) => { const c = conversationsDB[req.params.id]; if (!c) return res.status(404).json({ error: "Not found" }); Object.assign(c, req.body); await saveConversations(conversationsDB); res.json(c); });
app.delete("/api/conversations/:id", async (req, res) => {
  const ds = devServers.get(req.params.id); if (ds) { try { ds.process.kill(); } catch {} devServers.delete(req.params.id); }
  delete conversationsDB[req.params.id]; await saveConversations(conversationsDB);
  try { await fs.rm(getWorkspace(req.params.id), { recursive: true, force: true }); } catch {}
  res.json({ success: true });
});
app.get("/api/conversations/:id/files", async (req, res) => res.json(await listDirectory(getWorkspace(req.params.id), (req.query.path as string) || "")));
app.get("/api/conversations/:id/files/content", async (req, res) => {
  try { res.json({ content: await fs.readFile(path.join(getWorkspace(req.params.id), req.query.path as string), "utf-8") }); }
  catch { res.status(500).json({ error: "Cannot read file" }); }
});
app.post("/api/conversations/:id/files/write", async (req, res) => {
  try {
    const p = path.join(getWorkspace(req.params.id), req.body.path);
    await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, req.body.content, "utf-8");
    io.to(req.params.id).emit("file_changed", { path: req.body.path, action: "write" }); res.json({ success: true });
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

const activeAgentLoops: Map<string, boolean> = new Map();

io.on("connection", (socket) => {
  socket.on("join_conversation", ({ conversation_id }) => {
    socket.join(conversation_id);
    const ds = devServers.get(conversation_id);
    if (ds) socket.emit("preview_ready", { url: ds.url, port: ds.port });
    socket.emit("joined", { conversation_id });
  });

  socket.on("stop_agent", ({ conversation_id }) => {
    activeAgentLoops.set(conversation_id, false);
    io.to(conversation_id).emit("agent_status", { status: "idle" });
  });

  socket.on("terminal_run", async ({ conversation_id, command }) => {
    const w = await ensureWorkspace(conversation_id);
    socket.emit("terminal_start", { command });
    await runCommandStreaming(command, w, (data) => socket.emit("terminal_data", { data }));
    socket.emit("terminal_done");
  });

  socket.on("send_message", async ({ conversation_id, content, model }) => {
    if (!conversationsDB[conversation_id]) {
      conversationsDB[conversation_id] = { id: conversation_id, title: content.slice(0, 60), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "running", message_count: 0, messages: [], model: model || "llama-3.3-70b-versatile", pinned: false };
    }
    const conv = conversationsDB[conversation_id];
    const selectedModel = model || conv.model || "llama-3.3-70b-versatile";
    const userMsg = { id: uuidv4(), role: "user", content, timestamp: new Date().toISOString() };
    conv.messages.push(userMsg); conv.updated_at = new Date().toISOString(); conv.status = "running";
    io.to(conversation_id).emit("agent_status", { status: "running" });
    const assistantId = uuidv4();
    io.to(conversation_id).emit("message_start", { id: assistantId, role: "assistant", timestamp: new Date().toISOString() });
    const history: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...conv.messages.slice(-30).map((m: any) => ({ role: m.role, content: m.content }))];
    const workspace = await ensureWorkspace(conversation_id);
    let fullResponse = "";
    const emit = (e: string, d: any) => io.to(conversation_id).emit(e, d);

    try {
      const client = getGroqClient();
      activeAgentLoops.set(conversation_id, true);
      let loops = 0;
      while (loops++ < 20) {
        if (!activeAgentLoops.get(conversation_id)) break;
        const stream = await (client.chat.completions.create as any)({ model: selectedModel, messages: history, tools: TOOLS, tool_choice: "auto", stream: true, temperature: 0.2, max_tokens: 8000 });
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
        if (toolCalls.length > 0) {
          const atm: any = { role: "assistant", tool_calls: toolCalls.map(tc => ({ id: tc.id, type: "function", function: tc.function })) };
          if (currentContent) atm.content = currentContent;
          history.push(atm);
          for (const tc of toolCalls) {
            const tname = tc.function.name; let args: any = {};
            try { args = JSON.parse(tc.function.arguments); } catch {}
            io.to(conversation_id).emit("tool_use", { tool: tname, args, timestamp: new Date().toISOString() });
            const result = await executeTool(tname, args, workspace, conversation_id, emit);
            io.to(conversation_id).emit("tool_result", { tool: tname, result, args, timestamp: new Date().toISOString() });
            history.push({ role: "tool", tool_call_id: tc.id, content: result });
          }
          continue;
        }
        if (currentContent) history.push({ role: "assistant", content: currentContent });
        break;
      }
    } catch (e: any) {
      io.to(conversation_id).emit("agent_error", { message: e.message });
      fullResponse += `\n\n⚠️ **Error:** ${e.message}`;
    }

    conv.messages.push({ id: assistantId, role: "assistant", content: fullResponse, timestamp: new Date().toISOString() });
    conv.message_count = conv.messages.length; conv.updated_at = new Date().toISOString(); conv.status = "idle";
    if (conv.messages.length === 2) conv.title = content.slice(0, 60);
    activeAgentLoops.delete(conversation_id);
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

httpServer.listen(PORT, "0.0.0.0", () => console.log(`\n🚀 APEX v3 → http://localhost:${PORT}\n`));
