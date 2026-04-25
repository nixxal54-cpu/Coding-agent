import React from "react";
import Editor from "@monaco-editor/react";
import { getFileContent } from "@/src/api/conversations";
import { FileCode, Loader2 } from "lucide-react";

interface CodeEditorProps {
  conversationId: string;
  filePath: string | null;
}

export default function CodeEditor({ conversationId, filePath }: CodeEditorProps) {
  const [content, setContent] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    getFileContent(conversationId, filePath)
      .then((data) => setContent(data.content))
      .catch(() => setContent("// Error loading file content"))
      .finally(() => setLoading(false));
  }, [conversationId, filePath]);

  const getLanguage = (path: string | null) => {
    if (!path) return "plaintext";
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "js":
      case "jsx": return "javascript";
      case "ts":
      case "tsx": return "typescript";
      case "py": return "python";
      case "html": return "html";
      case "css": return "css";
      case "json": return "json";
      case "md": return "markdown";
      case "sh": return "shell";
      case "yaml":
      case "yml": return "yaml";
      default: return "plaintext";
    }
  };

  if (!filePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted opacity-30 gap-4">
        <FileCode size={64} strokeWidth={1} />
        <p className="text-sm font-mono tracking-widest uppercase">Select a file to view source</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-base relative">
      <div className="h-10 bg-bg-secondary border-b border-border flex items-center px-4 gap-2">
        <FileCode size={14} className="text-accent" />
        <span className="text-xs font-mono text-text-secondary truncate">{filePath}</span>
        {loading && <Loader2 size={12} className="animate-spin text-accent" />}
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          path={filePath}
          defaultLanguage={getLanguage(filePath)}
          value={content}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: '"JetBrains Mono", monospace',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16 },
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            renderLineHighlight: "all",
          }}
        />
      </div>
    </div>
  );
}
