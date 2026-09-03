import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

async function getDashboardData(userId: string) {
  const [jobsCount, highMatchCount, packagesCount, appliedCount, recentJobs, profile] =
    await Promise.all([
      prisma.job.count({ where: { userId } }),
      prisma.job.count({ where: { userId, matchScore: { gte: 85 } } }),
      prisma.application.count({
        where: { userId, status: { in: ["PACKAGE_GENERATED", "AWAITING_REVIEW", "APPROVED", "APPLIED"] } },
      }),
      prisma.application.count({ where: { userId, status: "APPLIED" } }),
      prisma.job.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { analysis: true },
      }),
      prisma.careerProfile.findUnique({ where: { userId } }),
    ]);

  const avgScore =
    jobsCount > 0
      ? await prisma.job
          .aggregate({ where: { userId, matchScore: { gt: 0 } }, _avg: { matchScore: true } })
          .then((r) => Math.round(r._avg.matchScore || 0))
      : 0;

  return {
    stats: {
      jobsProcessed: jobsCount,
      highMatch: highMatchCount,
      packagesPrepared: packagesCount,
      applied: appliedCount,
      avgScore,
    },
    recentJobs,
    hasProfile: !!profile,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getDashboardData(session.userId);

  return <DashboardClient data={data} />;
}
