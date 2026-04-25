import React from "react";
import { 
  Folder, 
  FolderOpen, 
  File, 
  ChevronRight, 
  ChevronDown,
  RefreshCw
} from "lucide-react";
import { getFiles } from "@/src/api/conversations";
import { cn } from "@/src/lib/utils";

interface FileExplorerProps {
  conversationId: string;
  onFileSelect: (path: string) => void;
  activePath?: string;
}

export default function FileExplorer({ conversationId, onFileSelect, activePath }: FileExplorerProps) {
  const [files, setFiles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await getFiles(conversationId);
      setFiles(data);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadFiles();
  }, [conversationId]);

  return (
    <div className="flex flex-col h-full bg-bg-secondary select-none">
      <div className="h-12 border-b border-border flex items-center justify-between px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Explorer</span>
        <button 
          onClick={loadFiles}
          className={cn("text-text-muted hover:text-text-primary transition-all", loading && "animate-spin")}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {files.map((item) => (
          <FileTreeItem 
            key={item.path} 
            item={item} 
            onSelect={onFileSelect} 
            activePath={activePath} 
          />
        ))}
        {files.length === 0 && !loading && (
          <div className="text-center py-8 text-xs text-text-muted italic">
            Workspace is empty
          </div>
        )}
      </div>
    </div>
  );
}

function FileTreeItem({ item, onSelect, activePath, depth = 0 }: { 
    item: any, 
    onSelect: (p: string) => void, 
    activePath?: string,
    depth?: number 
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isDirectory = item.type === "directory";
  const isActive = activePath === item.path;

  const handleClick = () => {
    if (isDirectory) {
      setIsOpen(!isOpen);
    } else {
      onSelect(item.path);
    }
  };

  return (
    <div className="flex flex-col">
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={cn(
          "flex items-center gap-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm group",
          isActive ? "bg-accent/10 text-accent" : "hover:bg-bg-hover text-text-secondary hover:text-text-primary"
        )}
      >
        <span className="text-text-muted group-hover:text-text-primary transition-colors">
          {isDirectory ? (
             isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
             <div className="w-3.5" />
          )}
        </span>
        {isDirectory ? (
          isOpen ? <FolderOpen size={16} className="text-accent" /> : <Folder size={16} className="text-accent/70" />
        ) : (
          <File size={16} className="text-text-muted" />
        )}
        <span className="truncate">{item.name}</span>
      </div>

      {isDirectory && isOpen && item.children && (
        <div className="flex flex-col">
          {item.children.map((child: any) => (
            <FileTreeItem 
                key={child.path} 
                item={child} 
                onSelect={onSelect} 
                activePath={activePath} 
                depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
