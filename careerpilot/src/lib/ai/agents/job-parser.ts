import { LLMProvider } from "../provider";

export interface ParsedJobData {
  job_title: string;
  company: string;
  seniority_level: "internship" | "entry_level" | "junior" | "mid_level" | "senior" | "lead";
  primary_domain: string;
  secondary_domains: string[];
  employment_type: string;
  location: string;
  required_skills: string[];
  preferred_skills: string[];
  technologies: string[];
  responsibilities: string[];
  qualifications: string[];
  keywords: string[];
  industry: string;
  role_summary: string;
}

export class JobParserAgent {
  constructor(private provider: LLMProvider) {}

  async parse(rawTitle: string, rawCompany: string, rawDescription: string, location?: string): Promise<ParsedJobData> {
    const systemPrompt = `You are an expert technical job parser AI. Your task is to extract structured details from raw job postings for technical candidates in Robotics, AI, ML, Software Engineering, and Technical Product Management. Be concise, hyper-accurate, and extract all relevant technical skills and requirements.`;

    const userPrompt = `
Extract structured job information from the following posting:

TITLE: ${rawTitle}
COMPANY: ${rawCompany}
LOCATION: ${location || "Not specified"}
DESCRIPTION:
${rawDescription}

Return a valid JSON object matching this exact schema:
{
  "job_title": "string",
  "company": "string",
  "seniority_level": "internship" | "entry_level" | "junior" | "mid_level" | "senior" | "lead",
  "primary_domain": "string (e.g. Robotics, Computer Vision, AI/ML, Backend, Product)",
  "secondary_domains": ["string"],
  "employment_type": "string",
  "location": "string",
  "required_skills": ["string"],
  "preferred_skills": ["string"],
  "technologies": ["string (e.g. Python, ROS2, PyTorch, C++, FastAPI, Docker)"],
  "responsibilities": ["string"],
  "qualifications": ["string"],
  "keywords": ["string"],
  "industry": "string",
  "role_summary": "1-2 sentence executive summary of what this role entails"
}
`;

    try {
      return await this.provider.generateStructuredJSON<ParsedJobData>({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
      });
    } catch (err) {
      console.error("JobParserAgent error, falling back to heuristic parsing:", err);
      return this.heuristicFallback(rawTitle, rawCompany, rawDescription, location);
    }
  }

  private heuristicFallback(title: string, company: string, description: string, location?: string): ParsedJobData {
    const text = (title + " " + description).toLowerCase();
    const isRobotics = text.includes("robot") || text.includes("ros") || text.includes("hardware") || text.includes("mechatronics");
    const isProduct = text.includes("product") || text.includes("apm") || text.includes("program manager");
    const isAI = text.includes("ai") || text.includes("machine learning") || text.includes("vision") || text.includes("deep learning");

    return {
      job_title: title,
      company: company,
      seniority_level: text.includes("intern") ? "internship" : text.includes("senior") ? "senior" : "entry_level",
      primary_domain: isRobotics ? "Robotics" : isProduct ? "Product Management" : isAI ? "AI / ML" : "Software Engineering",
      secondary_domains: [],
      employment_type: text.includes("intern") ? "Internship" : "Full-time",
      location: location || "Bangalore / Remote",
      required_skills: ["Python", isRobotics ? "ROS2" : "Software Engineering"],
      preferred_skills: [],
      technologies: ["Python", isRobotics ? "C++" : "FastAPI"],
      responsibilities: ["Develop and maintain software components."],
      qualifications: ["Bachelor's degree in engineering or equivalent experience."],
      keywords: ["Python", isRobotics ? "Robotics" : "Software"],
      industry: isRobotics ? "Robotics & Physical AI" : "Software & Technology",
      role_summary: `${title} position at ${company}.`,
    };
  }
}
