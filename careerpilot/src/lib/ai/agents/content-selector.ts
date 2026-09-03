import { LLMProvider } from "../provider";
import { ParsedJobData } from "./job-parser";
import { CandidateProfileContext } from "./match-engine";

export interface SelectedContentPlan {
  selected_experience_ids: string[];
  selected_project_ids: string[];
  selected_skill_names: string[];
  selected_achievement_ids: string[];
  content_priority_reasoning: string;
  section_order: string[];
}

export class ContentSelectorAgent {
  constructor(private provider: LLMProvider) {}

  async selectContent(
    parsedJob: ParsedJobData,
    candidate: any,
    suggestedLayout: "EXPERIENCE_FIRST" | "PROJECT_FIRST"
  ): Promise<SelectedContentPlan> {
    const experiencesSummary = (candidate.experiences || []).map((e: any) => ({
      id: e.id,
      company: e.company,
      role: e.role,
      tech: e.technologies,
      bulletsCount: e.bullets?.length || 0,
    }));

    const projectsSummary = (candidate.projects || []).map((p: any) => ({
      id: p.id,
      name: p.projectName,
      tech: p.technologies,
      bulletsCount: p.bullets?.length || 0,
    }));

    const skillsSummary = (candidate.skills || []).map((s: any) => s.name);

    const systemPrompt = `You are an expert technical resume content selector. Your job is to select the top 3-4 most relevant experiences, top 3-4 most relevant projects, and most relevant skills from the candidate's Master Database to construct a dense 1-page tailored resume for a specific job.`;

    const userPrompt = `
JOB TITLE: ${parsedJob.job_title}
COMPANY: ${parsedJob.company}
PRIMARY DOMAIN: ${parsedJob.primary_domain}
REQUIRED TECH: ${parsedJob.technologies.join(", ")}
REQUIRED SKILLS: ${parsedJob.required_skills.join(", ")}

CANDIDATE EXPERIENCES:
${JSON.stringify(experiencesSummary, null, 2)}

CANDIDATE PROJECTS:
${JSON.stringify(projectsSummary, null, 2)}

CANDIDATE SKILLS:
${JSON.stringify(skillsSummary)}

SUGGESTED LAYOUT: ${suggestedLayout}

Select the IDs of experiences and projects that maximize relevancy to this exact job posting.

Return JSON:
{
  "selected_experience_ids": ["string"],
  "selected_project_ids": ["string"],
  "selected_skill_names": ["string"],
  "selected_achievement_ids": ["string"],
  "content_priority_reasoning": "Explanation of why these specific items were prioritized",
  "section_order": ["header", "education", "projects", "experience", "skills", "achievements"]
}
`;

    try {
      return await this.provider.generateStructuredJSON<SelectedContentPlan>({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
      });
    } catch (err) {
      console.error("ContentSelectorAgent error, using fallback selection:", err);
      return {
        selected_experience_ids: (candidate.experiences || []).map((e: any) => e.id),
        selected_project_ids: (candidate.projects || []).map((p: any) => p.id),
        selected_skill_names: (candidate.skills || []).map((s: any) => s.name),
        selected_achievement_ids: (candidate.achievements || []).map((a: any) => a.id),
        content_priority_reasoning: "Selected all available items from Master Career Database.",
        section_order: ["header", "education", "projects", "experience", "skills", "achievements"],
      };
    }
  }
}
