"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building,
  MapPin,
  ExternalLink,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Mail,
  Loader2,
  RefreshCw,
  Send,
  Check,
  Ban,
  FileCode,
  ShieldCheck,
  Tag,
} from "lucide-react";
import {
  formatRelativeTime,
  getMatchColor,
  getStatusColor,
  getRecommendation,
  getRecommendationColor,
  parseJsonField,
} from "@/lib/utils";

interface JobDetailProps {
  job: any;
}

export function JobDetailClient({ job }: JobDetailProps) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  const analysis = job.analysis;
  const keywords = job.keywords || [];
  const resumeVersions = job.resumeVersions || [];
  const coverLetters = job.coverLetters || [];
  const application = job.application;

  const requiredSkills = parseJsonField<string[]>(analysis?.requiredSkills, []);
  const preferredSkills = parseJsonField<string[]>(analysis?.preferredSkills, []);
  const technologies = parseJsonField<string[]>(analysis?.technologies, []);
  const strengths = parseJsonField<string[]>(analysis?.strengths, []);
  const gaps = parseJsonField<string[]>(analysis?.gaps, []);
  const missingKeywords = parseJsonField<string[]>(analysis?.missingKeywords, []);

  async function triggerAnalysis() {
    setAnalyzing(true);
    setMessage("");
    try {
      const res = await fetch(`/api/jobs/${job.id}/analyze`, { method: "POST" });
      if (res.ok) {
        setMessage("AI Analysis completed successfully");
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(`Analysis failed: ${data.error || "Unknown error"}`);
      }
    } catch {
      setMessage("Failed to connect to analysis engine");
    } finally {
      setAnalyzing(false);
    }
  }

  async function triggerPackageGeneration() {
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch(`/api/jobs/${job.id}/generate-package`, { method: "POST" });
      if (res.ok) {
        setMessage("Application package generated successfully");
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(`Package generation failed: ${data.error || "Unknown error"}`);
      }
    } catch {
      setMessage("Failed to connect to package generator");
    } finally {
      setGenerating(false);
    }
  }

  async function updateStatus(newStatus: string) {
    try {
      const res = await fetch(`/api/jobs/${job.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      setMessage("Failed to update status");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header / Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/jobs" className="btn btn-ghost btn-sm">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {job.title}
              </h1>
              <span className={`badge ${getStatusColor(job.status)}`}>
                {job.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs mt-1" style={{ color: "oklch(0.55 0.01 260)" }}>
              <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5" />{job.company}</span>
              {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
              <span className="text-zinc-600">•</span>
              <span>Source: <strong className="capitalize text-zinc-400">{job.source}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {job.applicationUrl && (
            <a
              href={job.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Apply Portal
            </a>
          )}

          <button
            onClick={triggerAnalysis}
            disabled={analyzing}
            className="btn btn-secondary btn-sm"
          >
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {analysis ? "Re-Analyze" : "Run AI Analysis"}
          </button>

          <button
            onClick={triggerPackageGeneration}
            disabled={generating || !analysis}
            className="btn btn-primary btn-sm"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Generate Package
          </button>
        </div>
      </div>

      {message && <div className="toast">{message}</div>}

      {/* Main Grid: 2 columns (Left: AI Analysis & Strategy, Right: Documents & Workflow) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="col-span-8 space-y-6">
          {/* Match Score Banner */}
          {analysis ? (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center ${getMatchColor(analysis.overallMatchScore)} border border-current/20 bg-zinc-900/60`}>
                    <span className="text-2xl font-black tabular-nums">{analysis.overallMatchScore}%</span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold opacity-80">Match</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${getRecommendationColor(getRecommendation(analysis.overallMatchScore))}`}>
                        {getRecommendation(analysis.overallMatchScore)}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">
                        Track: <strong className="text-white">{analysis.primaryRole.replace(/_/g, " ")}</strong> ({(analysis.primaryConfidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                      {analysis.roleSummary || "AI analysis completed. Base resume router selected target track."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Match Score Breakdown */}
              <div className="grid grid-cols-6 gap-2 pt-3 border-t border-zinc-800/80 text-center">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Skill (30%)</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{analysis.skillMatch}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Exp (25%)</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{analysis.experienceMatch}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Project (20%)</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{analysis.projectMatch}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Tech (10%)</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{analysis.technologyMatch}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Seniority (10%)</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{analysis.seniorityMatch}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Location (5%)</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{analysis.locationMatch}%</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center space-y-3">
              <Zap className="w-8 h-8 text-blue-400 mx-auto opacity-60" />
              <h3 className="text-sm font-semibold text-white">AI Job Analysis Pending</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Run the AI Job Analysis Engine to extract role classification, required skills, ATS keywords, and match scoring against your Master Career Database.
              </p>
              <button onClick={triggerAnalysis} disabled={analyzing} className="btn btn-primary btn-sm mx-auto">
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Run AI Analysis Now
              </button>
            </div>
          )}

          {/* ATS Keyword Comparison */}
          {keywords.length > 0 && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ATS Keyword Evidence Verification
                </h3>
                <span className="text-xs text-zinc-500">
                  Supported: <strong className="text-emerald-400">{keywords.filter((k: any) => k.isSupported).length}</strong> / {keywords.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw: any) => (
                  <span
                    key={kw.id}
                    className={`badge text-[10px] ${
                      kw.isSupported
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                        : "bg-red-500/10 border-red-500/20 text-red-400 line-through opacity-70"
                    }`}
                    title={kw.isSupported ? `Verified by evidence: ${kw.supportSource}` : "Unsupported by verified database"}
                  >
                    {kw.isSupported ? <Check className="w-2.5 h-2.5 mr-0.5 inline" /> : <XCircle className="w-2.5 h-2.5 mr-0.5 inline" />}
                    {kw.keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Job Description details */}
          <div className="card p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Raw Job Description
            </h3>
            <div className="text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap max-h-96 overflow-y-auto p-3 bg-zinc-950/60 rounded-lg border border-zinc-800">
              {job.description || "No job description provided."}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) — Application Package & Documents */}
        <div className="col-span-4 space-y-6">
          {/* Status & Review Controller */}
          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Application Workflow Status
            </h3>
            <div className="space-y-2">
              <span className={`badge w-full justify-center py-1.5 text-xs ${getStatusColor(job.status)}`}>
                {job.status.replace(/_/g, " ")}
              </span>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => updateStatus("APPROVED")}
                  className="btn btn-secondary btn-sm text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve Package
                </button>
                <button
                  onClick={() => updateStatus("SKIPPED")}
                  className="btn btn-secondary btn-sm text-zinc-400 hover:bg-zinc-800"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Skip Role
                </button>
              </div>
            </div>
          </div>

          {/* Generated Documents */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Generated Package
              </h3>
              {resumeVersions.length > 0 && (
                <span className="text-[10px] text-zinc-500">
                  {resumeVersions.length} Resume Version(s)
                </span>
              )}
            </div>

            {resumeVersions.length === 0 && coverLetters.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg">
                <FileCode className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-zinc-400">No application package generated yet.</p>
                <button
                  onClick={triggerPackageGeneration}
                  disabled={generating || !analysis}
                  className="btn btn-primary btn-sm mt-3"
                >
                  Generate Package Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Resume Files */}
                {resumeVersions[0] && (
                  <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                        Tailored Resume v{resumeVersions[0].versionNumber}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Truth: {resumeVersions[0].truthfulnessScore}%
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {resumeVersions[0].docxPath && (
                        <a
                          href={`/api/documents/download?path=${encodeURIComponent(resumeVersions[0].docxPath)}`}
                          className="btn btn-secondary btn-sm text-[11px] py-1 px-2 flex-1 justify-center"
                        >
                          Download DOCX
                        </a>
                      )}
                      {resumeVersions[0].pdfPath && (
                        <a
                          href={`/api/documents/download?path=${encodeURIComponent(resumeVersions[0].pdfPath)}`}
                          className="btn btn-primary btn-sm text-[11px] py-1 px-2 flex-1 justify-center"
                        >
                          Download PDF
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Cover Letter Files */}
                {coverLetters[0] && (
                  <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-purple-400" />
                        Cover / Intent Letter v{coverLetters[0].versionNumber}
                      </span>
                      <span className="text-[10px] text-purple-400 font-mono capitalize">
                        {coverLetters[0].letterType.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {coverLetters[0].docxPath && (
                        <a
                          href={`/api/documents/download?path=${encodeURIComponent(coverLetters[0].docxPath)}`}
                          className="btn btn-secondary btn-sm text-[11px] py-1 px-2 flex-1 justify-center"
                        >
                          Download DOCX
                        </a>
                      )}
                      {coverLetters[0].pdfPath && (
                        <a
                          href={`/api/documents/download?path=${encodeURIComponent(coverLetters[0].pdfPath)}`}
                          className="btn btn-primary btn-sm text-[11px] py-1 px-2 flex-1 justify-center"
                        >
                          Download PDF
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
