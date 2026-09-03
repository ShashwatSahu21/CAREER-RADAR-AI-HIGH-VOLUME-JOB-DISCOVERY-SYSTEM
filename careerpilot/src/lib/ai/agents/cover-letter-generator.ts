import { LLMProvider } from "../provider";
import { ParsedJobData } from "./job-parser";
import { TailoredResumeContent } from "./resume-writer";

export interface CoverLetterResult {
  letter_type: "cover_letter" | "letter_of_intent";
  content: string;
  opening_hook: string;
  key_experiences_highlighted: string[];
}

export class CoverLetterGeneratorAgent {
  constructor(private provider: LLMProvider) {}

  async generate(
    parsedJob: ParsedJobData,
    tailoredResume: TailoredResumeContent,
    candidateSummary?: string
  ): Promise<CoverLetterResult> {
    const isStartupOrEarlyStage =
      parsedJob.company.toLowerCase().includes("ai") ||
      parsedJob.job_title.toLowerCase().includes("founding") ||
      parsedJob.seniority_level === "internship";

    const letterType = isStartupOrEarlyStage ? "letter_of_intent" : "cover_letter";

    const systemPrompt = `You are a top-tier executive career coach and technical communicator. 
Your task is to write a highly personalized, compelling 1-page Cover Letter or Letter of Intent for an engineering/product role.

CRITICAL RULES:
1. NEVER use generic fluff openings such as:
   "I am writing to express my interest in..."
   "I am passionate about..."
   "I believe I would be a great fit for..."
2. INSTEAD, use an immediate evidence-based opening hook demonstrating direct alignment:
   e.g., "The opportunity to work on autonomous robotic systems at [Company] particularly aligns with my experience building a 12-DOF quadruped robot and developing AI-driven computer vision logic."
3. Highlight 2-3 specific verified projects or experiences from the candidate's profile.
4. Keep the letter concise, professional, evidence-driven, and under 350 words.`;

    const userPrompt = `
COMPANY: ${parsedJob.company}
ROLE: ${parsedJob.job_title}
PRIMARY DOMAIN: ${parsedJob.primary_domain}
REQUIRED TECH: ${parsedJob.technologies.join(", ")}
ROLE SUMMARY: ${parsedJob.role_summary}

CANDIDATE NAME: ${tailoredResume.header.fullName}
HIGHLIGHTED PROJECTS:
${JSON.stringify(tailoredResume.projects.map((p) => ({ name: p.projectName, tech: p.technologies })), null, 2)}

HIGHLIGHTED EXPERIENCE:
${JSON.stringify(tailoredResume.experiences.map((e) => ({ company: e.company, role: e.role })), null, 2)}

Generate a ${letterType.replace(/_/g, " ")}.

Return JSON:
{
  "letter_type": "${letterType}",
  "opening_hook": "string (the strong first sentence)",
  "content": "string (full multi-paragraph text formatted cleanly with linebreaks)",
  "key_experiences_highlighted": ["string"]
}
`;

    try {
      return await this.provider.generateStructuredJSON<CoverLetterResult>({
        systemPrompt,
        userPrompt,
        temperature: 0.25,
      });
    } catch (err) {
      console.error("CoverLetterGeneratorAgent error, using fallback template:", err);
      return this.fallbackLetter(parsedJob, tailoredResume, letterType);
    }
  }

  private fallbackLetter(parsedJob: ParsedJobData, tailoredResume: TailoredResumeContent, letterType: "cover_letter" | "letter_of_intent"): CoverLetterResult {
    const candidateName = tailoredResume.header.fullName || "Shashwat Sahu";
    const projName = tailoredResume.projects[0]?.projectName || "SynaptIArm-6X / Quadruped Robot";
    const hook = `The opportunity to contribute to ${parsedJob.job_title} at ${parsedJob.company} directly aligns with my hands-on experience developing autonomous robotic systems, computer vision models, and full-stack software solutions including ${projName}.`;

    const content = `Dear Hiring Team at ${parsedJob.company},

${hook}

As a Robotics and Artificial Intelligence engineering student, I have focused my work on building production-grade physical AI platforms and intelligent software pipelines. In my recent work on ${projName}, I engineered real-time control logic, integrated sensor feedback, and optimized system performance under real-world constraints.

My background spans ROS2, Python, C++, and modern AI/ML frameworks. At ${parsedJob.company}, I am particularly excited to apply these competencies to solve engineering challenges in ${parsedJob.primary_domain}.

I would welcome the opportunity to discuss how my technical background and project experience align with your engineering goals. Thank you for your time and consideration.

Sincerely,
${candidateName}
${tailoredResume.header.email} | ${tailoredResume.header.phone}
${tailoredResume.header.portfolioUrl}
`;

    return {
      letter_type: letterType,
      opening_hook: hook,
      content,
      key_experiences_highlighted: [projName],
    };
  }
}
