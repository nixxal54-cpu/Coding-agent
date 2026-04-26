import React from "react";
import Editor from "@monaco-editor/react";
import { Save, X, RotateCcw, Copy, Check } from "lucide-react";
import { getFileContent, writeFileContent } from "@/src/api/conversations";

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", json: "json", css: "css", html: "html", md: "markdown",
  sh: "shell", bash: "shell", yaml: "yaml", yml: "yaml", toml: "ini",
  rs: "rust", go: "go", java: "java", cpp: "cpp", c: "c", rb: "ruby",
};

function getLang(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_LANG[ext] || "plaintext";
}

export default function CodeEditor({ conversationId, filePath }: { conversationId: string; filePath: string | null }) {
  const [content, setContent] = React.useState("");
  const [original, setOriginal] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    getFileContent(conversationId, filePath)
      .then((data) => { setContent(data.content); setOriginal(data.content); })
      .catch(() => { setContent("// Error loading file"); })
      .finally(() => setLoading(false));
  }, [filePath, conversationId]);

  const save = async () => {
    if (!filePath) return;
    setSaving(true);
    await writeFileContent(conversationId, filePath, content);
    setOriginal(content);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDirty = content !== original;

  if (!filePath) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3" style={{ background: "#080b0f" }}>
        <div className="text-4xl">📄</div>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>Select a file to edit</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#080b0f" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--color-cyan)" }}>
          {filePath} {isDirty && <span style={{ color: "var(--color-yellow)" }}>●</span>}
        </span>
        <button onClick={copy} className="p-1.5 rounded transition-colors" style={{ color: "var(--color-muted)" }}>
          {copied ? <Check size={13} style={{ color: "var(--color-green)" }} /> : <Copy size={13} />}
        </button>
        <button onClick={() => { setContent(original); }} disabled={!isDirty} className="p-1.5 rounded disabled:opacity-30 transition-colors" style={{ color: "var(--color-muted)" }}>
          <RotateCcw size={13} />
        </button>
        <button onClick={save} disabled={!isDirty || saving} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-30 transition-all" style={{ background: "var(--color-cyan2)", color: "#000" }}>
          {saved ? <Check size={12} /> : <Save size={12} />}
          {saving ? "Saving…" : saved ? "Saved!" : "Save"}
        </button>
      </div>
      {/* Editor */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-muted)" }}>Loading…</div>
      ) : (
        <div className="flex-1">
          <Editor
            height="100%"
            language={getLang(filePath)}
            value={content}
            onChange={(val) => setContent(val || "")}
            theme="vs-dark"
            options={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              lineHeight: 1.6,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              renderLineHighlight: "gutter",
              padding: { top: 12, bottom: 12 },
              smoothScrolling: true,
              cursorSmoothCaretAnimation: "on",
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>
      )}
    </div>
  );
}
