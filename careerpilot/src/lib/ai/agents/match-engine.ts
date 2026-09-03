import { ParsedJobData } from "./job-parser";
import { RoleClassificationResult } from "./role-classifier";

export interface CandidateProfileContext {
  education: Array<{ degree: string; specialization: string; university: string }>;
  experiences: Array<{ company: string; role: string; technologies: string[]; skills: string[]; description: string }>;
  projects: Array<{ projectName: string; technologies: string[]; skills: string[]; description: string }>;
  skills: Array<{ name: string; category: string }>;
}

export interface MatchScoreResult {
  overall_match_score: number;
  skill_match: number;
  experience_match: number;
  project_match: number;
  technology_match: number;
  seniority_match: number;
  location_match: number;
  recommendation: "HIGH_PRIORITY" | "STRONG_MATCH" | "STRETCH" | "LOW_PRIORITY";
  strengths: string[];
  gaps: string[];
  missing_keywords: string[];
}

export class MatchEngineAgent {
  /**
   * Calculates a granular 0-100 job match score based on weighted factors:
   * Skill Match: 30%
   * Experience Relevance: 25%
   * Project Relevance: 20%
   * Technology Match: 10%
   * Seniority Match: 10%
   * Location/Eligibility: 5%
   */
  calculateMatch(
    parsedJob: ParsedJobData,
    classification: RoleClassificationResult,
    candidate: CandidateProfileContext
  ): MatchScoreResult {
    const candidateTech = new Set([
      ...candidate.skills.map((s) => s.name.toLowerCase()),
      ...candidate.experiences.flatMap((e) => e.technologies.map((t) => t.toLowerCase())),
      ...candidate.projects.flatMap((p) => p.technologies.map((t) => t.toLowerCase())),
    ]);

    const candidateSkillsLower = new Set(candidate.skills.map((s) => s.name.toLowerCase()));

    // 1. Skill Match (30%)
    const required = parsedJob.required_skills.map((s) => s.toLowerCase());
    const matchedSkills = required.filter((s) =>
      candidateSkillsLower.has(s) || Array.from(candidateSkillsLower).some((cs) => cs.includes(s) || s.includes(cs))
    );
    const skillScore = required.length > 0 ? Math.round((matchedSkills.length / required.length) * 100) : 85;

    // 2. Tech Match (10%)
    const jobTech = parsedJob.technologies.map((t) => t.toLowerCase());
    const matchedTech = jobTech.filter((t) => candidateTech.has(t) || Array.from(candidateTech).some((ct) => ct.includes(t) || t.includes(ct)));
    const techScore = jobTech.length > 0 ? Math.round((matchedTech.length / jobTech.length) * 100) : 80;

    // 3. Experience Match (25%)
    let expScore = 75;
    if (candidate.experiences.length > 0) {
      const expTrackMatch = candidate.experiences.some((e) => {
        const text = (e.role + " " + e.description).toLowerCase();
        if (classification.career_track === "ROBOTICS" && (text.includes("robot") || text.includes("hardware") || text.includes("embedded"))) return true;
        if (classification.career_track === "PRODUCT" && (text.includes("product") || text.includes("management") || text.includes("growth"))) return true;
        if (classification.career_track === "SOFTWARE" && (text.includes("software") || text.includes("ai") || text.includes("developer"))) return true;
        return false;
      });
      expScore = expTrackMatch ? 92 : 70;
    }

    // 4. Project Match (20%)
    let projScore = 80;
    if (candidate.projects.length > 0) {
      const matchingProjects = candidate.projects.filter((p) => {
        const text = (p.projectName + " " + p.description + " " + p.technologies.join(" ")).toLowerCase();
        return jobTech.some((t) => text.includes(t)) || matchedSkills.some((s) => text.includes(s));
      });
      projScore = Math.min(100, Math.round((matchingProjects.length / Math.max(1, candidate.projects.length)) * 120));
      projScore = Math.max(60, projScore);
    }

    // 5. Seniority Match (10%)
    const isStudentOrEntry = parsedJob.seniority_level === "internship" || parsedJob.seniority_level === "entry_level" || parsedJob.seniority_level === "junior";
    const seniorityScore = isStudentOrEntry ? 95 : 65;

    // 6. Location Match (5%)
    const locLower = (parsedJob.location || "").toLowerCase();
    const isBangaloreOrRemote = locLower.includes("bangalore") || locLower.includes("bengaluru") || locLower.includes("remote") || locLower.includes("india") || locLower === "";
    const locationScore = isBangaloreOrRemote ? 100 : 60;

    // Weighted Overall Score calculation
    const overallScore = Math.round(
      skillScore * 0.3 +
      expScore * 0.25 +
      projScore * 0.2 +
      techScore * 0.1 +
      seniorityScore * 0.1 +
      locationScore * 0.05
    );

    // Identify strengths and gaps
    const strengths: string[] = [];
    const gaps: string[] = [];
    const missingKeywords: string[] = [];

    matchedSkills.forEach((s) => strengths.push(`Verified match in ${s}`));
    matchedTech.forEach((t) => strengths.push(`Hands-on project experience with ${t}`));

    jobTech.forEach((t) => {
      if (!candidateTech.has(t)) {
        missingKeywords.push(t);
        gaps.push(`Missing explicit project evidence for ${t}`);
      }
    });

    let recommendation: "HIGH_PRIORITY" | "STRONG_MATCH" | "STRETCH" | "LOW_PRIORITY";
    if (overallScore >= 85) recommendation = "HIGH_PRIORITY";
    else if (overallScore >= 70) recommendation = "STRONG_MATCH";
    else if (overallScore >= 55) recommendation = "STRETCH";
    else recommendation = "LOW_PRIORITY";

    return {
      overall_match_score: overallScore,
      skill_match: skillScore,
      experience_match: expScore,
      project_match: projScore,
      technology_match: techScore,
      seniority_match: seniorityScore,
      location_match: locationScore,
      recommendation,
      strengths: strengths.slice(0, 5),
      gaps: gaps.slice(0, 4),
      missing_keywords: missingKeywords,
    };
  }
}
