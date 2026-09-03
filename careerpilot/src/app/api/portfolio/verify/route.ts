import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { itemId, action } = await req.json();

    const item = await prisma.verificationQueue.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (action === "REJECT") {
      await prisma.verificationQueue.update({
        where: { id: itemId },
        data: { status: "REJECTED", reviewedAt: new Date() },
      });
      return NextResponse.json({ success: true, action: "REJECTED" });
    }

    // Approve & Merge into Master Career Database
    const profile = await prisma.careerProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Career Profile missing" }, { status: 400 });
    }

    const data = JSON.parse(item.itemData);

    if (item.itemType === "project") {
      const createdProj = await prisma.project.create({
        data: {
          profileId: profile.id,
          projectName: data.projectName || "Portfolio Project",
          description: data.description || "",
          technologies: JSON.stringify(data.technologies || []),
          githubUrl: data.githubUrl || "",
          demoUrl: data.demoUrl || "",
        },
      });

      if (data.bullets?.length) {
        await prisma.projectBullet.createMany({
          data: data.bullets.map((b: string, i: number) => ({
            projectId: createdProj.id,
            content: b,
            isVerified: true,
            sortOrder: i,
          })),
        });
      }
    } else if (item.itemType === "experience") {
      const createdExp = await prisma.experience.create({
        data: {
          profileId: profile.id,
          company: data.company || "Portfolio Company",
          role: data.role || "Role",
          startDate: data.period ? data.period.split("-")[0]?.trim() || "" : "",
          endDate: data.period ? data.period.split("-")[1]?.trim() || "Present" : "Present",
          description: data.description || "",
        },
      });

      if (data.description) {
        await prisma.experienceBullet.create({
          data: {
            experienceId: createdExp.id,
            content: data.description,
            isVerified: true,
            sortOrder: 0,
          },
        });
      }
    } else if (item.itemType === "skill") {
      await prisma.skill.upsert({
        where: { profileId_name: { profileId: profile.id, name: data.name } },
        update: { category: data.category || "General", evidenceLevel: "portfolio" },
        create: {
          profileId: profile.id,
          name: data.name,
          category: data.category || "General",
          evidenceLevel: "portfolio",
        },
      });
    }

    await prisma.verificationQueue.update({
      where: { id: itemId },
      data: { status: "APPROVED", reviewedAt: new Date() },
    });

    return NextResponse.json({ success: true, action: "APPROVED" });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json({ error: "Failed to verify item" }, { status: 500 });
  }
}
