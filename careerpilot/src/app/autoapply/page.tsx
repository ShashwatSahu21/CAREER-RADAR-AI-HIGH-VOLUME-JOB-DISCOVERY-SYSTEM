"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Settings,
  Shield,
  Send,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Sliders,
  Layers,
  FileCheck,
} from "lucide-react";

interface AutoApplySettings {
  autoApplyEnabled: boolean;
  autoApplyThreshold: number;
  reviewThreshold: number;
  dailyLimit: number;
  greenhouseEnabled: boolean;
  leverEnabled: boolean;
  ashbyEnabled: boolean;
  linkedinEnabled: boolean;
  naukriEnabled: boolean;
  workdayEnabled: boolean;
  delayMin: number;
  delayMax: number;
}

interface AutoApplyStats {
  totalSubmissions: number;
  submittedCount: number;
  failedCount: number;
  reviewCount: number;
  successRate: number;
  platformStats: Record<string, number>;
}

interface Submission {
  id: string;
  jobTitle: string;
  company: string;
  platform: string;
  status: string;
  submissionMethod: string;
  confirmationId: string;
  errorMessage: string;
  screenshotUrl: string;
  submittedAt: string;
}

export default function AutoApplyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AutoApplySettings>({
    autoApplyEnabled: false,
    autoApplyThreshold: 85,
    reviewThreshold: 70,
    dailyLimit: 50,
    greenhouseEnabled: true,
    leverEnabled: true,
    ashbyEnabled: true,
    linkedinEnabled: true,
    naukriEnabled: true,
    workdayEnabled: true,
    delayMin: 5,
    delayMax: 15,
  });

  const [stats, setStats] = useState<AutoApplyStats>({
    totalSubmissions: 0,
    submittedCount: 0,
    failedCount: 0,
    reviewCount: 0,
    successRate: 0,
    platformStats: {},
  });

  const [readiness, setReadiness] = useState<{
    score: number;
    missingFields: string[];
    isReady: boolean;
  }>({ score: 0, missingFields: [], isReady: false });

  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/apply");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
        if (data.stats) setStats(data.stats);
        if (data.readiness) setReadiness(data.readiness);
        if (data.recentSubmissions) setSubmissions(data.recentSubmissions);
      }
    } catch (e) {
      console.error("Failed to load AutoApply status:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (updatedSettings: AutoApplySettings) => {
    setSaving(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          settings: updatedSettings,
        }),
      });
      if (res.ok) {
        setSettings(updatedSettings);
      }
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setSaving(false);
    }
  };

  const toggleMasterAutoApply = () => {
    const next = { ...settings, autoApplyEnabled: !settings.autoApplyEnabled };
    setSettings(next);
    handleSaveSettings(next);
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 p-6 lg:p-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 text-white">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                AutoApply Control Center
              </h1>
              <p className="text-sm text-zinc-400">
                Autonomous multi-platform job application engine with human-evasion stealth
              </p>
            </div>
          </div>
        </div>

        {/* Master Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={toggleMasterAutoApply}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold shadow-lg transition-all ${
              settings.autoApplyEnabled
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 ring-1 ring-emerald-400"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 ring-1 ring-zinc-700"
            }`}
          >
            {settings.autoApplyEnabled ? (
              <>
                <Play className="w-4 h-4 fill-white" />
                AutoApply Active
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                AutoApply Paused
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Applied</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">{stats.submittedCount}</div>
          <div className="mt-1 text-xs text-zinc-500">Applications sent to ATS</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Success Rate</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">{stats.successRate}%</div>
          <div className="mt-1 text-xs text-zinc-500">Submission pass rate</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Daily Target</span>
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">{settings.dailyLimit}</div>
          <div className="mt-1 text-xs text-zinc-500">Max applications per day</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Profile Health</span>
            <div className={`p-2 rounded-lg border ${readiness.isReady ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">{readiness.score}%</div>
          <div className="mt-1 text-xs text-zinc-500">
            {readiness.isReady ? "Ready for automated dispatch" : `${readiness.missingFields.length} missing fields`}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Platform Toggles & Threshold Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Platform Channels Matrix */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-semibold text-white">Target ATS & Job Boards</h2>
              </div>
              <span className="text-xs text-zinc-400 font-medium">Multi-Engine Adapters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: "greenhouseEnabled", name: "Greenhouse", tier: "Tier A (Direct API)", color: "emerald" },
                { key: "leverEnabled", name: "Lever", tier: "Tier A (Direct API)", color: "emerald" },
                { key: "ashbyEnabled", name: "Ashby", tier: "Tier A (Direct API)", color: "emerald" },
                { key: "linkedinEnabled", name: "LinkedIn Easy Apply", tier: "Tier C (Browser Stealth)", color: "blue" },
                { key: "naukriEnabled", name: "Naukri Quick Apply", tier: "Tier B (Browser Stealth)", color: "violet" },
                { key: "workdayEnabled", name: "Workday Portal", tier: "Tier C (Multi-Page)", color: "amber" },
              ].map((plat) => {
                const isEnabled = (settings as any)[plat.key];
                return (
                  <div
                    key={plat.key}
                    onClick={() => {
                      const next = { ...settings, [plat.key]: !isEnabled };
                      setSettings(next);
                      handleSaveSettings(next);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isEnabled
                        ? "bg-zinc-800/60 border-indigo-500/50 shadow-sm"
                        : "bg-zinc-950/40 border-zinc-800/60 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{plat.name}</span>
                      <div className={`w-2.5 h-2.5 rounded-full ${isEnabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                    </div>
                    <div className="mt-2 text-[11px] text-zinc-400">{plat.tier}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Decision Thresholds */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-semibold text-white">Application Matching Thresholds</h2>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-medium text-zinc-300 mb-2">
                  <span>Auto-Apply Match Score Cutoff</span>
                  <span className="font-bold text-indigo-400">{settings.autoApplyThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={settings.autoApplyThreshold}
                  onChange={(e) => {
                    const next = { ...settings, autoApplyThreshold: parseInt(e.target.value) };
                    setSettings(next);
                  }}
                  onMouseUp={() => handleSaveSettings(settings)}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Jobs scoring above this threshold will be autonomously submitted without waiting for manual confirmation.
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-zinc-300 mb-2">
                  <span>Manual Review Cutoff</span>
                  <span className="font-bold text-amber-400">{settings.reviewThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="85"
                  value={settings.reviewThreshold}
                  onChange={(e) => {
                    const next = { ...settings, reviewThreshold: parseInt(e.target.value) };
                    setSettings(next);
                  }}
                  onMouseUp={() => handleSaveSettings(settings)}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Jobs scoring between {settings.reviewThreshold}% and {settings.autoApplyThreshold}% are queued in the Review Pipeline.
                </p>
              </div>
            </div>
          </div>

          {/* Submission Audit Log */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-semibold text-white">Recent Auto-Submissions</h2>
              </div>
              <span className="text-xs text-zinc-400">{submissions.length} records</span>
            </div>

            {submissions.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs">
                No automated submissions recorded yet. Once the orchestrator runs, live receipts and screenshots will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                      <th className="pb-3">Role & Company</th>
                      <th className="pb-3">Platform</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-zinc-800/30">
                        <td className="py-3 font-medium text-white">
                          <div>{sub.jobTitle}</div>
                          <div className="text-[11px] text-zinc-400">{sub.company}</div>
                        </td>
                        <td className="py-3 text-zinc-400">{sub.platform}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              sub.status === "SUBMITTED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : sub.status === "DRY_RUN"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-500 text-[11px]">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Readiness Checklist & Profile Details */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Candidate Profile Readiness
            </h3>

            {readiness.missingFields.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-amber-400/90 leading-relaxed">
                  Fill in these details in your profile to ensure 100% error-free form completion:
                </p>
                <div className="space-y-1.5">
                  {readiness.missingFields.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-zinc-400">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>{field}</span>
                    </div>
                  ))}
                </div>
                <a
                  href="/profile"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  Update Profile Details <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <div className="text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Profile is 100% complete and calibrated for auto-submission.
              </div>
            )}
          </div>

          {/* Anti-Detection Features Info */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Anti-Detection Active
            </h3>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Bézier curve mouse trajectory simulation
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Human-paced typing cadence (40-120ms jitter)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Randomized delays & cooldown periods
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Audit screenshot saved on every submission
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
