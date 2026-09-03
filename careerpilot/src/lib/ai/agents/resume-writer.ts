import { LLMProvider } from "../provider";
import { ParsedJobData } from "./job-parser";

export interface TailoredBulletResult {
  generated_bullet: string;
  source_type: "experience" | "project";
  source_id: string;
  original_bullet: string;
  matched_keywords: string[];
}

export interface TailoredResumeContent {
  header: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedinUrl: string;
    githubUrl: string;
    portfolioUrl: string;
  };
  education: Array<{
    degree: string;
    specialization: string;
    university: string;
    graduationDate: string;
    cgpa: string;
    coursework: string;
  }>;
  experiences: Array<{
    id: string;
    company: string;
    role: string;
    location: string;
    startDate: string;
    endDate: string;
    bullets: TailoredBulletResult[];
  }>;
  projects: Array<{
    id: string;
    projectName: string;
    technologies: string[];
    githubUrl: string;
    demoUrl: string;
    bullets: TailoredBulletResult[];
  }>;
  skills: Array<{
    category: string;
    items: string[];
  }>;
  achievements: Array<{
    title: string;
    organization: string;
    date: string;
    description: string;
  }>;
}

export class ResumeWriterAgent {
  constructor(private provider: LLMProvider) {}

  async writeTailoredResume(
    parsedJob: ParsedJobData,
    candidateProfile: any,
    selectedPlan: any,
    supportedKeywords: string[]
  ): Promise<TailoredResumeContent> {
    const selectedExps = (candidateProfile.experiences || []).filter((e: any) =>
      selectedPlan.selected_experience_ids.includes(e.id)
    );

    const selectedProjs = (candidateProfile.projects || []).filter((p: any) =>
      selectedPlan.selected_project_ids.includes(p.id)
    );

    const systemPrompt = `You are a world-class ATS resume writer and bullet optimizer. 
CRITICAL RULE: YOU MUST REMAIN 100% TRUTHFUL TO THE CANDIDATE'S VERIFIED SOURCE DATA.
DO NOT INVENT: Fake metrics, technologies, tools, companies, or accomplishments.
You MAY rephrase, condense, and optimize phrasing using the strong formula:
ACTION VERB + WHAT WAS BUILT/DONE + TECHNOLOGY/METHOD + IMPACT/RESULT (using verified metrics if present).
Keep the bullet points dense, professional, concise, and ATS-optimized.`;

    const userPrompt = `
TARGET ROLE: ${parsedJob.job_title} at ${parsedJob.company}
SUPPORTED ATS KEYWORDS TO WEAVE IN TRUTHFULLY: ${supportedKeywords.join(", ")}

CANDIDATE SOURCE EXPERIENCES:
${JSON.stringify(selectedExps, null, 2)}

CANDIDATE SOURCE PROJECTS:
${JSON.stringify(selectedProjs, null, 2)}

Rewrite the bullet points for each selected experience and project to align with ${parsedJob.job_title}.

Return valid JSON adhering to TailoredResumeContent format:
{
  "header": {
    "fullName": "${candidateProfile.fullName || "Shashwat Sahu"}",
    "email": "${candidateProfile.email || "Shashwatsahu.contact@gmail.com"}",
    "phone": "${candidateProfile.phone || "+91 8827999403"}",
    "location": "${candidateProfile.location || "Bangalore, India"}",
    "linkedinUrl": "${candidateProfile.linkedinUrl || "https://www.linkedin.com/in/shashwatsahu21"}",
    "githubUrl": "${candidateProfile.githubUrl || "https://github.com/ShashwatSahu21"}",
    "portfolioUrl": "${candidateProfile.portfolioUrl || "https://shashwatsahu-portfolio-website.vercel.app/"}"
  },
  "education": ${JSON.stringify(candidateProfile.education || [])},
  "experiences": [
    {
      "id": "exp_id",
      "company": "string",
      "role": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "bullets": [
        {
          "generated_bullet": "string",
          "source_type": "experience",
          "source_id": "exp_id",
          "original_bullet": "string",
          "matched_keywords": ["string"]
        }
      ]
    }
  ],
  "projects": [
    {
      "id": "proj_id",
      "projectName": "string",
      "technologies": ["string"],
      "githubUrl": "string",
      "demoUrl": "string",
      "bullets": [
        {
          "generated_bullet": "string",
          "source_type": "project",
          "source_id": "proj_id",
          "original_bullet": "string",
          "matched_keywords": ["string"]
        }
      ]
    }
  ],
  "skills": [
    { "category": "Programming & Web", "items": ["Python", "C++", "FastAPI", "React.js"] },
    { "category": "Robotics & Physical AI", "items": ["ROS2", "Gazebo", "Raspberry Pi", "Fusion 360"] },
    { "category": "AI & ML", "items": ["PyTorch", "TensorFlow", "OpenCV", "Scikit-learn"] },
    { "category": "Tools & Databases", "items": ["Git", "Supabase", "Qdrant", "Linux"] }
  ],
  "achievements": ${JSON.stringify(candidateProfile.achievements || [])}
}
`;

    try {
      return await this.provider.generateStructuredJSON<TailoredResumeContent>({
        systemPrompt,
        userPrompt,
        temperature: 0.15,
      });
    } catch (err) {
      console.error("ResumeWriterAgent error, falling back to original bullets:", err);
      return this.fallbackWriter(candidateProfile, selectedExps, selectedProjs);
    }
  }

  private fallbackWriter(candidateProfile: any, selectedExps: any[], selectedProjs: any[]): TailoredResumeContent {
    return {
      header: {
        fullName: candidateProfile.fullName || "Shashwat Sahu",
        email: candidateProfile.email || "Shashwatsahu.contact@gmail.com",
        phone: candidateProfile.phone || "+91 8827999403",
        location: candidateProfile.location || "Bangalore, India",
        linkedinUrl: candidateProfile.linkedinUrl || "https://www.linkedin.com/in/shashwatsahu21",
        githubUrl: candidateProfile.githubUrl || "https://github.com/ShashwatSahu21",
        portfolioUrl: candidateProfile.portfolioUrl || "https://shashwatsahu-portfolio-website.vercel.app/",
      },
      education: candidateProfile.education || [],
      experiences: selectedExps.map((e) => ({
        id: e.id,
        company: e.company,
        role: e.role,
        location: e.location || "Bangalore",
        startDate: e.startDate,
        endDate: e.endDate,
        bullets: (e.bullets || []).map((b: any) => ({
          generated_bullet: b.content,
          source_type: "experience" as const,
          source_id: e.id,
          original_bullet: b.content,
          matched_keywords: [],
        })),
      })),
      projects: selectedProjs.map((p) => ({
        id: p.id,
        projectName: p.projectName,
        technologies: typeof p.technologies === "string" ? JSON.parse(p.technologies || "[]") : p.technologies || [],
        githubUrl: p.githubUrl || "",
        demoUrl: p.demoUrl || "",
        bullets: (p.bullets || []).map((b: any) => ({
          generated_bullet: b.content,
          source_type: "project" as const,
          source_id: p.id,
          original_bullet: b.content,
          matched_keywords: [],
        })),
      })),
      skills: [
        { category: "Programming", items: ["Python", "C++", "C", "JavaScript"] },
        { category: "Robotics & Physical AI", items: ["ROS2", "Arduino", "Raspberry Pi", "Gazebo", "Fusion 360"] },
        { category: "AI & ML", items: ["PyTorch", "TensorFlow", "OpenCV", "Scikit-learn"] },
        { category: "Tools & Frameworks", items: ["Git", "FastAPI", "React.js", "Supabase"] },
      ],
      achievements: candidateProfile.achievements || [],
    };
  }
}
