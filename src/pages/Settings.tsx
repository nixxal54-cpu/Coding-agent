import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Cpu, Zap, CheckCircle2, Info } from "lucide-react";
import { getModels } from "@/src/api/conversations";
import { useSettingsStore } from "@/src/stores/settings-store";

export default function Settings() {
  const navigate = useNavigate();
  const { selectedModel, setSelectedModel } = useSettingsStore();
  const [models, setModels] = React.useState<any[]>([]);

  React.useEffect(() => { getModels().then(setModels); }, []);

  const currentModel = models.find((m) => m.id === selectedModel);

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm mb-8 transition-colors" style={{ color: "var(--color-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-muted)")}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--color-cyan2)" }}>
            <Zap size={20} color="#000" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>Configure APEX Coding Agent</p>
          </div>
        </div>

        {/* Provider Info */}
        <section className="mb-6 rounded-2xl p-5" style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.2)" }}>
          <div className="flex items-start gap-3">
            <Info size={16} style={{ color: "var(--color-cyan)", marginTop: 2, flexShrink: 0 }} />
            <div>
              <p className="text-sm font-medium text-white mb-1">Powered by Groq</p>
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                This agent uses Groq's API with a server-side key. No API key setup required — just start building.
              </p>
            </div>
          </div>
        </section>

        {/* Model Selection */}
        <section className="rounded-2xl p-6" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={16} style={{ color: "var(--color-cyan)" }} />
            <h2 className="font-semibold text-white">Default Model</h2>
          </div>
          <p className="text-sm mb-5" style={{ color: "var(--color-muted)" }}>
            Choose your default model. You can also switch models per-chat using the model picker in the chat bar.
          </p>

          <div className="flex flex-col gap-2">
            {models.map((m) => (
              <button key={m.id} onClick={() => setSelectedModel(m.id)}
                className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                style={{
                  background: selectedModel === m.id ? "rgba(14,165,233,0.08)" : "var(--color-surface2)",
                  border: `1px solid ${selectedModel === m.id ? "var(--color-cyan2)" : "var(--color-border)"}`,
                }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: selectedModel === m.id ? "white" : "var(--color-text)" }}>
                      {m.name}
                    </span>
                    {m.recommended && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                        style={{ background: "rgba(14,165,233,0.15)", color: "var(--color-cyan)" }}>★ recommended</span>
                    )}
                    {m.fast && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                        style={{ background: "rgba(74,222,128,0.15)", color: "var(--color-green)" }}>⚡ fast</span>
                    )}
                  </div>
                  {m.description && (
                    <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>{m.description}</p>
                  )}
                  <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--color-faint, #444)" }}>{m.id}</p>
                </div>
                {selectedModel === m.id && (
                  <CheckCircle2 size={18} style={{ color: "var(--color-cyan)", flexShrink: 0 }} />
                )}
              </button>
            ))}
          </div>

          {currentModel && (
            <p className="text-xs mt-4" style={{ color: "var(--color-muted)" }}>
              Currently selected: <span style={{ color: "var(--color-cyan)" }}>{currentModel.name}</span>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
