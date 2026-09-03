"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  Link as LinkIcon,
  ClipboardPaste,
  Zap,
} from "lucide-react";
import Link from "next/link";

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    employmentType: "",
    description: "",
    applicationUrl: "",
    source: "manual",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.company) {
      setError("Job title and company are required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/jobs/${data.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create job");
      }
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  }

  async function handleAnalyzeAndAdd() {
    if (!form.description && !form.title) {
      setError("Paste a job description or fill in the title to proceed.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, autoAnalyze: true }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/jobs/${data.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create job");
      }
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/jobs" className="btn btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Add Job Opportunity
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
            Paste job details for AI analysis and resume tailoring
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quick paste area */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardPaste className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-medium text-white">Job Description</h2>
          </div>
          <textarea
            className="textarea !min-h-[200px] font-mono text-xs leading-relaxed"
            placeholder="Paste the full job description here. The AI will extract all relevant information automatically..."
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        {/* Structured fields */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-medium text-white">Job Details</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Job Title *</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Robotics Software Engineer"
              />
            </div>
            <div>
              <label className="label">Company *</label>
              <input
                className="input"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="Tesla"
              />
            </div>
            <div>
              <label className="label">Location</label>
              <input
                className="input"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="Bangalore, India / Remote"
              />
            </div>
            <div>
              <label className="label">Employment Type</label>
              <select
                className="input"
                value={form.employmentType}
                onChange={(e) => update("employmentType", e.target.value)}
              >
                <option value="">Select...</option>
                <option value="full-time">Full-time</option>
                <option value="internship">Internship</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">
              <LinkIcon className="w-3 h-3 inline mr-1" />
              Application URL
            </label>
            <input
              className="input"
              type="url"
              value={form.applicationUrl}
              onChange={(e) => update("applicationUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="label">Source</label>
            <select
              className="input !w-auto"
              value={form.source}
              onChange={(e) => update("source", e.target.value)}
            >
              <option value="manual">Manual</option>
              <option value="linkedin">LinkedIn</option>
              <option value="naukri">Naukri</option>
              <option value="indeed">Indeed</option>
              <option value="greenhouse">Greenhouse</option>
              <option value="lever">Lever</option>
              <option value="career_radar">Career Radar</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-secondary" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Job
          </button>
          <button
            type="button"
            onClick={handleAnalyzeAndAdd}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Save & Analyze with AI
          </button>
        </div>
      </form>
    </div>
  );
}
