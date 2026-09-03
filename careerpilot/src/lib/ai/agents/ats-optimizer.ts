import { ParsedJobData } from "./job-parser";

export interface KeywordMapping {
  keyword: string;
  category: "required_skill" | "preferred_skill" | "technology" | "tool" | "domain" | "soft_skill";
  isSupported: boolean;
  supportSource: string;
}

export class ATSOptimizerAgent {
  /**
   * Compares JD keywords against Master Career Database.
   * STRICT RULE: ONLY add keywords that are TRUTHFULLY supported by the user's experience.
   * Do NOT inject unsupported keywords (e.g. claiming Kubernetes if user has no evidence).
   */
  optimize(parsedJob: ParsedJobData, candidate: any): KeywordMapping[] {
    const candidateTech = new Set<string>();
    const candidateSkills = new Set<string>();
    const evidenceMap = new Map<string, string>();

    // Index candidate verified skills
    (candidate.skills || []).forEach((s: any) => {
      const nameLower = s.name.toLowerCase();
      candidateSkills.add(nameLower);
      evidenceMap.set(nameLower, `Skill: ${s.name}`);
    });

    // Index candidate experience tech & text
    (candidate.experiences || []).forEach((e: any) => {
      const techList: string[] = typeof e.technologies === "string" ? parseArr(e.technologies) : e.technologies || [];
      techList.forEach((t) => {
        const tLower = t.toLowerCase();
        candidateTech.add(tLower);
        evidenceMap.set(tLower, `Experience at ${e.company} (${e.role})`);
      });
    });

    // Index candidate project tech & text
    (candidate.projects || []).forEach((p: any) => {
      const techList: string[] = typeof p.technologies === "string" ? parseArr(p.technologies) : p.technologies || [];
      techList.forEach((t) => {
        const tLower = t.toLowerCase();
        candidateTech.add(tLower);
        evidenceMap.set(tLower, `Project: ${p.projectName}`);
      });
    });

    const mappings: KeywordMapping[] = [];

    // Process required skills
    parsedJob.required_skills.forEach((kw) => {
      const kwLower = kw.toLowerCase();
      const isSupported = candidateSkills.has(kwLower) || candidateTech.has(kwLower) || Array.from(evidenceMap.keys()).some((k) => k.includes(kwLower) || kwLower.includes(k));
      mappings.push({
        keyword: kw,
        category: "required_skill",
        isSupported,
        supportSource: isSupported ? (evidenceMap.get(kwLower) || "Master Career Database") : "UNSUPPORTED",
      });
    });

    // Process technologies
    parsedJob.technologies.forEach((kw) => {
      const kwLower = kw.toLowerCase();
      const isSupported = candidateTech.has(kwLower) || candidateSkills.has(kwLower) || Array.from(evidenceMap.keys()).some((k) => k.includes(kwLower) || kwLower.includes(k));
      mappings.push({
        keyword: kw,
        category: "technology",
        isSupported,
        supportSource: isSupported ? (evidenceMap.get(kwLower) || "Master Career Database") : "UNSUPPORTED",
      });
    });

    return mappings;
  }
}

function parseArr(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val) {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}
