import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { JobsListClient } from "./jobs-list-client";

export default async function JobsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const jobs = await prisma.job.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      analysis: true,
      application: true,
    },
  });

  return <JobsListClient jobs={jobs} />;
}
