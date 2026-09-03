import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Download, ExternalLink, ShieldCheck, Check } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export default async function VersionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const versions = await prisma.resumeVersion.findMany({
    orderBy: { createdAt: "desc" },
    include: { job: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Resume Version Control
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
          Every generated resume is stored, versioned, and audit-logged for full truthfulness traceability
        </p>
      </div>

      {versions.length === 0 ? (
        <div className="empty-state card">
          <FileText className="w-12 h-12 text-zinc-600 opacity-60" />
          <p className="text-sm font-medium mt-2">No generated versions yet</p>
          <p className="text-xs text-zinc-500 mt-1">
            Generate an application package from any job detail screen to save resume versions.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Version Label</th>
                <th>Target Company & Role</th>
                <th>Truth Score</th>
                <th>ATS Score</th>
                <th>Created</th>
                <th>Downloads</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className="font-mono text-xs text-white">{v.label}</span>
                  </td>
                  <td>
                    <Link href={`/jobs/${v.jobId}`} className="text-xs font-semibold text-blue-400 hover:underline flex items-center gap-1">
                      {v.job.title} at {v.job.company}
                    </Link>
                  </td>
                  <td>
                    <span className="badge bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-[10px]">
                      <ShieldCheck className="w-3 h-3 mr-0.5 inline" />
                      {v.truthfulnessScore}%
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-purple-400">{v.atsRelevanceScore}%</span>
                  </td>
                  <td>
                    <span className="text-xs text-zinc-500 tabular-nums">{formatRelativeTime(v.createdAt)}</span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {v.docxPath && (
                        <a
                          href={`/api/documents/download?path=${encodeURIComponent(v.docxPath)}`}
                          className="btn btn-secondary btn-sm text-[11px] py-1 px-2"
                        >
                          DOCX
                        </a>
                      )}
                      {v.pdfPath && (
                        <a
                          href={`/api/documents/download?path=${encodeURIComponent(v.pdfPath)}`}
                          className="btn btn-primary btn-sm text-[11px] py-1 px-2"
                        >
                          PDF
                        </a>
                      )}
                    </div>
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
