import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { JobDetailClient } from "./job-detail-client";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      analysis: true,
      keywords: true,
      resumeVersions: {
        include: { documents: true },
        orderBy: { createdAt: "desc" },
      },
      coverLetters: {
        include: { documents: true },
        orderBy: { createdAt: "desc" },
      },
      application: {
        include: { documents: true },
      },
    },
  });

  if (!job || job.userId !== session.userId) notFound();

  return <JobDetailClient job={job} />;
}
