import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ResumesClient } from "./resumes-client";

export default async function ResumesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const baseResumes = await prisma.baseResume.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return <ResumesClient baseResumes={baseResumes} />;
}
