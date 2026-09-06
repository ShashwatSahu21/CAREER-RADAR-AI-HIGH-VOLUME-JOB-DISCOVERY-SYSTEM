import { LLMProvider } from "../provider";
import { ParsedJobData } from "./job-parser";

// ═══════════════════════════════════════
// QUESTION CLASSIFICATION TAXONOMY
// ═══════════════════════════════════════

export type QuestionCategory =
  | "PERSONAL_INFO"      // Name, Email, Phone, LinkedIn, GitHub
  | "SALARY"             // Expected CTC, Current CTC
  | "NOTICE_PERIOD"      // Notice period, Start date, Availability
  | "AUTHORIZATION"      // Work authorization, Visa status, Citizenship
  | "EXPERIENCE_YEARS"   // Years of experience in X
  | "SKILL_RATING"       // Rate proficiency in Python (1-10)
  | "MOTIVATION"         // Why join us? Why this role?
  | "BEHAVIORAL"         // Describe a challenge you solved
  | "TECHNICAL"          // Explain your approach to X
  | "EEO"               // Gender, Veteran, Disability
  | "COVER_LETTER"       // Paste your cover letter
  | "RELOCATION"         // Willing to relocate?
  | "EDUCATION"          // Degree, University, GPA
  | "PORTFOLIO"          // GitHub URL, Portfolio URL, Website
  | "AVAILABILITY"       // When can you start? Available for interview?
  | "REFERRAL"           // How did you hear about us?
  | "LANGUAGE"           // Languages known, proficiency
  | "UNKNOWN";           // Unrecognized questions → LLM fallback

export interface FormQuestion {
  question: string;
  inputType: "text" | "textarea" | "select" | "radio" | "checkbox" | "file" | "number" | "date";
  options?: string[];    // For select/radio/checkbox
  required: boolean;
  fieldName?: string;    // DOM field name/id
}

export interface AnsweredQuestion {
  question: string;
  answer: string;
  category: QuestionCategory;
  confidence: number;    // 0.0 to 1.0 — if < 0.7, flag for human review
  source: string;        // Where the answer came from: "profile", "standard_answer", "ai_generated", "computed"
  needsReview: boolean;
}

// ═══════════════════════════════════════
// STANDARD QUESTION PATTERNS
// ═══════════════════════════════════════

interface PatternRule {
  category: QuestionCategory;
  patterns: RegExp[];
}

const QUESTION_PATTERNS: PatternRule[] = [
  {
    category: "PERSONAL_INFO",
    patterns: [
      /\b(first\s*name|last\s*name|full\s*name|your\s*name|legal\s*name)\b/i,
      /\b(email\s*address|e-?mail)\b/i,
      /\b(phone\s*(number)?|mobile\s*(number)?|contact\s*number)\b/i,
      /\b(city|state|address|zip\s*code|postal\s*code|country)\b/i,
    ],
  },
  {
    category: "PORTFOLIO",
    patterns: [
      /\b(linkedin|linked\s*in)\b/i,
      /\b(github|git\s*hub)\b/i,
      /\b(portfolio|personal\s*website|website\s*url|blog)\b/i,
    ],
  },
  {
    category: "SALARY",
    patterns: [
      /\b(salary|compensation|ctc|expected\s*salary|current\s*salary|pay|annual\s*package)\b/i,
      /\b(salary\s*expect|desired\s*salary|minimum\s*salary)\b/i,
    ],
  },
  {
    category: "NOTICE_PERIOD",
    patterns: [
      /\b(notice\s*period|serving\s*notice|current\s*notice)\b/i,
    ],
  },
  {
    category: "AVAILABILITY",
    patterns: [
      /\b(when\s*(can|could)\s*you\s*start|start\s*date|earliest\s*start|available\s*(from|to\s*start))\b/i,
      /\b(available\s*for\s*interview|interview\s*availability)\b/i,
    ],
  },
  {
    category: "AUTHORIZATION",
    patterns: [
      /\b(work\s*authorization|authorized\s*to\s*work|visa\s*status|visa\s*sponsor|sponsorship|citizenship|legal.*work)\b/i,
      /\b(eligible\s*to\s*work|require\s*visa|right\s*to\s*work)\b/i,
    ],
  },
  {
    category: "EXPERIENCE_YEARS",
    patterns: [
      /\b(years?\s*of\s*experience|how\s*many\s*years|total\s*experience|relevant\s*experience)\b/i,
      /\b(experience\s*(in|with)\s*\w+)\b/i,
    ],
  },
  {
    category: "SKILL_RATING",
    patterns: [
      /\b(rate\s*(your|yourself)|proficiency\s*(in|level|with)|skill\s*level|expertise\s*(in|level))\b/i,
      /\b(scale\s*of\s*\d+\s*to\s*\d+|beginner|intermediate|advanced|expert)\b/i,
    ],
  },
  {
    category: "MOTIVATION",
    patterns: [
      /\b(why\s*(do\s*you\s*want|are\s*you\s*interested|should\s*we|this\s*(role|company|position)|join))\b/i,
      /\b(what\s*(excites|interests|attracts|motivates)\s*you)\b/i,
      /\b(cover\s*letter|letter\s*of\s*(intent|interest|motivation))\b/i,
    ],
  },
  {
    category: "BEHAVIORAL",
    patterns: [
      /\b(describe\s*(a|an|your)|tell\s*(us|me)\s*about\s*(a|an|your))\b/i,
      /\b(time\s*(when|you)|challenge|difficult\s*situation|achievement|proud\s*of)\b/i,
      /\b(strength|weakness|greatest\s*(accomplishment|failure))\b/i,
    ],
  },
  {
    category: "TECHNICAL",
    patterns: [
      /\b(explain\s*(your|how|the)|approach\s*to|solve|implement|design)\b/i,
      /\b(technical\s*(experience|background|skills)|coding\s*(challenge|test))\b/i,
    ],
  },
  {
    category: "RELOCATION",
    patterns: [
      /\b(willing\s*to\s*relocate|open\s*to\s*relocation|relocate|move\s*to)\b/i,
    ],
  },
  {
    category: "EDUCATION",
    patterns: [
      /\b(degree|university|college|gpa|cgpa|graduation|school|major|minor|specialization)\b/i,
      /\b(highest\s*qualification|educational\s*background)\b/i,
    ],
  },
  {
    category: "EEO",
    patterns: [
      /\b(gender|sex|race|ethnicity|veteran|disability|demographic|pronouns)\b/i,
      /\b(self.?identify|voluntary\s*self|equal\s*opportunity)\b/i,
    ],
  },
  {
    category: "REFERRAL",
    patterns: [
      /\b(how\s*did\s*you\s*(hear|find|learn)|referred\s*by|referral|source)\b/i,
    ],
  },
  {
    category: "LANGUAGE",
    patterns: [
      /\b(language|languages?\s*(spoken|known|proficiency))\b/i,
    ],
  },
  {
    category: "COVER_LETTER",
    patterns: [
      /\b(cover\s*letter|paste.*cover\s*letter|upload.*cover\s*letter)\b/i,
    ],
  },
];

// ═══════════════════════════════════════
// FORM ANSWER AGENT
// ═══════════════════════════════════════

export class FormAnswerAgent {
  constructor(private provider: LLMProvider) {}

  /**
   * Classifies a question into a category using pattern matching.
   * Falls back to UNKNOWN if no pattern matches.
   */
  classifyQuestion(question: string): QuestionCategory {
    const questionLower = question.toLowerCase();

    for (const rule of QUESTION_PATTERNS) {
      for (const pattern of rule.patterns) {
        if (pattern.test(questionLower)) {
          return rule.category;
        }
      }
    }

    return "UNKNOWN";
  }

  /**
   * Answers a batch of form questions using candidate profile, job context, and AI.
   */
  async answerQuestions(
    questions: FormQuestion[],
    candidateProfile: any,
    parsedJob: ParsedJobData,
    standardAnswers: Array<{ questionPattern: string; category: string; answer: string; priority: number }>,
    coverLetterContent?: string
  ): Promise<AnsweredQuestion[]> {
    const results: AnsweredQuestion[] = [];

    for (const q of questions) {
      const category = this.classifyQuestion(q.question);
      let answer: AnsweredQuestion;

      // Try deterministic lookup first
      answer = this.tryDeterministicAnswer(q, category, candidateProfile, standardAnswers, coverLetterContent);

      // If deterministic answer has low confidence or is UNKNOWN, use AI
      if (answer.confidence < 0.7 || category === "UNKNOWN") {
        answer = await this.tryAIAnswer(q, category, candidateProfile, parsedJob, standardAnswers, answer);
      }

      // Handle select/radio options — fuzzy match the answer to available options
      if (q.options && q.options.length > 0 && q.inputType !== "checkbox") {
        answer = this.matchToOptions(answer, q.options);
      }

      results.push(answer);
    }

    return results;
  }

  /**
   * Attempts to answer the question using direct profile lookups and pattern matching.
   * No AI/LLM call — purely deterministic and fast.
   */
  private tryDeterministicAnswer(
    q: FormQuestion,
    category: QuestionCategory,
    profile: any,
    standardAnswers: Array<{ questionPattern: string; category: string; answer: string; priority: number }>,
    coverLetterContent?: string
  ): AnsweredQuestion {
    const questionLower = q.question.toLowerCase();

    switch (category) {
      case "PERSONAL_INFO": {
        if (/first\s*name/i.test(questionLower)) {
          const names = (profile.fullName || "").split(" ");
          return this.result(q, names[0] || "", category, 1.0, "profile");
        }
        if (/last\s*name/i.test(questionLower)) {
          const names = (profile.fullName || "").split(" ");
          return this.result(q, names.slice(1).join(" ") || "", category, 1.0, "profile");
        }
        if (/full\s*name|your\s*name|legal\s*name/i.test(questionLower)) {
          return this.result(q, profile.fullName || "", category, 1.0, "profile");
        }
        if (/email/i.test(questionLower)) {
          return this.result(q, profile.email || "", category, 1.0, "profile");
        }
        if (/phone|mobile|contact\s*number/i.test(questionLower)) {
          return this.result(q, profile.phone || "", category, 1.0, "profile");
        }
        if (/city|location/i.test(questionLower)) {
          return this.result(q, profile.location || "Bangalore, India", category, 0.95, "profile");
        }
        if (/country/i.test(questionLower)) {
          return this.result(q, profile.nationality || "India", category, 0.95, "profile");
        }
        if (/address/i.test(questionLower)) {
          return this.result(q, profile.location || "Bangalore, Karnataka, India", category, 0.8, "profile");
        }
        return this.result(q, profile.fullName || "", category, 0.6, "profile");
      }

      case "PORTFOLIO": {
        if (/linkedin/i.test(questionLower)) {
          return this.result(q, profile.linkedinUrl || "", category, 1.0, "profile");
        }
        if (/github/i.test(questionLower)) {
          return this.result(q, profile.githubUrl || "", category, 1.0, "profile");
        }
        if (/portfolio|website/i.test(questionLower)) {
          return this.result(q, profile.portfolioUrl || "", category, 1.0, "profile");
        }
        return this.result(q, profile.portfolioUrl || "", category, 0.7, "profile");
      }

      case "SALARY": {
        if (/current/i.test(questionLower)) {
          return this.result(q, profile.currentCTC || "0", category, 0.95, "profile");
        }
        return this.result(q, profile.expectedCTC || "Negotiable", category, 0.9, "profile");
      }

      case "NOTICE_PERIOD": {
        return this.result(q, profile.noticePeriod || "Immediate", category, 1.0, "profile");
      }

      case "AVAILABILITY": {
        if (/start/i.test(questionLower)) {
          return this.result(q, profile.noticePeriod === "Immediate" ? "Immediately" : `After ${profile.noticePeriod}`, category, 0.9, "profile");
        }
        return this.result(q, "Yes, I am available", category, 0.85, "profile");
      }

      case "AUTHORIZATION": {
        const authAnswer = profile.workAuthorization || "Indian Citizen";
        if (/sponsor/i.test(questionLower)) {
          return this.result(q, "No", category, 0.9, "profile");
        }
        if (/authorized|eligible|right\s*to\s*work/i.test(questionLower)) {
          const country = questionLower.includes("india") ? "Yes" : "Please verify";
          return this.result(q, country, category, questionLower.includes("india") ? 0.95 : 0.6, "profile");
        }
        return this.result(q, authAnswer, category, 0.85, "profile");
      }

      case "EXPERIENCE_YEARS": {
        const yearsStr = profile.yearsOfExperience || "0-1";
        // Try to extract specific technology from the question
        const techMatch = questionLower.match(/experience\s*(?:in|with)\s+([a-zA-Z0-9+#.\s]+)/i);
        if (techMatch) {
          const tech = techMatch[1].trim().toLowerCase();
          const years = this.computeSkillYears(tech, profile);
          return this.result(q, years, category, 0.85, "computed");
        }
        return this.result(q, yearsStr, category, 0.9, "profile");
      }

      case "SKILL_RATING": {
        // Extract skill name and compute rating based on evidence
        const skillMatch = questionLower.match(/(?:rate|proficiency|expertise|skill\s*level)\s*(?:in|of|with|for)?\s*([a-zA-Z0-9+#.\s]+)/i);
        if (skillMatch) {
          const skillName = skillMatch[1].trim().toLowerCase();
          const rating = this.computeSkillRating(skillName, profile);
          return this.result(q, rating.toString(), category, 0.8, "computed");
        }
        return this.result(q, "Intermediate", category, 0.6, "computed");
      }

      case "RELOCATION": {
        const willing = profile.willingToRelocate !== false;
        return this.result(q, willing ? "Yes" : "No", category, 0.95, "profile");
      }

      case "EDUCATION": {
        const edu = (profile.education || [])[0];
        if (!edu) return this.result(q, "", category, 0.3, "profile");
        if (/degree|qualification/i.test(questionLower)) {
          return this.result(q, `${edu.degree} in ${edu.specialization}`, category, 1.0, "profile");
        }
        if (/university|college|school/i.test(questionLower)) {
          return this.result(q, edu.university || "", category, 1.0, "profile");
        }
        if (/gpa|cgpa/i.test(questionLower)) {
          return this.result(q, edu.cgpa || "", category, 1.0, "profile");
        }
        if (/graduation|year/i.test(questionLower)) {
          return this.result(q, edu.graduationDate || "", category, 1.0, "profile");
        }
        return this.result(q, `${edu.degree}, ${edu.university}`, category, 0.8, "profile");
      }

      case "EEO": {
        if (/gender|sex/i.test(questionLower)) {
          return this.result(q, profile.gender || "Prefer not to say", category, 0.95, "profile");
        }
        if (/veteran/i.test(questionLower)) {
          return this.result(q, profile.veteranStatus || "I am not a protected veteran", category, 0.95, "profile");
        }
        if (/disability/i.test(questionLower)) {
          return this.result(q, profile.disabilityStatus || "I do not wish to answer", category, 0.95, "profile");
        }
        if (/race|ethnicity/i.test(questionLower)) {
          return this.result(q, "Prefer not to say", category, 0.95, "profile");
        }
        return this.result(q, "Prefer not to say", category, 0.9, "profile");
      }

      case "REFERRAL": {
        return this.result(q, "Job Board / Online Search", category, 0.85, "profile");
      }

      case "LANGUAGE": {
        const langs = safeParseArray(profile.languagesKnown);
        return this.result(q, langs.join(", ") || "English, Hindi", category, 0.9, "profile");
      }

      case "COVER_LETTER": {
        if (coverLetterContent) {
          return this.result(q, coverLetterContent, category, 0.95, "profile");
        }
        return this.result(q, "", category, 0.3, "profile");
      }

      default: {
        // Try matching against standard answers
        const matched = this.matchStandardAnswer(questionLower, standardAnswers);
        if (matched) {
          return this.result(q, matched, category, 0.8, "standard_answer");
        }
        return this.result(q, "", "UNKNOWN", 0.0, "none");
      }
    }
  }

  /**
   * Uses the LLM to generate a natural, human-sounding answer.
   * Only called when deterministic lookup fails or has low confidence.
   */
  private async tryAIAnswer(
    q: FormQuestion,
    category: QuestionCategory,
    profile: any,
    parsedJob: ParsedJobData,
    standardAnswers: Array<{ questionPattern: string; category: string; answer: string }>,
    existingAnswer: AnsweredQuestion
  ): Promise<AnsweredQuestion> {
    // Build candidate context for the LLM
    const experiences = (profile.experiences || []).map((e: any) => ({
      company: e.company,
      role: e.role,
      description: e.description,
      bullets: (e.bullets || []).map((b: any) => b.content).slice(0, 3),
    }));

    const projects = (profile.projects || []).map((p: any) => ({
      name: p.projectName,
      description: p.description,
      technologies: safeParseArray(p.technologies),
      bullets: (p.bullets || []).map((b: any) => b.content).slice(0, 3),
    }));

    const skills = (profile.skills || []).map((s: any) => s.name);

    const systemPrompt = `You are an expert career coach helping a candidate fill out job application forms.
You must write answers that sound NATURAL and HUMAN — as if the candidate wrote them personally.

CRITICAL RULES:
1. ONLY use REAL information from the candidate's verified profile. NEVER fabricate experiences, companies, or achievements.
2. Keep answers concise (2-4 sentences for behavioral/motivation, 1 line for factual).
3. Sound conversational and genuine, NOT like a ChatGPT response. Avoid generic phrases like "I am passionate about..." or "I believe I would be a great fit..."
4. For "Why do you want to join?" questions — reference SPECIFIC aspects of the company/role from the job description.
5. For behavioral questions — cite a REAL project or experience from the candidate's profile.
6. If the question has fixed options, return EXACTLY one of the options.
7. If you genuinely cannot answer from the provided data, return "CANNOT_ANSWER" and nothing else.`;

    const userPrompt = `
QUESTION: "${q.question}"
INPUT TYPE: ${q.inputType}
${q.options ? `OPTIONS: ${JSON.stringify(q.options)}` : ""}
${q.required ? "REQUIRED: Yes" : "REQUIRED: No"}

JOB CONTEXT:
- Role: ${parsedJob.job_title} at ${parsedJob.company}
- Domain: ${parsedJob.primary_domain}
- Key Technologies: ${parsedJob.technologies.join(", ")}
- Role Summary: ${parsedJob.role_summary}

CANDIDATE PROFILE:
- Name: ${profile.fullName}
- Location: ${profile.location}
- Summary: ${profile.summary || ""}
- Key Skills: ${skills.slice(0, 15).join(", ")}
- Experiences: ${JSON.stringify(experiences.slice(0, 3))}
- Projects: ${JSON.stringify(projects.slice(0, 3))}

${standardAnswers.length > 0 ? `CANDIDATE'S PRE-APPROVED ANSWER TEMPLATES:\n${standardAnswers.map(a => `- ${a.category}: ${a.answer}`).join("\n")}` : ""}

Write a natural, human answer to this question. Return ONLY the answer text — no quotes, no explanation, no JSON.`;

    try {
      const aiAnswer = await this.provider.generateText({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
      });

      const cleanedAnswer = aiAnswer.trim();

      if (cleanedAnswer === "CANNOT_ANSWER" || !cleanedAnswer) {
        return {
          ...existingAnswer,
          confidence: 0.3,
          needsReview: true,
          source: "ai_generated",
          answer: existingAnswer.answer || "N/A",
        };
      }

      return this.result(q, cleanedAnswer, category, 0.85, "ai_generated");
    } catch (err) {
      console.error("FormAnswerAgent AI error:", err);
      return {
        ...existingAnswer,
        confidence: Math.max(existingAnswer.confidence, 0.3),
        needsReview: true,
        source: existingAnswer.source,
      };
    }
  }

  /**
   * Matches an answer to available dropdown/radio options using fuzzy matching.
   */
  private matchToOptions(answer: AnsweredQuestion, options: string[]): AnsweredQuestion {
    const answerLower = answer.answer.toLowerCase().trim();

    // Exact match
    const exact = options.find(o => o.toLowerCase().trim() === answerLower);
    if (exact) return { ...answer, answer: exact };

    // Substring match
    const substring = options.find(o =>
      o.toLowerCase().includes(answerLower) || answerLower.includes(o.toLowerCase())
    );
    if (substring) return { ...answer, answer: substring, confidence: answer.confidence * 0.9 };

    // Semantic similarity — find closest option
    const scored = options.map(o => ({
      option: o,
      score: this.similarityScore(answerLower, o.toLowerCase()),
    }));
    scored.sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score > 0.3) {
      return { ...answer, answer: scored[0].option, confidence: Math.min(answer.confidence, scored[0].score) };
    }

    // Default to first option if "yes"/"no" type
    if (options.length === 2) {
      const yesNo = options.find(o => /yes/i.test(o));
      if (yesNo && /yes|true|agree|willing/i.test(answerLower)) {
        return { ...answer, answer: yesNo, confidence: 0.8 };
      }
      const no = options.find(o => /no/i.test(o));
      if (no && /no|false|disagree|not/i.test(answerLower)) {
        return { ...answer, answer: no, confidence: 0.8 };
      }
    }

    return { ...answer, needsReview: true, confidence: Math.min(answer.confidence, 0.5) };
  }

  /**
   * Simple word-overlap similarity between two strings.
   */
  private similarityScore(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/).filter(Boolean));
    const wordsB = new Set(b.split(/\s+/).filter(Boolean));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }
    return overlap / Math.max(wordsA.size, wordsB.size);
  }

  /**
   * Computes approximate years of experience with a specific skill/technology.
   */
  private computeSkillYears(skillName: string, profile: any): string {
    let totalMonths = 0;
    const experiences = profile.experiences || [];

    for (const exp of experiences) {
      const techList = safeParseArray(exp.technologies).map((t: string) => t.toLowerCase());
      const skillList = safeParseArray(exp.skills).map((s: string) => s.toLowerCase());
      const descLower = (exp.description || "").toLowerCase();

      if (techList.includes(skillName) || skillList.includes(skillName) || descLower.includes(skillName)) {
        const months = this.estimateMonths(exp.startDate, exp.endDate);
        totalMonths += months;
      }
    }

    // Also check projects (count as 3 months each)
    const projects = profile.projects || [];
    for (const proj of projects) {
      const techList = safeParseArray(proj.technologies).map((t: string) => t.toLowerCase());
      if (techList.includes(skillName)) {
        totalMonths += 3;
      }
    }

    const years = Math.round(totalMonths / 12);
    if (years === 0 && totalMonths > 0) return "Less than 1 year";
    if (years === 0) return "Familiar through projects";
    return `${years} year${years > 1 ? "s" : ""}`;
  }

  /**
   * Computes a skill proficiency rating (1-10) based on verified evidence.
   */
  private computeSkillRating(skillName: string, profile: any): number {
    let score = 3; // Base: self-reported

    const skills = (profile.skills || []).map((s: any) => s.name.toLowerCase());
    if (skills.includes(skillName)) score += 2; // Verified skill

    const experiences = profile.experiences || [];
    for (const exp of experiences) {
      const techList = safeParseArray(exp.technologies).map((t: string) => t.toLowerCase());
      if (techList.includes(skillName)) {
        score += 2; // Used professionally
        break;
      }
    }

    const projects = profile.projects || [];
    for (const proj of projects) {
      const techList = safeParseArray(proj.technologies).map((t: string) => t.toLowerCase());
      if (techList.includes(skillName)) {
        score += 1; // Project evidence
        break;
      }
    }

    return Math.min(score, 9); // Cap at 9 — never claim "expert" automatically
  }

  /**
   * Estimates months between two date strings (e.g., "Jan 2024" to "Present").
   */
  private estimateMonths(startDate: string, endDate: string): number {
    try {
      const start = new Date(startDate);
      const end = endDate === "Present" ? new Date() : new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 6; // Default guess
      return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    } catch {
      return 6;
    }
  }

  /**
   * Tries to find a matching pre-approved standard answer.
   */
  private matchStandardAnswer(
    questionLower: string,
    standardAnswers: Array<{ questionPattern: string; category: string; answer: string; priority: number }>
  ): string | null {
    const matches = standardAnswers.filter(sa => {
      try {
        const regex = new RegExp(sa.questionPattern, "i");
        return regex.test(questionLower);
      } catch {
        // Fallback: simple keyword matching
        return sa.questionPattern.split("|").some(kw => questionLower.includes(kw.trim().toLowerCase()));
      }
    });

    if (matches.length === 0) return null;
    matches.sort((a, b) => b.priority - a.priority);
    return matches[0].answer;
  }

  /**
   * Creates a standardized answer result.
   */
  private result(
    q: FormQuestion,
    answer: string,
    category: QuestionCategory,
    confidence: number,
    source: string
  ): AnsweredQuestion {
    return {
      question: q.question,
      answer,
      category,
      confidence,
      source,
      needsReview: confidence < 0.7,
    };
  }
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function safeParseArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val) {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}
