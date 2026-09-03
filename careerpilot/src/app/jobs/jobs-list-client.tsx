"use client";

import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  ExternalLink,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { formatRelativeTime, getMatchColor, getStatusColor, getRecommendation, getRecommendationColor } from "@/lib/utils";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  status: string;
  matchScore: number;
  recommendation: string;
  applicationUrl: string;
  createdAt: Date;
  analysis: {
    primaryRole: string;
    primaryConfidence: number;
    overallMatchScore: number;
  } | null;
  application: {
    status: string;
  } | null;
}

export function JobsListClient({ jobs }: { jobs: Job[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = jobs.filter((job) => {
    const matchesSearch =
      !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.company.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ["ALL", "DISCOVERED", "ANALYZED", "HIGH_PRIORITY", "PACKAGE_GENERATED", "AWAITING_REVIEW", "APPROVED", "APPLIED", "SKIPPED"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Job Opportunities
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
            {jobs.length} total opportunities tracked
          </p>
        </div>
        <Link href="/jobs/new" className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Add Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            className="input !pl-9"
            placeholder="Search by title or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-zinc-500" />
          <select
            className="input !w-auto text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All Statuses" : s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Job List */}
      {filtered.length === 0 ? (
        <div className="empty-state card">
          <Briefcase className="w-12 h-12" />
          <p className="text-sm font-medium mt-2">
            {jobs.length === 0 ? "No jobs yet" : "No matching jobs"}
          </p>
          <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 260)" }}>
            {jobs.length === 0
              ? "Add a job manually or set up the Career Radar webhook."
              : "Try adjusting your search or filter."}
          </p>
          {jobs.length === 0 && (
            <Link href="/jobs/new" className="btn btn-primary btn-sm mt-4">
              <Plus className="w-3.5 h-3.5" />
              Add First Job
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="card p-4 flex items-center gap-4 group"
            >
              {/* Match score circle */}
              <div className="flex-shrink-0">
                {job.matchScore > 0 ? (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getMatchColor(job.matchScore)} font-bold text-lg tabular-nums`}
                    style={{ background: "var(--color-surface-0)" }}>
                    {job.matchScore}
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-zinc-600"
                    style={{ background: "var(--color-surface-0)" }}>
                    —
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {job.title}
                  </span>
                  {job.recommendation && (
                    <span className={`badge text-[9px] ${getRecommendationColor(job.recommendation)}`}>
                      {job.recommendation.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: "oklch(0.60 0.01 260)" }}>
                    {job.company}
                  </span>
                  {job.location && (
                    <>
                      <span className="text-zinc-700">•</span>
                      <span className="text-xs" style={{ color: "oklch(0.50 0.01 260)" }}>
                        {job.location}
                      </span>
                    </>
                  )}
                  {job.analysis?.primaryRole && (
                    <>
                      <span className="text-zinc-700">•</span>
                      <span className="badge bg-zinc-800/50 border-zinc-700/50 text-zinc-400 text-[9px]">
                        {job.analysis.primaryRole.replace(/_/g, " ")}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`badge ${getStatusColor(job.status)}`}>
                  {job.status.replace(/_/g, " ")}
                </span>
                <span className="text-xs tabular-nums" style={{ color: "oklch(0.45 0.01 260)" }}>
                  {formatRelativeTime(job.createdAt)}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
