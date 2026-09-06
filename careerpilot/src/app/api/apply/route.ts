import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/apply
 * 
 * Returns AutoApply status, analytics, recent submissions, and configuration.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch user settings
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.userId },
    });

    // 2. Fetch candidate profile for completeness check
    const profile = await prisma.careerProfile.findUnique({
      where: { userId: session.userId },
      include: {
        education: true,
        experiences: true,
        skills: true,
        standardAnswers: true,
      },
    });

    // 3. Fetch submissions history
    const submissions = await prisma.applicationSubmission.findMany({
      orderBy: { attemptedAt: "desc" },
      take: 50,
      include: {
        application: {
          include: {
            job: true,
          },
        },
      },
    });

    // 4. Calculate Stats
    const totalSubmissions = submissions.length;
    const submittedCount = submissions.filter((s: any) => s.status === "SUBMITTED").length;
    const failedCount = submissions.filter((s: any) => s.status === "FAILED").length;
    const reviewCount = submissions.filter((s: any) => s.status === "NEEDS_REVIEW").length;

    // Platform breakdown
    const platformStats: Record<string, number> = {
      greenhouse: 0,
      lever: 0,
      ashby: 0,
      linkedin: 0,
      naukri: 0,
      workday: 0,
      other: 0,
    };

    submissions.forEach((s: any) => {
      const plat = s.platform?.toLowerCase() || "other";
      if (plat.includes("greenhouse")) platformStats.greenhouse++;
      else if (plat.includes("lever")) platformStats.lever++;
      else if (plat.includes("ashby")) platformStats.ashby++;
      else if (plat.includes("linkedin")) platformStats.linkedin++;
      else if (plat.includes("naukri")) platformStats.naukri++;
      else if (plat.includes("workday")) platformStats.workday++;
      else platformStats.other++;
    });

    // Profile readiness assessment
    const missingProfileFields: string[] = [];
    if (!profile?.phone) missingProfileFields.push("Phone Number");
    if (!profile?.location) missingProfileFields.push("Location / City");
    if (!profile?.noticePeriod) missingProfileFields.push("Notice Period");
    if (!profile?.expectedCTC) missingProfileFields.push("Expected CTC");
    if (!profile?.education || profile.education.length === 0) missingProfileFields.push("Education Details");
    if (!profile?.skills || profile.skills.length === 0) missingProfileFields.push("Skills List");

    const readinessScore = Math.max(
      0,
      100 - missingProfileFields.length * 15
    );

    return NextResponse.json({
      settings: {
        autoApplyEnabled: settings?.autoApplyEnabled ?? false,
        autoApplyThreshold: settings?.autoApplyThreshold ?? 85,
        reviewThreshold: 70,
        dailyLimit: settings?.dailyApplicationLimit ?? 50,
        greenhouseEnabled: settings?.enableGreenhouseApi ?? true,
        leverEnabled: settings?.enableLeverApi ?? true,
        ashbyEnabled: settings?.enableAshbyApi ?? true,
        linkedinEnabled: settings?.enableLinkedIn ?? true,
        naukriEnabled: settings?.enableNaukri ?? true,
        workdayEnabled: settings?.enableWorkday ?? true,
        delayMin: settings?.applicationDelayMin ?? 5,
        delayMax: settings?.applicationDelayMax ?? 15,
      },
      stats: {
        totalSubmissions,
        submittedCount,
        failedCount,
        reviewCount,
        successRate: totalSubmissions > 0 ? Math.round((submittedCount / totalSubmissions) * 100) : 0,
        platformStats,
      },
      readiness: {
        score: readinessScore,
        missingFields: missingProfileFields,
        isReady: missingProfileFields.length <= 1,
      },
      recentSubmissions: submissions.map((s: any) => ({
        id: s.id,
        jobTitle: s.application?.job?.title || "Unknown Job",
        company: s.application?.job?.company || "Unknown Company",
        platform: s.platform,
        status: s.status,
        submissionMethod: s.submissionMethod,
        confirmationId: s.confirmationId,
        errorMessage: s.errorMessage,
        screenshotPath: s.screenshotPath,
        submittedAt: s.attemptedAt,
      })),
    });
  } catch (error) {
    console.error("Error in /api/apply:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/apply
 * 
 * Update AutoApply configurations or trigger actions.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, settings } = body;

    if (action === "update_settings" && settings) {
      const updated = await prisma.userSettings.upsert({
        where: { userId: session.userId },
        update: {
          autoApplyEnabled: settings.autoApplyEnabled,
          autoApplyThreshold: settings.autoApplyThreshold,
          dailyApplicationLimit: settings.dailyLimit,
          enableGreenhouseApi: settings.greenhouseEnabled,
          enableLeverApi: settings.leverEnabled,
          enableAshbyApi: settings.ashbyEnabled,
          enableLinkedIn: settings.linkedinEnabled,
          enableNaukri: settings.naukriEnabled,
          enableWorkday: settings.workdayEnabled,
          applicationDelayMin: settings.delayMin,
          applicationDelayMax: settings.delayMax,
        },
        create: {
          userId: session.userId,
          autoApplyEnabled: settings.autoApplyEnabled ?? false,
          autoApplyThreshold: settings.autoApplyThreshold ?? 85,
          dailyApplicationLimit: settings.dailyLimit ?? 50,
        },
      });

      return NextResponse.json({ success: true, settings: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating apply settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
