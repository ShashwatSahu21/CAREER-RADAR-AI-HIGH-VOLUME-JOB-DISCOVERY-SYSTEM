import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const profile = await prisma.careerProfile.findUnique({
    where: { userId: session.userId },
    include: {
      education: { orderBy: { createdAt: "desc" } },
      experiences: {
        orderBy: { startDate: "desc" },
        include: { bullets: { orderBy: { sortOrder: "asc" } } },
      },
      projects: {
        orderBy: { createdAt: "desc" },
        include: { bullets: { orderBy: { sortOrder: "asc" } } },
      },
      skills: { orderBy: { category: "asc" } },
      achievements: { orderBy: { createdAt: "desc" } },
      links: true,
    },
  });

  return <ProfileClient profile={profile} userId={session.userId} />;
}
