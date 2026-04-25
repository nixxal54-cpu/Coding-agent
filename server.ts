import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
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

// Ensure workspace exists
await fs.mkdir(WORKSPACE_DIR, { recursive: true });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());

// --- In-memory store ---
const conversations: Record<string, any[]> = {};

// --- Helper Functions ---
function getWorkspace(conversationId: string) {
  const p = path.join(WORKSPACE_DIR, conversationId);
  return p;
}

async function ensureWorkspace(conversationId: string) {
  const p = getWorkspace(conversationId);
  await fs.mkdir(p, { recursive: true });
  return p;
}

// --- Terminal Service ---
function runCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolve) => {
    const shell = spawn("bash", ["-c", command], { cwd });
    let output = "";
    shell.stdout.on("data", (data) => (output += data.toString()));
    shell.stderr.on("data", (data) => (output += data.toString()));
    shell.on("close", () => resolve(output || "(no output)"));
    setTimeout(() => {
        shell.kill();
        resolve(output + "\n[Command timed out after 30s]");
    }, 30000);
  });
}

// --- File Service ---
async function listDirectory(workspace: string, relPath: string = ""): Promise<any[]> {
  const fullPath = path.join(workspace, relPath);
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const items = await Promise.all(
      entries.map(async (entry) => {
        const itemRelPath = path.join(relPath, entry.name);
        if (["node_modules", ".git", "dist", ".next"].includes(entry.name)) {
            return null;
        }
        const item: any = {
          name: entry.name,
          path: itemRelPath,
          type: entry.isDirectory() ? "directory" : "file",
        };
        if (entry.isDirectory()) {
          item.children = await listDirectory(workspace, itemRelPath);
        }
        return item;
      })
    );
    return items
        .filter(i => i !== null)
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
  } catch (e) {
    return [];
  }
}

    // --- Agent Logic ---
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const client = new OpenAI({
    apiKey: GROQ_API_KEY || "missing_key",
    baseURL: "https://api.groq.com/openai/v1",
    });

    const TOOLS: any[] = [
    {
        type: "function",
        function: {
        name: "run_command",
        description: "Run a bash command in the workspace terminal",
        parameters: {
            type: "object",
            properties: {
            command: { type: "string", description: "The bash command to run" },
            },
            required: ["command"],
        },
        },
    },
    {
        type: "function",
        function: {
        name: "read_file",
        description: "Read the contents of a file (first 5000 characters only)",
        parameters: {
            type: "object",
            properties: {
            path: { type: "string", description: "File path relative to workspace" },
            },
            required: ["path"],
        },
        },
    },
    {
        type: "function",
        function: {
        name: "write_file",
        description: "Write content to a file",
        parameters: {
            type: "object",
            properties: {
            path: { type: "string", description: "File path relative to workspace" },
            content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
        },
        },
    },
    {
        type: "function",
        function: {
        name: "list_files",
        description: "List files in a directory",
        parameters: {
            type: "object",
            properties: {
            path: { type: "string", description: "Directory path, default is workspace root" },
            },
        },
        },
    },
    ];

    const SYSTEM_PROMPT = `You are an expert AI coding agent. You can:
    - Read and write files
    - Run terminal commands
    - Debug and fix code
    - Create new projects from scratch

    When asked to do something, think step by step and use your tools to accomplish the task.
    Always run commands to verify your work. Be concise in your explanations.
    Note: If you read a file, you see a truncated version if it's too long. Use grep or specific commands if you need to find something precise.`;

    // --- API Routes ---
    app.get("/api/health", (req, res) => res.json({ status: "ok" }));

    app.get("/api/settings", (req, res) => {
    res.json({
        app_mode: "oss",
        llm_model: "groq/llama-3.3-70b-versatile",
        agent: "CodeActAgent",
    });
    });

    app.get("/api/conversations", (req, res) => {
    const result = Object.entries(conversations).map(([id, msgs]) => ({
        id,
        title: msgs[0]?.content?.slice(0, 50) + "..." || "New Conversation",
        created_at: msgs[0]?.timestamp || new Date().toISOString(),
        updated_at: msgs[msgs.length - 1]?.timestamp || new Date().toISOString(),
        status: "idle",
        message_count: msgs.length,
    }));
    res.json(result);
    });

    app.post("/api/conversations", async (req, res) => {
    const id = uuidv4();
    conversations[id] = [];
    await ensureWorkspace(id);
    res.json({
        id,
        title: req.body.title || "New Conversation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "idle",
    });
    });

    app.get("/api/conversations/:id", (req, res) => {
    res.json({
        id: req.params.id,
        messages: conversations[req.params.id] || [],
        status: "idle",
    });
    });

    app.delete("/api/conversations/:id", (req, res) => {
    delete conversations[req.params.id];
    res.json({ success: true });
    });

    app.get("/api/conversations/:id/files", async (req, res) => {
    const workspace = getWorkspace(req.params.id);
    const files = await listDirectory(workspace, (req.query.path as string) || "");
    res.json(files);
    });

    app.get("/api/conversations/:id/files/content", async (req, res) => {
    const workspace = getWorkspace(req.params.id);
    try {
        const content = await fs.readFile(path.join(workspace, req.query.path as string), "utf-8");
        res.json({ content });
    } catch (e) {
        res.status(500).json({ error: "Could not read file" });
    }
    });

    app.post("/api/terminal/run", async (req, res) => {
    const workspace = await ensureWorkspace(req.body.conversation_id);
    const output = await runCommand(req.body.command, workspace);
    res.json({ output });
    });

    // --- Socket Handlers ---
    io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join_conversation", ({ conversation_id }) => {
        socket.join(conversation_id);
        socket.emit("joined", { conversation_id });
    });

    socket.on("send_message", async ({ conversation_id, content }) => {
        if (!conversations[conversation_id]) conversations[conversation_id] = [];
        
        const userMsg = {
        id: uuidv4(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
        };
        conversations[conversation_id].push(userMsg);

        io.to(conversation_id).emit("agent_status", { status: "running" });

        const assistantId = uuidv4();
        io.to(conversation_id).emit("message_start", {
        id: assistantId,
        role: "assistant",
        timestamp: new Date().toISOString(),
        });

        // Get fresh history, reasonably truncated
        let history = [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversations[conversation_id].slice(-8).map(m => ({ role: m.role, content: m.content }))
        ];

        const workspace = await ensureWorkspace(conversation_id);
        let fullResponse = "";

        try {
        let loopCount = 0;
        const maxLoops = 5;

        while (loopCount < maxLoops) {
            loopCount++;
            const stream = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: history as any,
            tools: TOOLS,
            tool_choice: "auto",
            stream: true,
            });

            let currentContent = "";
            let toolCalls: any[] = [];

            for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
                currentContent += delta.content;
                fullResponse += delta.content;
                io.to(conversation_id).emit("message_token", { id: assistantId, token: delta.content });
            }
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

            if (currentContent) {
            history.push({ role: "assistant", content: currentContent } as any);
            }

            if (toolCalls.length > 0) {
            const assistantToolMsg: any = { role: "assistant", tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: "function",
                function: tc.function
            })) };
            history.push(assistantToolMsg);

            for (const tc of toolCalls) {
                const name = tc.function.name;
                let args = {};
                try { args = JSON.parse(tc.function.arguments); } catch(e) {}

                io.to(conversation_id).emit("tool_use", { tool: name, args, timestamp: new Date().toISOString() });

                let result = "";
                if (name === "run_command") result = await runCommand((args as any).command, workspace);
                else if (name === "read_file") {
                    try { 
                        result = await fs.readFile(path.join(workspace, (args as any).path), "utf-8");
                        // Hard truncate result for LLM view
                        if (result.length > 5000) {
                            result = result.substring(0, 5000) + "\n... [Content truncated, use grep for more]";
                        }
                    } catch(e) { result = `Error reading file: ${e}`; }
                } else if (name === "write_file") {
                    try {
                        const filePath = path.join(workspace, (args as any).path);
                        await fs.mkdir(path.dirname(filePath), { recursive: true });
                        await fs.writeFile(filePath, (args as any).content, "utf-8");
                        result = `File written: ${(args as any).path}`;
                    } catch(e) { result = `Error writing file: ${e}`; }
                } else if (name === "list_files") {
                    const items = await listDirectory(workspace, (args as any).path || "");
                    result = items.map(i => `${i.type === "directory" ? "[DIR]" : "[FILE]"} ${i.name}`).join("\n") || "(empty directory)";
                    if (result.length > 2000) result = result.substring(0, 2000) + "\n... [Too many files listed]";
                } else result = `Unknown tool: ${name}`;

                io.to(conversation_id).emit("tool_result", { tool: name, result, timestamp: new Date().toISOString() });

                history.push({
                role: "tool",
                tool_call_id: tc.id,
                content: result
                } as any);
            }
            continue; // Loop to get next response after tools
            }
            break; // No more tool calls
        }
        } catch (e: any) {
        console.error(e);
        const errorMsg = e.message || "An error occurred";
        io.to(conversation_id).emit("error", { message: errorMsg });
        fullResponse += `\n\n[Error: ${errorMsg}]`;
        }

        const assistantMsg = {
        id: assistantId,
        role: "assistant",
        content: fullResponse,
        timestamp: new Date().toISOString(),
        };
        conversations[conversation_id].push(assistantMsg);

        io.to(conversation_id).emit("message_done", { id: assistantId });
        io.to(conversation_id).emit("agent_status", { status: "idle" });
    });
    });

// --- Vite Middleware ---
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
