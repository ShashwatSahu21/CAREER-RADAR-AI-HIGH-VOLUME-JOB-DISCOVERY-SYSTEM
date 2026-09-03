import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

export function getMatchColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 55) return "text-amber-400";
  return "text-zinc-500";
}

export function getMatchBgColor(score: number): string {
  if (score >= 85) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 70) return "bg-blue-500/10 border-blue-500/20";
  if (score >= 55) return "bg-amber-500/10 border-amber-500/20";
  return "bg-zinc-500/10 border-zinc-500/20";
}

export function getRecommendation(score: number): string {
  if (score >= 85) return "HIGH PRIORITY";
  if (score >= 70) return "STRONG MATCH";
  if (score >= 55) return "STRETCH";
  return "LOW PRIORITY";
}

export function getRecommendationColor(rec: string): string {
  switch (rec) {
    case "HIGH_PRIORITY":
    case "HIGH PRIORITY":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "STRONG_MATCH":
    case "STRONG MATCH":
      return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    case "STRETCH":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    default:
      return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "DISCOVERED":
      return "text-zinc-400 bg-zinc-500/10";
    case "ANALYZED":
      return "text-blue-400 bg-blue-500/10";
    case "HIGH_PRIORITY":
      return "text-emerald-400 bg-emerald-500/10";
    case "PACKAGE_GENERATED":
      return "text-purple-400 bg-purple-500/10";
    case "AWAITING_REVIEW":
      return "text-amber-400 bg-amber-500/10";
    case "APPROVED":
      return "text-emerald-400 bg-emerald-500/10";
    case "APPLIED":
      return "text-cyan-400 bg-cyan-500/10";
    case "INTERVIEW":
      return "text-violet-400 bg-violet-500/10";
    case "OFFER":
      return "text-green-400 bg-green-500/10";
    case "REJECTED":
      return "text-red-400 bg-red-500/10";
    case "SKIPPED":
      return "text-zinc-500 bg-zinc-500/10";
    default:
      return "text-zinc-400 bg-zinc-500/10";
  }
}

export function parseJsonField<T>(field: string, fallback: T): T {
  if (!field) return fallback;
  try {
    return JSON.parse(field) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJsonField<T>(data: T): string {
  return JSON.stringify(data);
}
