import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Eye, EyeOff, Key, Cpu, Zap } from "lucide-react";
import { saveApiKeys, getSettings, getModels } from "@/src/api/conversations";
import { useSettingsStore } from "@/src/stores/settings-store";

export default function Settings() {
  const navigate = useNavigate();
  const { selectedModel, setSelectedModel } = useSettingsStore();
  const [groqKey, setGroqKey] = React.useState("");
  const [openaiKey, setOpenaiKey] = React.useState("");
  const [geminiKey, setGeminiKey] = React.useState("");
  const [show, setShow] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [serverSettings, setServerSettings] = React.useState<any>({});
  const [models, setModels] = React.useState<any[]>([]);

  React.useEffect(() => {
    getSettings().then(setServerSettings);
    getModels().then(setModels);
  }, []);

  const save = async () => {
    setSaving(true);
    await saveApiKeys({ groq_key: groqKey || undefined, openai_key: openaiKey || undefined, gemini_key: geminiKey || undefined });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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

        {/* API Keys */}
        <section className="mb-8 rounded-2xl p-6" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Key size={16} style={{ color: "var(--color-cyan)" }} />
            <h2 className="font-semibold text-white">API Keys</h2>
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>Keys are stored locally in your .env file. At least one provider key is required.</p>

          {[
            { key: "groq", label: "Groq API Key", val: groqKey, set: setGroqKey, hint: "Get free key at console.groq.com", status: serverSettings.has_groq_key },
            { key: "openai", label: "OpenAI API Key", val: openaiKey, set: setOpenaiKey, hint: "Required for GPT-4o models", status: serverSettings.has_openai_key },
            { key: "gemini", label: "Google Gemini Key", val: geminiKey, set: setGeminiKey, hint: "Required for Gemini models", status: serverSettings.has_gemini_key },
          ].map((f) => (
            <div key={f.key} className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{f.label}</label>
                {f.status && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.1)", color: "var(--color-green)" }}><Check size={10} /> Configured</span>}
              </div>
              <div className="relative">
                <input
                  type={show[f.key] ? "text" : "password"}
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.status ? "••••••••••••••••••••" : `Enter ${f.label}...`}
                  className="w-full px-3 pr-10 py-2.5 rounded-xl text-sm outline-none transition-colors"
                  style={{ background: "var(--color-surface2)", border: "1px solid var(--color-border)", color: "var(--color-text)", fontFamily: "var(--font-mono)" }}
                />
                <button onClick={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-muted)" }}>
                  {show[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--color-faint)" }}>{f.hint}</p>
            </div>
          ))}

          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 mt-2" style={{ background: "var(--color-cyan2)", color: "#000" }}>
            {saved ? <><Check size={16} /> Saved!</> : saving ? "Saving…" : "Save API Keys"}
          </button>
        </section>

        {/* Model */}
        <section className="rounded-2xl p-6" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={16} style={{ color: "var(--color-cyan)" }} />
            <h2 className="font-semibold text-white">Default Model</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {models.map((m) => (
              <button key={m.id} onClick={() => setSelectedModel(m.id)}
                className="flex flex-col items-start p-3 rounded-xl text-left transition-all"
                style={{ background: selectedModel === m.id ? "rgba(14,165,233,0.1)" : "var(--color-surface2)", border: `1px solid ${selectedModel === m.id ? "var(--color-cyan2)" : "var(--color-border)"}` }}>
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm font-medium" style={{ color: selectedModel === m.id ? "white" : "var(--color-text)" }}>{m.name}</span>
                  {m.recommended && <span className="ml-auto text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(14,165,233,0.15)", color: "var(--color-cyan)" }}>★</span>}
                  {m.fast && <span className="ml-auto text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(74,222,128,0.15)", color: "var(--color-green)" }}>fast</span>}
                </div>
                <span className="text-xs mt-0.5 capitalize" style={{ color: "var(--color-muted)" }}>{m.provider}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
