import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { FormAnswerAgent, FormQuestion } from "@/lib/ai/agents/form-answer-agent";
import { getAIProvider } from "@/lib/ai/provider";
import type { ParsedJobData } from "@/lib/ai/agents/job-parser";

/**
 * POST /api/apply/answers
 * 
 * Given a list of form questions + job context, returns AI-generated answers
 * using the candidate's profile and standard answers.
 * 
 * Request body:
 * {
 *   jobId: string,
 *   questions: FormQuestion[],
 *   coverLetterContent?: string
 * }
 * 
 * Response:
 * {
 *   answers: AnsweredQuestion[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, questions, coverLetterContent } = body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "Questions array is required" },
        { status: 400 }
      );
    }

    // Fetch user settings for AI provider
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.userId },
    });

    // Fetch candidate profile with all relations
    const profile = await prisma.careerProfile.findUnique({
      where: { userId: session.userId },
      include: {
        education: true,
        experiences: { include: { bullets: true } },
        projects: { include: { bullets: true } },
        skills: true,
        achievements: true,
        standardAnswers: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Career profile not found. Please set up your profile first." },
        { status: 404 }
      );
    }

    // Fetch job data if jobId provided
    let parsedJobData: ParsedJobData | null = null;
    if (jobId) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { analysis: true },
      });

      if (job?.analysis) {
        parsedJobData = {
          job_title: job.title,
          company: job.company,
          primary_domain: job.analysis.primaryDomain || "",
          secondary_domains: safeParseArray(job.analysis.secondaryDomains),
          technologies: safeParseArray(job.analysis.technologies),
          required_skills: safeParseArray(job.analysis.requiredSkills),
          preferred_skills: safeParseArray(job.analysis.preferredSkills),
          responsibilities: safeParseArray(job.analysis.responsibilities),
          qualifications: safeParseArray(job.analysis.qualifications),
          role_summary: job.analysis.roleSummary || "",
          seniority_level: (job.analysis.seniorityLevel || "entry_level") as ParsedJobData["seniority_level"],
          employment_type: job.employmentType || "Full-time",
          location: job.location || "",
          industry: job.analysis.industry || "",
          keywords: [],
        };
      } else if (job) {
        parsedJobData = {
          job_title: job.title,
          company: job.company,
          primary_domain: "",
          secondary_domains: [],
          technologies: [],
          required_skills: [],
          preferred_skills: [],
          responsibilities: [],
          qualifications: [],
          role_summary: job.description?.slice(0, 300) || "",
          seniority_level: "entry_level" as const,
          employment_type: job.employmentType || "Full-time",
          location: job.location || "",
          industry: "",
          keywords: [],
        };
      }
    }

    // Default parsed job if none available
    if (!parsedJobData) {
      parsedJobData = {
        job_title: "Software Engineer",
        company: "Company",
        primary_domain: "Software Engineering",
        secondary_domains: [],
        technologies: ["Python", "JavaScript"],
        required_skills: [],
        preferred_skills: [],
        responsibilities: [],
        qualifications: [],
        role_summary: "",
        seniority_level: "entry_level" as const,
        employment_type: "Full-time",
        location: "",
        industry: "Technology",
        keywords: [],
      };
    }

    // Initialize AI provider and form answer agent
    const provider = getAIProvider(
      settings?.aiProvider || "gemini",
      settings?.aiApiKey || undefined
    );
    const formAnswerAgent = new FormAnswerAgent(provider);

    // Build standard answers for the agent
    const standardAnswers = (profile.standardAnswers || []).map((sa: any) => ({
      questionPattern: sa.questionPattern,
      category: sa.category,
      answer: sa.answer,
      priority: sa.priority,
    }));

    // Answer the questions
    const answers = await formAnswerAgent.answerQuestions(
      questions as FormQuestion[],
      profile,
      parsedJobData,
      standardAnswers,
      coverLetterContent
    );

    return NextResponse.json({ answers });
  } catch (error) {
    console.error("Error in /api/apply/answers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function safeParseArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val) {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return [];
}
