"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Cpu, Mail, Sliders, Save, Loader2, Key } from "lucide-react";

interface SettingsClientProps {
  settings: any;
}

export function SettingsClient({ settings }: SettingsClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    aiProvider: settings.aiProvider || "gemini",
    aiApiKey: settings.aiApiKey || "",
    highPriorityMin: settings.highPriorityMin || 85,
    strongMatchMin: settings.strongMatchMin || 70,
    stretchMatchMin: settings.stretchMatchMin || 55,
    smtpServer: settings.smtpServer || "smtp.gmail.com",
    smtpPort: settings.smtpPort || 587,
    smtpUsername: settings.smtpUsername || "",
    smtpPassword: settings.smtpPassword || "",
    destinationEmail: settings.destinationEmail || "",
    preferredFont: settings.preferredFont || "Calibri",
  });

  const update = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage("Settings saved successfully");
        router.refresh();
      } else {
        setMessage("Failed to save settings");
      }
    } catch {
      setMessage("Connection error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-400" />
            System Settings
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
            Configure AI provider, API keys, match score thresholds, and SMTP email parameters
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {message && <div className="toast">{message}</div>}

      {/* AI Provider Config */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">AI Engine Provider</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">AI Model Provider</label>
            <select
              className="input"
              value={form.aiProvider}
              onChange={(e) => update("aiProvider", e.target.value)}
            >
              <option value="gemini">Google Gemini (Recommended)</option>
              <option value="openai">OpenAI (gpt-4o-mini)</option>
              <option value="groq">Groq Llama-3</option>
            </select>
          </div>

          <div>
            <label className="label">
              <Key className="w-3 h-3 inline mr-1" />
              AI API Key
            </label>
            <input
              type="password"
              className="input"
              value={form.aiApiKey}
              onChange={(e) => update("aiApiKey", e.target.value)}
              placeholder="Leave empty to use server .env AI_API_KEY"
            />
          </div>
        </div>
      </div>

      {/* Match Thresholds */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Job Recommendation Thresholds</h2>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">High Priority Min (%)</label>
            <input
              type="number"
              className="input font-mono"
              value={form.highPriorityMin}
              onChange={(e) => update("highPriorityMin", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Strong Match Min (%)</label>
            <input
              type="number"
              className="input font-mono"
              value={form.strongMatchMin}
              onChange={(e) => update("strongMatchMin", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Stretch Min (%)</label>
            <input
              type="number"
              className="input font-mono"
              value={form.stretchMatchMin}
              onChange={(e) => update("stretchMatchMin", Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* SMTP Email Settings */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Email Delivery Settings</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">SMTP Server</label>
            <input
              className="input font-mono"
              value={form.smtpServer}
              onChange={(e) => update("smtpServer", e.target.value)}
            />
          </div>
          <div>
            <label className="label">SMTP Port</label>
            <input
              type="number"
              className="input font-mono"
              value={form.smtpPort}
              onChange={(e) => update("smtpPort", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">SMTP Username / Gmail</label>
            <input
              className="input font-mono"
              value={form.smtpUsername}
              onChange={(e) => update("smtpUsername", e.target.value)}
              placeholder="shashwatsahu.contact@gmail.com"
            />
          </div>
          <div>
            <label className="label">SMTP Password / App Password</label>
            <input
              type="password"
              className="input font-mono"
              value={form.smtpPassword}
              onChange={(e) => update("smtpPassword", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
