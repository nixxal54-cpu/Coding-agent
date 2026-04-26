import React from "react";
import { Folder, FolderOpen, FileText, FileCode, File, Plus, RefreshCw, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { getFiles, deleteFile } from "@/src/api/conversations";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";

const EXT_ICONS: Record<string, { color: string }> = {
  ts: { color: "#38bdf8" }, tsx: { color: "#38bdf8" }, js: { color: "#fbbf24" }, jsx: { color: "#fbbf24" },
  py: { color: "#4ade80" }, json: { color: "#fb923c" }, css: { color: "#a78bfa" }, html: { color: "#f87171" },
  md: { color: "#94a3b8" }, sh: { color: "#4ade80" }, txt: { color: "#94a3b8" }, yaml: { color: "#fb923c" },
  yml: { color: "#fb923c" }, env: { color: "#fbbf24" }, gitignore: { color: "#94a3b8" },
};

function getExt(name: string) { return name.split(".").pop()?.toLowerCase() || ""; }
function getColor(name: string) { return EXT_ICONS[getExt(name)]?.color || "var(--color-muted)"; }

function FileIcon({ name, isDir, open }: { name: string; isDir: boolean; open?: boolean }) {
  if (isDir) return open ? <FolderOpen size={14} style={{ color: "#fbbf24" }} /> : <Folder size={14} style={{ color: "#fbbf24" }} />;
  const ext = getExt(name);
  if (["ts","tsx","js","jsx"].includes(ext)) return <FileCode size={14} style={{ color: getColor(name) }} />;
  return <FileText size={14} style={{ color: getColor(name) }} />;
}

function FileNode({ item, depth, onSelect, activePath, conversationId, onRefresh }: any) {
  const [open, setOpen] = React.useState(depth === 0);
  const [hover, setHover] = React.useState(false);
  const isDir = item.type === "directory";
  const isActive = activePath === item.path;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${item.name}?`)) return;
    await deleteFile(conversationId, item.path);
    onRefresh();
  };

  return (
    <div>
      <div
        onClick={() => { if (isDir) setOpen(!open); else onSelect(item.path); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer text-sm transition-colors group"
        style={{
          paddingLeft: 8 + depth * 14,
          background: isActive ? "var(--color-surface3)" : hover ? "var(--color-surface2)" : "transparent",
          color: isActive ? "white" : "var(--color-text)",
        }}
      >
        {isDir ? (open ? <ChevronDown size={12} style={{ color: "var(--color-muted)", flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: "var(--color-muted)", flexShrink: 0 }} />) : <span style={{ width: 12 }} />}
        <FileIcon name={item.name} isDir={isDir} open={open} />
        <span className="flex-1 truncate text-xs font-mono">{item.name}</span>
        {hover && !isDir && (
          <button onClick={handleDelete} className="opacity-0 group-hover:opacity-100 p-0.5 rounded" style={{ color: "var(--color-red)" }}>
            <Trash2 size={11} />
          </button>
        )}
        {!isDir && item.size !== undefined && (
          <span className="text-xs ml-1 flex-shrink-0 font-mono" style={{ color: "var(--color-faint)" }}>
            {item.size < 1024 ? `${item.size}b` : `${(item.size / 1024).toFixed(1)}k`}
          </span>
        )}
      </div>
      <AnimatePresence>
        {isDir && open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {(item.children || []).map((child: any) => (
              <FileNode key={child.path} item={child} depth={depth + 1} onSelect={onSelect} activePath={activePath} conversationId={conversationId} onRefresh={onRefresh} />
            ))}
            {(!item.children || item.children.length === 0) && (
              <div className="text-xs py-1 font-mono" style={{ paddingLeft: 8 + (depth + 1) * 14, color: "var(--color-faint)" }}>empty</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FileExplorer({ conversationId, onFileSelect, activePath }: any) {
  const [files, setFiles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const refresh = async () => {
    setLoading(true);
    const data = await getFiles(conversationId);
    setFiles(data);
    setLoading(false);
  };

  React.useEffect(() => { refresh(); }, [conversationId]);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-bg)" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>Explorer</span>
        <div className="flex items-center gap-1">
          <button onClick={refresh} className="p-1.5 rounded transition-colors" style={{ color: "var(--color-muted)" }}>
            <RefreshCw size={12} className={loading ? "animate-spin-slow" : ""} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {files.length === 0 && !loading ? (
          <div className="text-center py-12 text-xs font-mono" style={{ color: "var(--color-faint)" }}>
            <div className="mb-2">📁</div>
            Workspace is empty.<br />Ask APEX to create files.
          </div>
        ) : (
          files.map((f) => (
            <FileNode key={f.path} item={f} depth={0} onSelect={onFileSelect} activePath={activePath} conversationId={conversationId} onRefresh={refresh} />
          ))
        )}
      </div>
    </div>
  );
}
