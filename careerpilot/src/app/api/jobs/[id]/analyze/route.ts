import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { CareerPilotOrchestrator } from "@/lib/ai/agents/orchestrator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job || job.userId !== session.userId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const profile = await prisma.careerProfile.findUnique({
      where: { userId: session.userId },
      include: {
        education: true,
        experiences: { include: { bullets: true } },
        projects: { include: { bullets: true } },
        skills: true,
        achievements: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Please complete your Master Career Database profile first." },
        { status: 400 }
      );
    }

    // Get user AI settings
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.userId },
    });

    const orchestrator = new CareerPilotOrchestrator({
      providerName: settings?.aiProvider || "gemini",
      apiKey: settings?.aiApiKey || process.env.AI_API_KEY,
    });

    // Step 1: Run AI Job Analysis
    const result = await orchestrator.runJobAnalysis(
      job.title,
      job.company,
      job.description || job.title,
      job.location,
      profile
    );

    const { parsedJob, classification, matchResult, keywordMappings, routingResult } = result;

    // Upsert JobAnalysis record
    const analysis = await prisma.jobAnalysis.upsert({
      where: { jobId: job.id },
      update: {
        seniorityLevel: parsedJob.seniority_level,
        primaryDomain: parsedJob.primary_domain,
        secondaryDomains: JSON.stringify(parsedJob.secondary_domains),
        industry: parsedJob.industry,
        roleSummary: parsedJob.role_summary,
        primaryRole: classification.primary_role,
        primaryConfidence: classification.confidence,
        secondaryRole: classification.secondary_role,
        secondaryConfidence: classification.secondary_confidence,
        requiredSkills: JSON.stringify(parsedJob.required_skills),
        preferredSkills: JSON.stringify(parsedJob.preferred_skills),
        technologies: JSON.stringify(parsedJob.technologies),
        responsibilities: JSON.stringify(parsedJob.responsibilities),
        qualifications: JSON.stringify(parsedJob.qualifications),
        overallMatchScore: matchResult.overall_match_score,
        skillMatch: matchResult.skill_match,
        experienceMatch: matchResult.experience_match,
        projectMatch: matchResult.project_match,
        technologyMatch: matchResult.technology_match,
        seniorityMatch: matchResult.seniority_match,
        locationMatch: matchResult.location_match,
        strengths: JSON.stringify(matchResult.strengths),
        gaps: JSON.stringify(matchResult.gaps),
        missingKeywords: JSON.stringify(matchResult.missing_keywords),
        selectedBaseResume: routingResult.selected_base_resume,
        resumeReason: routingResult.reasoning,
      },
      create: {
        jobId: job.id,
        seniorityLevel: parsedJob.seniority_level,
        primaryDomain: parsedJob.primary_domain,
        secondaryDomains: JSON.stringify(parsedJob.secondary_domains),
        industry: parsedJob.industry,
        roleSummary: parsedJob.role_summary,
        primaryRole: classification.primary_role,
        primaryConfidence: classification.confidence,
        secondaryRole: classification.secondary_role,
        secondaryConfidence: classification.secondary_confidence,
        requiredSkills: JSON.stringify(parsedJob.required_skills),
        preferredSkills: JSON.stringify(parsedJob.preferred_skills),
        technologies: JSON.stringify(parsedJob.technologies),
        responsibilities: JSON.stringify(parsedJob.responsibilities),
        qualifications: JSON.stringify(parsedJob.qualifications),
        overallMatchScore: matchResult.overall_match_score,
        skillMatch: matchResult.skill_match,
        experienceMatch: matchResult.experience_match,
        projectMatch: matchResult.project_match,
        technologyMatch: matchResult.technology_match,
        seniorityMatch: matchResult.seniority_match,
        locationMatch: matchResult.location_match,
        strengths: JSON.stringify(matchResult.strengths),
        gaps: JSON.stringify(matchResult.gaps),
        missingKeywords: JSON.stringify(matchResult.missing_keywords),
        selectedBaseResume: routingResult.selected_base_resume,
        resumeReason: routingResult.reasoning,
      },
    });

    // Replace Job Keywords
    await prisma.jobKeyword.deleteMany({ where: { jobId: job.id } });
    if (keywordMappings.length > 0) {
      await prisma.jobKeyword.createMany({
        data: keywordMappings.map((km) => ({
          jobId: job.id,
          keyword: km.keyword,
          category: km.category,
          isSupported: km.isSupported,
          supportSource: km.supportSource,
        })),
      });
    }

    // Update main Job model status & match score
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "ANALYZED",
        matchScore: matchResult.overall_match_score,
        recommendation: matchResult.recommendation,
      },
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "job_analyzed",
        entity: "job",
        entityId: job.id,
        details: JSON.stringify({ matchScore: matchResult.overall_match_score, primaryRole: classification.primary_role }),
      },
    });

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error("Job analysis error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Job analysis failed" },
      { status: 500 }
    );
  }
}
