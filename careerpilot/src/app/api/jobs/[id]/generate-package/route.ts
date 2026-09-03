import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { CareerPilotOrchestrator } from "@/lib/ai/agents/orchestrator";
import { DOCXResumeGenerator } from "@/lib/docgen/docx-resume";
import { DOCXCoverLetterGenerator } from "@/lib/docgen/docx-cover-letter";
import { PDFResumeGenerator } from "@/lib/docgen/pdf-resume";
import { PDFCoverLetterGenerator } from "@/lib/docgen/pdf-cover-letter";
import { PDFConverter } from "@/lib/docgen/pdf-converter";
import * as path from "path";

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
      include: { analysis: true, keywords: true },
    });

    if (!job || job.userId !== session.userId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.analysis) {
      return NextResponse.json(
        { error: "Please run AI Job Analysis first before generating package." },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Career Profile missing." }, { status: 400 });
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.userId },
    });

    const orchestrator = new CareerPilotOrchestrator({
      providerName: settings?.aiProvider || "gemini",
      apiKey: settings?.aiApiKey || process.env.AI_API_KEY,
    });

    const supportedKeywords = job.keywords
      .filter((k) => k.isSupported)
      .map((k) => k.keyword);

    const parsedJob = {
      job_title: job.title,
      company: job.company,
      primary_domain: job.analysis.primaryDomain,
      technologies: typeof job.analysis.technologies === "string" ? JSON.parse(job.analysis.technologies || "[]") : [],
      required_skills: typeof job.analysis.requiredSkills === "string" ? JSON.parse(job.analysis.requiredSkills || "[]") : [],
      role_summary: job.analysis.roleSummary,
    };

    const classification = {
      primary_role: job.analysis.primaryRole,
      confidence: job.analysis.primaryConfidence,
      career_track: job.analysis.primaryRole.startsWith("ROBOTICS") ? "ROBOTICS" : job.analysis.primaryRole.includes("PRODUCT") ? "PRODUCT" : "SOFTWARE",
    };

    const routingResult = {
      selected_base_resume: job.analysis.selectedBaseResume,
      reasoning: job.analysis.resumeReason,
      suggested_layout: "PROJECT_FIRST",
    };

    // Run Agents 5-10
    const packageResult = await orchestrator.runDocumentGenerationPipeline(
      parsedJob,
      classification,
      routingResult,
      profile,
      supportedKeywords,
      job.analysis.overallMatchScore
    );

    const { tailoredResume, validationReport, qualityReport, coverLetter } = packageResult;

    // Define output storage directory
    const storageDir = path.join(process.cwd(), "storage", "applications", job.id);
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, "_");
    const baseName = `${sanitize(job.company)}_${sanitize(job.title)}`;

    const resumeDocxPath = path.join(storageDir, `${baseName}_Resume.docx`);
    const resumePdfPath = path.join(storageDir, `${baseName}_Resume.pdf`);
    const coverDocxPath = path.join(storageDir, `${baseName}_CoverLetter.docx`);
    const coverPdfPath = path.join(storageDir, `${baseName}_CoverLetter.pdf`);

    // Render DOCX Documents
    await DOCXResumeGenerator.generate(tailoredResume, resumeDocxPath);
    await DOCXCoverLetterGenerator.generate(coverLetter, tailoredResume, coverDocxPath);

    // Generate 100% Native Valid PDF Documents
    await PDFResumeGenerator.generate(tailoredResume, resumePdfPath);
    await PDFCoverLetterGenerator.generate(coverLetter, tailoredResume, coverPdfPath);

    // Store ResumeVersion in DB
    const resumeVersionCount = await prisma.resumeVersion.count({ where: { jobId: job.id } });
    const versionNumber = resumeVersionCount + 1;

    const savedResumeVersion = await prisma.resumeVersion.create({
      data: {
        jobId: job.id,
        versionNumber,
        label: `${baseName}_v${versionNumber}`,
        sections: JSON.stringify(tailoredResume),
        docxPath: resumeDocxPath,
        pdfPath: resumePdfPath,
        truthfulnessScore: qualityReport.truthfulness_score,
        atsRelevanceScore: qualityReport.ats_relevance_score,
        formatScore: qualityReport.format_score,
        clarityScore: qualityReport.clarity_score,
        jobMatchScore: qualityReport.job_match_score,
        overallQualityScore: qualityReport.overall_quality_score,
        validationReport: JSON.stringify(validationReport),
        status: "APPROVED",
      },
    });

    // Store CoverLetter in DB
    const savedCoverLetter = await prisma.coverLetter.create({
      data: {
        jobId: job.id,
        versionNumber,
        letterType: coverLetter.letter_type,
        content: coverLetter.content,
        docxPath: coverDocxPath,
        pdfPath: coverPdfPath,
        status: "APPROVED",
      },
    });

    // Upsert Application Tracking record
    const application = await prisma.application.upsert({
      where: { jobId: job.id },
      update: {
        status: "PACKAGE_GENERATED",
        dateGenerated: new Date(),
      },
      create: {
        jobId: job.id,
        userId: session.userId,
        status: "PACKAGE_GENERATED",
        dateGenerated: new Date(),
      },
    });

    // Save Document References
    await prisma.applicationDocument.createMany({
      data: [
        {
          applicationId: application.id,
          documentType: "resume_docx",
          filePath: resumeDocxPath,
          fileName: `${baseName}_Resume.docx`,
          resumeVersionId: savedResumeVersion.id,
        },
        {
          applicationId: application.id,
          documentType: "resume_pdf",
          filePath: resumePdfPath,
          fileName: `${baseName}_Resume.pdf`,
          resumeVersionId: savedResumeVersion.id,
        },
        {
          applicationId: application.id,
          documentType: "cover_letter_docx",
          filePath: coverDocxPath,
          fileName: `${baseName}_CoverLetter.docx`,
          coverLetterId: savedCoverLetter.id,
        },
        {
          applicationId: application.id,
          documentType: "cover_letter_pdf",
          filePath: coverPdfPath,
          fileName: `${baseName}_CoverLetter.pdf`,
          coverLetterId: savedCoverLetter.id,
        },
      ],
    });

    // Update job status
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "PACKAGE_GENERATED" },
    });

    return NextResponse.json({
      success: true,
      resumeVersionId: savedResumeVersion.id,
      coverLetterId: savedCoverLetter.id,
      qualityReport,
    });
  } catch (error) {
    console.error("Package generation error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Package generation failed" },
      { status: 500 }
    );
  }
}
