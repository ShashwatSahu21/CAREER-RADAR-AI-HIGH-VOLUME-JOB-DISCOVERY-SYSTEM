import { LLMProvider } from "../provider";
import { ParsedJobData } from "./job-parser";

export type RoleCategory =
  | "ROBOTICS_HARDWARE"
  | "ROBOTICS_SOFTWARE"
  | "PHYSICAL_AI"
  | "AUTONOMOUS_SYSTEMS"
  | "EMBEDDED_SYSTEMS"
  | "COMPUTER_VISION"
  | "AI_ML"
  | "LLM_GENERATIVE_AI"
  | "SOFTWARE_ENGINEERING"
  | "BACKEND_ENGINEERING"
  | "FULL_STACK"
  | "TECHNICAL_PRODUCT"
  | "PRODUCT_MANAGEMENT"
  | "PRODUCT_OPERATIONS"
  | "HYBRID"
  | "OTHER";

export type CareerTrack = "ROBOTICS" | "SOFTWARE" | "PRODUCT" | "HYBRID";

export interface RoleClassificationResult {
  primary_role: RoleCategory;
  confidence: number;
  secondary_role: RoleCategory;
  secondary_confidence: number;
  career_track: CareerTrack;
  reasoning: string;
}

export class RoleClassifierAgent {
  constructor(private provider: LLMProvider) {}

  async classify(parsedJob: ParsedJobData): Promise<RoleClassificationResult> {
    const systemPrompt = `You are a precision role classifier AI for engineering candidates. Your job is to classify job opportunities into exact role categories and map them to one of three primary candidate career tracks:
1. ROBOTICS (Robotics, Hardware, Physical AI, Embedded, Perception, Motion Planning, ROS/ROS2)
2. SOFTWARE (Software Engineering, Python, AI/ML, LLM, Computer Vision, Backend, Full-Stack)
3. PRODUCT (Associate Product Manager, Technical Product, Product Operations, Startup Generalist, Founder's Office)
4. HYBRID (Combines multiple tracks equally, e.g. AI Product Manager or Robotics Software + Product)`;

    const userPrompt = `
Classify the following job opportunity:
TITLE: ${parsedJob.job_title}
COMPANY: ${parsedJob.company}
PRIMARY DOMAIN: ${parsedJob.primary_domain}
REQUIRED SKILLS: ${parsedJob.required_skills.join(", ")}
TECHNOLOGIES: ${parsedJob.technologies.join(", ")}
SUMMARY: ${parsedJob.role_summary}

Valid Role Categories:
- ROBOTICS_HARDWARE
- ROBOTICS_SOFTWARE
- PHYSICAL_AI
- AUTONOMOUS_SYSTEMS
- EMBEDDED_SYSTEMS
- COMPUTER_VISION
- AI_ML
- LLM_GENERATIVE_AI
- SOFTWARE_ENGINEERING
- BACKEND_ENGINEERING
- FULL_STACK
- TECHNICAL_PRODUCT
- PRODUCT_MANAGEMENT
- PRODUCT_OPERATIONS
- HYBRID
- OTHER

Return JSON matching:
{
  "primary_role": "RoleCategory",
  "confidence": number between 0.0 and 1.0,
  "secondary_role": "RoleCategory",
  "secondary_confidence": number between 0.0 and 1.0,
  "career_track": "ROBOTICS" | "SOFTWARE" | "PRODUCT" | "HYBRID",
  "reasoning": "Brief explanation of why this track was chosen"
}
`;

    try {
      return await this.provider.generateStructuredJSON<RoleClassificationResult>({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
      });
    } catch (err) {
      console.error("RoleClassifierAgent error, using heuristic fallback:", err);
      return this.heuristicFallback(parsedJob);
    }
  }

  private heuristicFallback(parsedJob: ParsedJobData): RoleClassificationResult {
    const text = (parsedJob.job_title + " " + parsedJob.primary_domain + " " + parsedJob.required_skills.join(" ")).toLowerCase();

    if (text.includes("robot") || text.includes("ros") || text.includes("hardware") || text.includes("mechatronic") || text.includes("physical ai")) {
      return {
        primary_role: "ROBOTICS_SOFTWARE",
        confidence: 0.9,
        secondary_role: "COMPUTER_VISION",
        secondary_confidence: 0.75,
        career_track: "ROBOTICS",
        reasoning: "Matched robotics keywords in title/skills",
      };
    }

    if (text.includes("product") || text.includes("apm") || text.includes("program") || text.includes("founder")) {
      return {
        primary_role: "TECHNICAL_PRODUCT",
        confidence: 0.9,
        secondary_role: "PRODUCT_MANAGEMENT",
        secondary_confidence: 0.8,
        career_track: "PRODUCT",
        reasoning: "Matched product keywords in title/skills",
      };
    }

    return {
      primary_role: "SOFTWARE_ENGINEERING",
      confidence: 0.85,
      secondary_role: "AI_ML",
      secondary_confidence: 0.7,
      career_track: "SOFTWARE",
      reasoning: "Defaulted to software engineering track",
    };
  }
}
