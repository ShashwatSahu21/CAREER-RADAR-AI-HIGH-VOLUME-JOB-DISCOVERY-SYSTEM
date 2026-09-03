import { RoleClassificationResult } from "./role-classifier";

export interface ResumeRoutingResult {
  selected_base_resume: "robotics" | "software" | "product";
  base_resume_name: string;
  reasoning: string;
  secondary_content_sources: string[];
  suggested_layout: "EXPERIENCE_FIRST" | "PROJECT_FIRST";
}

export class ResumeRouterAgent {
  /**
   * Intelligently selects the starting base resume and configures secondary content sources.
   * Logic:
   * ROBOTICS_* → Robotics Base (+ Software/AI Projects)
   * AI_ML / SOFTWARE_* → Software/AI Base (+ Robotics Projects if applicable)
   * TECHNICAL_PRODUCT / PRODUCT_* → Product Base (+ Tech Projects)
   * HYBRID → Best alignment based on match scores
   */
  route(classification: RoleClassificationResult, isStudentOrJunior: boolean = true): ResumeRoutingResult {
    const track = classification.career_track;
    const role = classification.primary_role;

    if (track === "ROBOTICS" || role.startsWith("ROBOTICS") || role === "PHYSICAL_AI" || role === "AUTONOMOUS_SYSTEMS" || role === "EMBEDDED_SYSTEMS") {
      return {
        selected_base_resume: "robotics",
        base_resume_name: "Robotics / Hardware Resume",
        reasoning: `Role classified as ${role} (${(classification.confidence * 100).toFixed(0)}% confidence). Using Robotics base with physical AI & motion control focus.`,
        secondary_content_sources: ["software_ai_projects", "master_career_db"],
        suggested_layout: isStudentOrJunior ? "PROJECT_FIRST" : "EXPERIENCE_FIRST",
      };
    }

    if (track === "PRODUCT" || role.startsWith("PRODUCT") || role === "TECHNICAL_PRODUCT") {
      return {
        selected_base_resume: "product",
        base_resume_name: "Product Resume",
        reasoning: `Role classified as ${role} (${(classification.confidence * 100).toFixed(0)}% confidence). Using Product base with impact & growth metrics focus.`,
        secondary_content_sources: ["technical_projects", "leadership_achievements"],
        suggested_layout: "EXPERIENCE_FIRST",
      };
    }

    // Default to Software / AI
    return {
      selected_base_resume: "software",
      base_resume_name: "Software / AI Resume",
      reasoning: `Role classified as ${role} (${(classification.confidence * 100).toFixed(0)}% confidence). Using Software/AI base with architecture & algorithm focus.`,
      secondary_content_sources: ["robotics_projects", "master_career_db"],
      suggested_layout: isStudentOrJunior ? "PROJECT_FIRST" : "EXPERIENCE_FIRST",
    };
  }
}
