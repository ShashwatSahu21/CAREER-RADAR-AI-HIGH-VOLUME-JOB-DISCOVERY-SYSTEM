import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { personal, educations, experiences, projects, skills, achievements } = await req.json();

    // Upsert career profile with personal info
    const profile = await prisma.careerProfile.upsert({
      where: { userId: session.userId },
      update: { ...personal },
      create: { userId: session.userId, ...personal },
    });

    // ─── Education ───
    // Delete existing, recreate
    await prisma.education.deleteMany({ where: { profileId: profile.id } });
    if (educations?.length) {
      await prisma.education.createMany({
        data: educations.map((e: any) => ({
          profileId: profile.id,
          degree: e.degree || "",
          specialization: e.specialization || "",
          university: e.university || "",
          graduationDate: e.graduationDate || "",
          cgpa: e.cgpa || "",
          coursework: e.coursework || "",
        })),
      });
    }

    // ─── Experience ───
    await prisma.experienceBullet.deleteMany({
      where: { experience: { profileId: profile.id } },
    });
    await prisma.experience.deleteMany({ where: { profileId: profile.id } });
    if (experiences?.length) {
      for (const exp of experiences) {
        const created = await prisma.experience.create({
          data: {
            profileId: profile.id,
            company: exp.company || "",
            role: exp.role || "",
            startDate: exp.startDate || "",
            endDate: exp.endDate || "Present",
            location: exp.location || "",
            employmentType: exp.employmentType || "",
            description: exp.description || "",
            technologies: exp.technologies || "[]",
            skills: exp.skills || "[]",
            domains: exp.domains || "[]",
            metrics: exp.metrics || "[]",
            links: exp.links || "[]",
          },
        });

        // Create bullets
        if (exp.bullets?.length) {
          await prisma.experienceBullet.createMany({
            data: exp.bullets.map((b: any, i: number) => ({
              experienceId: created.id,
              content: b.content || "",
              isVerified: b.isVerified !== false,
              sortOrder: i,
            })),
          });
        }
      }
    }

    // ─── Projects ───
    await prisma.projectBullet.deleteMany({
      where: { project: { profileId: profile.id } },
    });
    await prisma.project.deleteMany({ where: { profileId: profile.id } });
    if (projects?.length) {
      for (const proj of projects) {
        const created = await prisma.project.create({
          data: {
            profileId: profile.id,
            projectName: proj.projectName || "",
            description: proj.description || "",
            problemStatement: proj.problemStatement || "",
            solution: proj.solution || "",
            technologies: proj.technologies || "[]",
            skills: proj.skills || "[]",
            domains: proj.domains || "[]",
            metrics: proj.metrics || "[]",
            githubUrl: proj.githubUrl || "",
            demoUrl: proj.demoUrl || "",
            portfolioUrl: proj.portfolioUrl || "",
          },
        });

        // Create bullets
        if (proj.bullets?.length) {
          await prisma.projectBullet.createMany({
            data: proj.bullets.map((b: any, i: number) => ({
              projectId: created.id,
              content: b.content || "",
              isVerified: b.isVerified !== false,
              sortOrder: i,
            })),
          });
        }
      }
    }

    // ─── Skills ───
    await prisma.skill.deleteMany({ where: { profileId: profile.id } });
    if (skills?.length) {
      const skillData = skills
        .filter((s: any) => s.name?.trim())
        .map((s: any) => ({
          profileId: profile.id,
          name: s.name.trim(),
          category: s.category || "",
          evidenceLevel: s.evidenceLevel || "verified",
          relatedProjects: s.relatedProjects || "",
          relatedExperience: s.relatedExperience || "",
        }));
      
      if (skillData.length) {
        await prisma.skill.createMany({ data: skillData });
      }
    }

    // ─── Achievements ───
    await prisma.achievement.deleteMany({ where: { profileId: profile.id } });
    if (achievements?.length) {
      await prisma.achievement.createMany({
        data: achievements.map((a: any) => ({
          profileId: profile.id,
          title: a.title || "",
          category: a.category || "",
          organization: a.organization || "",
          date: a.date || "",
          description: a.description || "",
          link: a.link || "",
        })),
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "profile_updated",
        entity: "career_profile",
        entityId: profile.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.careerProfile.findUnique({
    where: { userId: session.userId },
    include: {
      education: true,
      experiences: { include: { bullets: { orderBy: { sortOrder: "asc" } } } },
      projects: { include: { bullets: { orderBy: { sortOrder: "asc" } } } },
      skills: true,
      achievements: true,
      links: true,
    },
  });

  return NextResponse.json(profile);
}
