import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { History, ExternalLink, Send, FileCheck } from "lucide-react";
import { formatRelativeTime, getStatusColor } from "@/lib/utils";

export default async function ApplicationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const applications = await prisma.application.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    include: {
      job: true,
      documents: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Application History Database
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
          Track application status across all active and submitted job packages
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="empty-state card">
          <History className="w-12 h-12 text-zinc-600 opacity-60" />
          <p className="text-sm font-medium mt-2">No applications tracked yet</p>
          <p className="text-xs text-zinc-500 mt-1">
            Jobs move here automatically when an application package is generated.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Job Title & Company</th>
                <th>Status</th>
                <th>Documents Ready</th>
                <th>Last Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div>
                      <Link href={`/jobs/${app.jobId}`} className="text-xs font-semibold text-white hover:text-blue-400">
                        {app.job.title}
                      </Link>
                      <div className="text-[11px] text-zinc-400">{app.job.company} • {app.job.location || "Remote"}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getStatusColor(app.status)}`}>
                      {app.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-zinc-300 font-mono">
                      {app.documents.length} File(s)
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {formatRelativeTime(app.updatedAt)}
                    </span>
                  </td>
                  <td>
                    <Link href={`/jobs/${app.jobId}`} className="btn btn-ghost btn-sm">
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Package
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
