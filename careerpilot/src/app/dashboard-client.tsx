"use client";

import Link from "next/link";
import {
  Briefcase,
  TrendingUp,
  FileCheck,
  Send,
  Target,
  Plus,
  ChevronRight,
  Zap,
  ExternalLink,
  User,
  Globe,
} from "lucide-react";
import { formatRelativeTime, getMatchColor, getStatusColor, getRecommendation } from "@/lib/utils";

interface DashboardData {
  stats: {
    jobsProcessed: number;
    highMatch: number;
    packagesPrepared: number;
    applied: number;
    avgScore: number;
  };
  recentJobs: Array<{
    id: string;
    title: string;
    company: string;
    matchScore: number;
    status: string;
    source: string;
    createdAt: Date;
    analysis: {
      primaryRole: string;
      primaryConfidence: number;
    } | null;
  }>;
  hasProfile: boolean;
}

const statCards = [
  { key: "jobsProcessed", label: "Jobs Processed", icon: Briefcase, color: "text-blue-400" },
  { key: "highMatch", label: "High Match", icon: TrendingUp, color: "text-emerald-400" },
  { key: "packagesPrepared", label: "Packages Ready", icon: FileCheck, color: "text-purple-400" },
  { key: "applied", label: "Applied", icon: Send, color: "text-cyan-400" },
  { key: "avgScore", label: "Avg Match", icon: Target, color: "text-amber-400", suffix: "%" },
];

export function DashboardClient({ data }: { data: DashboardData }) {
  const { stats, recentJobs, hasProfile } = data;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Command Center
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
            AI-powered job application intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/portfolio" className="btn btn-ghost btn-sm">
            <Globe className="w-3.5 h-3.5" />
            Sync Portfolio
          </Link>
          <Link href="/jobs/new" className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
            Add Job
          </Link>
        </div>
      </div>

      {/* Setup Banner — shows if profile is not configured */}
      {!hasProfile && (
        <div
          className="rounded-xl p-4 flex items-center gap-4 border"
          style={{
            background: "linear-gradient(135deg, oklch(0.22 0.05 250), oklch(0.18 0.03 280))",
            borderColor: "oklch(0.35 0.08 250)",
          }}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Complete your Career Profile</p>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.60 0.01 260)" }}>
              Add your experience, projects, and skills to enable AI-powered resume tailoring.
            </p>
          </div>
          <Link href="/profile" className="btn btn-primary btn-sm flex-shrink-0">
            Setup Profile
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = stats[card.key as keyof typeof stats];
          return (
            <div key={card.key} className="stat-card group">
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${card.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "oklch(0.45 0.01 260)" }}>
                  {card.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white tabular-nums">
                  {value}
                </span>
                {card.suffix && (
                  <span className="text-sm" style={{ color: "oklch(0.50 0.01 260)" }}>
                    {card.suffix}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Opportunities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-heading mb-0">Recent Opportunities</h2>
          <Link
            href="/jobs"
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: "oklch(0.55 0.01 260)" }}
          >
            View all
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {recentJobs.length === 0 ? (
          <div className="empty-state card">
            <Briefcase className="w-12 h-12" />
            <p className="text-sm font-medium mt-2">No jobs yet</p>
            <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 260)" }}>
              Add a job manually or set up the Career Radar webhook to start receiving opportunities.
            </p>
            <Link href="/jobs/new" className="btn btn-primary btn-sm mt-4">
              <Plus className="w-3.5 h-3.5" />
              Add First Job
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Match</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Found</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <span className="text-white font-medium">{job.title}</span>
                    </td>
                    <td>{job.company}</td>
                    <td>
                      {job.matchScore > 0 ? (
                        <span className={`font-semibold tabular-nums ${getMatchColor(job.matchScore)}`}>
                          {job.matchScore}%
                        </span>
                      ) : (
                        <span style={{ color: "oklch(0.40 0.01 260)" }}>—</span>
                      )}
                    </td>
                    <td>
                      {job.analysis?.primaryRole ? (
                        <span className="badge bg-zinc-800 border-zinc-700 text-zinc-300">
                          {job.analysis.primaryRole.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span style={{ color: "oklch(0.40 0.01 260)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="text-xs capitalize">{job.source || "—"}</span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusColor(job.status)}`}>
                        {job.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs tabular-nums" style={{ color: "oklch(0.50 0.01 260)" }}>
                        {formatRelativeTime(job.createdAt)}
                      </span>
                    </td>
                    <td>
                      <Link href={`/jobs/${job.id}`} className="btn btn-ghost btn-sm">
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/profile"
          className="card p-4 flex items-center gap-3 hover:border-blue-500/30 transition-colors group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
            <User className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Career Profile</p>
            <p className="text-xs" style={{ color: "oklch(0.50 0.01 260)" }}>
              Manage experience & skills
            </p>
          </div>
        </Link>

        <Link
          href="/resumes"
          className="card p-4 flex items-center gap-3 hover:border-purple-500/30 transition-colors group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/20 transition-colors">
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Base Resumes</p>
            <p className="text-xs" style={{ color: "oklch(0.50 0.01 260)" }}>
              Upload & manage templates
            </p>
          </div>
        </Link>

        <Link
          href="/settings"
          className="card p-4 flex items-center gap-3 hover:border-amber-500/30 transition-colors group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">AI Settings</p>
            <p className="text-xs" style={{ color: "oklch(0.50 0.01 260)" }}>
              Configure AI & thresholds
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
