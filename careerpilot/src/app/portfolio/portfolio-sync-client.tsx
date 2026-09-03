"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  RefreshCw,
  Check,
  X,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Info,
} from "lucide-react";
import { parseJsonField } from "@/lib/utils";

interface ClientProps {
  queueItems: any[];
  syncHistory: any[];
}

export function PortfolioSyncClient({ queueItems, syncHistory }: ClientProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function triggerSync() {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/portfolio/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Portfolio synced successfully. Found ${data.itemsFound} items in verification queue.`);
        router.refresh();
      } else {
        const err = await res.json();
        setMessage(`Sync failed: ${err.error || "Unknown error"}`);
      }
    } catch {
      setMessage("Failed to connect to portfolio scraper");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAction(itemId: string, action: "APPROVE" | "REJECT") {
    try {
      const res = await fetch("/api/portfolio/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, action }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      setMessage("Failed to process item");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-400" />
            Portfolio Website Integration
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
            Fetch projects & experiences from your portfolio without overriding verified data automatically
          </p>
        </div>
        <button onClick={triggerSync} disabled={syncing} className="btn btn-primary">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync Portfolio Live
        </button>
      </div>

      {message && <div className="toast">{message}</div>}

      {/* Info Banner */}
      <div className="card p-4 flex items-start gap-3 bg-blue-500/5 border-blue-500/20">
        <ShieldAlert className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-300 leading-relaxed">
          <strong className="text-white">Strict Verification Protocol:</strong> Discovered portfolio information is marked as <span className="text-amber-400 font-semibold">"Needs Verification"</span> and placed in this queue. Items only enter your Master Career Database once explicitly approved by you.
        </div>
      </div>

      {/* Verification Queue */}
      <div className="space-y-4">
        <h2 className="section-heading mb-0">Verification Queue ({queueItems.length} Pending)</h2>

        {queueItems.length === 0 ? (
          <div className="empty-state card">
            <Check className="w-12 h-12 text-emerald-400 opacity-60" />
            <p className="text-sm font-medium mt-2">Verification Queue Clean</p>
            <p className="text-xs mt-1 text-zinc-500">
              No new unverified items detected from portfolio.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queueItems.map((item) => {
              const data = parseJsonField<any>(item.itemData, {});
              return (
                <div key={item.id} className="card p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="badge bg-amber-500/10 border-amber-500/20 text-amber-300 capitalize text-[10px]">
                        {item.itemType}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">Source: {item.source}</span>
                    </div>

                    <h3 className="text-sm font-bold text-white">
                      {data.projectName || data.role || data.name || "Portfolio Item"}
                    </h3>

                    {data.company && (
                      <p className="text-xs text-blue-400 font-medium">{data.company} {data.period && `(${data.period})`}</p>
                    )}

                    {data.description && (
                      <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">{data.description}</p>
                    )}

                    {data.technologies && data.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {data.technologies.map((t: string) => (
                          <span key={t} className="badge bg-zinc-800 text-zinc-400 text-[9px]">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAction(item.id, "REJECT")}
                      className="btn btn-ghost btn-sm text-red-400 hover:bg-red-500/10"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleAction(item.id, "APPROVE")}
                      className="btn btn-primary btn-sm text-emerald-300 bg-emerald-600 hover:bg-emerald-500"
                    >
                      <Check className="w-4 h-4" />
                      Approve & Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
