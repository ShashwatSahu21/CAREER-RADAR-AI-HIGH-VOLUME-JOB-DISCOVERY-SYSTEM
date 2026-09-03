import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PortfolioSyncClient } from "./portfolio-sync-client";

export default async function PortfolioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [queueItems, syncHistory] = await Promise.all([
    prisma.verificationQueue.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.portfolioSync.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return <PortfolioSyncClient queueItems={queueItems} syncHistory={syncHistory} />;
}
