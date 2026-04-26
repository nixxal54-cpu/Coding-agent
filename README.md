# APEX Coding Agent v2

A **complete, production-grade AI coding agent** with a modern UI — built with React, Vite, TypeScript, Express, Socket.io, and Groq.

---

## 🚀 Features

### Agent Capabilities (11 Tools)
| Tool | Description |
|------|-------------|
| `run_command` | Execute bash commands with streaming output |
| `read_file` | Read file contents with line-range support |
| `write_file` | Write files (auto-creates directories) |
| `edit_file` | Surgical string-replace edits |
| `list_files` | List directory contents (recursive option) |
| `delete_file` | Delete files or directories |
| `search_files` | Grep-based pattern search across files |
| `create_directory` | Create nested directories |
| `move_file` | Move or rename files |
| `get_project_info` | Workspace overview and project metadata |
| `web_search` | Search the web for docs and solutions |

### UI Features
- **Chat Panel** — Streaming messages, collapsible tool call inspector with colored output
- **Live Terminal** — Real streaming shell with command history, agent-driven output
- **File Explorer** — Tree view with delete, refresh, file size display
- **Code Editor** — Monaco editor with syntax highlighting, save/discard, copy
- **Settings** — API key management, model selector, persisted preferences
- **Skills** — 10 quick-start templates (React, Next.js, Express, Python, Docker, etc.)
- **Persistent Conversations** — All chats saved to disk, pinning, search
- **Multi-model** — Groq (Llama), OpenAI (GPT-4o), Google (Gemini)
- **Resizable panels** — Drag the divider to adjust chat/tools widths
- **Panel maximize** — Expand the tools panel to full screen

---

## 🛠 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure API key
```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY (free at console.groq.com)
```

Or configure keys in the UI: open **Settings** from the sidebar.

### 3. Run
```bash
npm run dev
```

Open http://localhost:3000

---

## 📁 Project Structure

```
├── server.ts              # Express + Socket.io backend + agent logic
├── src/
│   ├── App.tsx
│   ├── index.css
│   ├── pages/
│   │   ├── Home.tsx          # Landing page with skills grid
│   │   ├── ConversationPage.tsx  # Main agent workspace
│   │   └── Settings.tsx      # API keys + model config
│   ├── components/
│   │   ├── chat/ChatInterface.tsx    # Streaming chat + tool inspector
│   │   ├── terminal/Terminal.tsx     # xterm.js terminal
│   │   ├── files/FileExplorer.tsx    # File tree
│   │   ├── editor/CodeEditor.tsx     # Monaco editor
│   │   └── layout/                   # Sidebar + MainLayout
│   ├── stores/              # Zustand state management
│   ├── api/                 # Axios API client
│   └── socket/              # Socket.io client
├── agent_workspace/         # Per-conversation workspaces (gitignored)
└── agent_data/              # Conversation persistence (gitignored)
```

---

## 🔧 Adding More Models

Edit the `/api/models` route in `server.ts` and add your model ID. Use the `getClient()` function to route to the correct provider based on the model name prefix.

## 💡 Adding Skills

Edit the `SKILLS` object in `server.ts`:
```ts
"my-skill": {
  name: "My Skill",
  description: "What it does",
  icon: "🎯",
  prompt: "The full instruction sent to the agent..."
}
```
