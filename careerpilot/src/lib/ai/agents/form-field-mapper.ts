import { LLMProvider } from "../provider";
import { QuestionCategory, FormQuestion, FormAnswerAgent } from "./form-answer-agent";

// ═══════════════════════════════════════
// FORM FIELD EXTRACTION TYPES
// ═══════════════════════════════════════

export interface ExtractedFormField {
  fieldName: string;         // DOM name or id attribute
  label: string;             // Visible label text
  inputType: string;         // text, email, tel, textarea, select, radio, checkbox, file, number, date, url
  placeholder: string;       // Placeholder text
  options: string[];         // Options for select/radio/checkbox
  required: boolean;         // Whether the field is required
  ariaLabel?: string;        // ARIA label if present
  autocomplete?: string;     // HTML autocomplete attribute
  maxLength?: number;        // Maximum character length
  pattern?: string;          // Validation pattern
}

export interface MappedFormField {
  fieldName: string;
  label: string;
  category: QuestionCategory;
  suggestedValue: string;
  confidence: number;
  inputType: string;
  options: string[];
  required: boolean;
}

// ═══════════════════════════════════════
// DETERMINISTIC FIELD MAPPING RULES
// ═══════════════════════════════════════

interface FieldMappingRule {
  category: QuestionCategory;
  fieldPatterns: RegExp[];       // Match against fieldName
  labelPatterns: RegExp[];       // Match against label text
  autocompleteValues: string[];  // Match against autocomplete attribute
  profileKey: string;            // Key in candidate profile to pull value from
}

const FIELD_MAPPING_RULES: FieldMappingRule[] = [
  // Personal Info
  {
    category: "PERSONAL_INFO",
    fieldPatterns: [/first.?name/i, /fname/i, /given.?name/i],
    labelPatterns: [/first\s*name/i, /given\s*name/i],
    autocompleteValues: ["given-name"],
    profileKey: "firstName",
  },
  {
    category: "PERSONAL_INFO",
    fieldPatterns: [/last.?name/i, /lname/i, /surname/i, /family.?name/i],
    labelPatterns: [/last\s*name/i, /surname/i, /family\s*name/i],
    autocompleteValues: ["family-name"],
    profileKey: "lastName",
  },
  {
    category: "PERSONAL_INFO",
    fieldPatterns: [/full.?name/i, /^name$/i, /candidate.?name/i, /applicant.?name/i],
    labelPatterns: [/full\s*name/i, /^name$/i, /your\s*name/i],
    autocompleteValues: ["name"],
    profileKey: "fullName",
  },
  {
    category: "PERSONAL_INFO",
    fieldPatterns: [/email/i, /e.?mail/i],
    labelPatterns: [/email/i, /e-?mail/i],
    autocompleteValues: ["email"],
    profileKey: "email",
  },
  {
    category: "PERSONAL_INFO",
    fieldPatterns: [/phone/i, /tel/i, /mobile/i, /contact.?number/i],
    labelPatterns: [/phone/i, /mobile/i, /telephone/i, /contact\s*number/i],
    autocompleteValues: ["tel"],
    profileKey: "phone",
  },
  {
    category: "PERSONAL_INFO",
    fieldPatterns: [/city/i, /location/i],
    labelPatterns: [/city/i, /current\s*location/i],
    autocompleteValues: ["address-level2"],
    profileKey: "location",
  },

  // Portfolio / Links
  {
    category: "PORTFOLIO",
    fieldPatterns: [/linkedin/i, /linked.?in/i],
    labelPatterns: [/linkedin/i],
    autocompleteValues: [],
    profileKey: "linkedinUrl",
  },
  {
    category: "PORTFOLIO",
    fieldPatterns: [/github/i, /git.?hub/i],
    labelPatterns: [/github/i],
    autocompleteValues: [],
    profileKey: "githubUrl",
  },
  {
    category: "PORTFOLIO",
    fieldPatterns: [/portfolio/i, /website/i, /personal.?url/i, /^url$/i],
    labelPatterns: [/portfolio/i, /personal\s*website/i, /website/i],
    autocompleteValues: ["url"],
    profileKey: "portfolioUrl",
  },

  // Salary
  {
    category: "SALARY",
    fieldPatterns: [/salary/i, /ctc/i, /compensation/i, /expected.?pay/i],
    labelPatterns: [/salary/i, /ctc/i, /compensation/i, /package/i],
    autocompleteValues: [],
    profileKey: "expectedCTC",
  },

  // Notice Period
  {
    category: "NOTICE_PERIOD",
    fieldPatterns: [/notice/i, /notice.?period/i],
    labelPatterns: [/notice\s*period/i],
    autocompleteValues: [],
    profileKey: "noticePeriod",
  },

  // Experience Years
  {
    category: "EXPERIENCE_YEARS",
    fieldPatterns: [/experience/i, /years.?exp/i, /total.?exp/i],
    labelPatterns: [/years?\s*of\s*experience/i, /total\s*experience/i],
    autocompleteValues: [],
    profileKey: "yearsOfExperience",
  },

  // Education
  {
    category: "EDUCATION",
    fieldPatterns: [/degree/i, /qualification/i],
    labelPatterns: [/degree/i, /highest\s*qualification/i],
    autocompleteValues: [],
    profileKey: "education_degree",
  },
  {
    category: "EDUCATION",
    fieldPatterns: [/university/i, /college/i, /school/i, /institution/i],
    labelPatterns: [/university/i, /college/i, /institution/i],
    autocompleteValues: [],
    profileKey: "education_university",
  },

  // Authorization
  {
    category: "AUTHORIZATION",
    fieldPatterns: [/authorization/i, /visa/i, /sponsor/i, /eligible/i, /work.?permit/i],
    labelPatterns: [/work\s*authorization/i, /visa/i, /eligible\s*to\s*work/i],
    autocompleteValues: [],
    profileKey: "workAuthorization",
  },

  // Relocation
  {
    category: "RELOCATION",
    fieldPatterns: [/reloca/i, /willing.?to.?move/i],
    labelPatterns: [/relocat/i, /willing\s*to\s*move/i],
    autocompleteValues: [],
    profileKey: "willingToRelocate",
  },

  // EEO
  {
    category: "EEO",
    fieldPatterns: [/gender/i, /sex/i, /pronouns/i],
    labelPatterns: [/gender/i, /sex/i, /pronouns/i],
    autocompleteValues: ["sex"],
    profileKey: "gender",
  },
  {
    category: "EEO",
    fieldPatterns: [/veteran/i],
    labelPatterns: [/veteran/i, /military/i],
    autocompleteValues: [],
    profileKey: "veteranStatus",
  },
  {
    category: "EEO",
    fieldPatterns: [/disability/i, /handicap/i],
    labelPatterns: [/disability/i, /handicap/i],
    autocompleteValues: [],
    profileKey: "disabilityStatus",
  },

  // Referral
  {
    category: "REFERRAL",
    fieldPatterns: [/referr/i, /how.?did.?you/i, /source/i, /hear.?about/i],
    labelPatterns: [/how\s*did\s*you/i, /referr/i, /hear\s*about/i],
    autocompleteValues: [],
    profileKey: "referralSource",
  },

  // Cover Letter
  {
    category: "COVER_LETTER",
    fieldPatterns: [/cover.?letter/i, /letter.?of.?intent/i],
    labelPatterns: [/cover\s*letter/i],
    autocompleteValues: [],
    profileKey: "coverLetter",
  },
];

// ═══════════════════════════════════════
// FORM FIELD MAPPER AGENT
// ═══════════════════════════════════════

export class FormFieldMapperAgent {
  private formAnswerAgent: FormAnswerAgent;

  constructor(private provider: LLMProvider) {
    this.formAnswerAgent = new FormAnswerAgent(provider);
  }

  /**
   * Maps a list of extracted form fields to candidate profile values.
   * Uses deterministic rules first, then falls back to AI classification for unknown fields.
   */
  async mapFields(
    fields: ExtractedFormField[],
    candidateProfile: any,
    parsedJob: any,
    standardAnswers: any[],
    coverLetterContent?: string
  ): Promise<MappedFormField[]> {
    const results: MappedFormField[] = [];
    const unmappedFields: ExtractedFormField[] = [];

    // Phase 1: Deterministic mapping
    for (const field of fields) {
      const mapping = this.deterministicMap(field, candidateProfile);
      if (mapping) {
        results.push(mapping);
      } else {
        unmappedFields.push(field);
      }
    }

    // Phase 2: AI mapping for unmapped fields
    if (unmappedFields.length > 0) {
      const formQuestions: FormQuestion[] = unmappedFields.map(f => ({
        question: f.label || f.placeholder || f.ariaLabel || f.fieldName,
        inputType: this.normalizeInputType(f.inputType),
        options: f.options,
        required: f.required,
        fieldName: f.fieldName,
      }));

      const aiAnswers = await this.formAnswerAgent.answerQuestions(
        formQuestions,
        candidateProfile,
        parsedJob,
        standardAnswers,
        coverLetterContent
      );

      for (let i = 0; i < unmappedFields.length; i++) {
        const field = unmappedFields[i];
        const answer = aiAnswers[i];
        results.push({
          fieldName: field.fieldName,
          label: field.label,
          category: answer.category,
          suggestedValue: answer.answer,
          confidence: answer.confidence,
          inputType: field.inputType,
          options: field.options,
          required: field.required,
        });
      }
    }

    return results;
  }

  /**
   * Attempts to map a form field using deterministic rules.
   * Returns null if no rule matches with sufficient confidence.
   */
  private deterministicMap(field: ExtractedFormField, profile: any): MappedFormField | null {
    for (const rule of FIELD_MAPPING_RULES) {
      let matched = false;

      // Check field name patterns
      if (field.fieldName && rule.fieldPatterns.some(p => p.test(field.fieldName))) {
        matched = true;
      }

      // Check label patterns
      if (!matched && field.label && rule.labelPatterns.some(p => p.test(field.label))) {
        matched = true;
      }

      // Check autocomplete attribute
      if (!matched && field.autocomplete && rule.autocompleteValues.includes(field.autocomplete)) {
        matched = true;
      }

      // Check placeholder as fallback
      if (!matched && field.placeholder && rule.labelPatterns.some(p => p.test(field.placeholder))) {
        matched = true;
      }

      if (matched) {
        const value = this.resolveProfileValue(rule.profileKey, profile);
        return {
          fieldName: field.fieldName,
          label: field.label,
          category: rule.category,
          suggestedValue: value,
          confidence: value ? 0.95 : 0.5,
          inputType: field.inputType,
          options: field.options,
          required: field.required,
        };
      }
    }

    // Check if it's a file upload (resume/cover letter)
    if (field.inputType === "file") {
      const label = (field.label || field.fieldName || "").toLowerCase();
      if (/resume|cv|curriculum/i.test(label)) {
        return {
          fieldName: field.fieldName,
          label: field.label,
          category: "PERSONAL_INFO",
          suggestedValue: "__UPLOAD_RESUME__",
          confidence: 0.95,
          inputType: field.inputType,
          options: field.options,
          required: field.required,
        };
      }
      if (/cover/i.test(label)) {
        return {
          fieldName: field.fieldName,
          label: field.label,
          category: "COVER_LETTER",
          suggestedValue: "__UPLOAD_COVER_LETTER__",
          confidence: 0.95,
          inputType: field.inputType,
          options: field.options,
          required: field.required,
        };
      }
      if (/photo|picture|headshot|passport/i.test(label)) {
        return {
          fieldName: field.fieldName,
          label: field.label,
          category: "PERSONAL_INFO",
          suggestedValue: "__UPLOAD_PHOTO__",
          confidence: 0.9,
          inputType: field.inputType,
          options: field.options,
          required: field.required,
        };
      }
    }

    return null;
  }

  /**
   * Resolves a value from the candidate profile given a mapping key.
   */
  private resolveProfileValue(key: string, profile: any): string {
    // Handle special compound keys
    if (key === "firstName") {
      const names = (profile.fullName || "").split(" ");
      return names[0] || "";
    }
    if (key === "lastName") {
      const names = (profile.fullName || "").split(" ");
      return names.slice(1).join(" ") || "";
    }
    if (key === "education_degree") {
      const edu = (profile.education || [])[0];
      return edu ? `${edu.degree} in ${edu.specialization}` : "";
    }
    if (key === "education_university") {
      const edu = (profile.education || [])[0];
      return edu?.university || "";
    }
    if (key === "willingToRelocate") {
      return profile.willingToRelocate !== false ? "Yes" : "No";
    }
    if (key === "referralSource") {
      return "Job Board / Online Search";
    }
    if (key === "coverLetter") {
      return ""; // Will be filled by the caller
    }

    // Direct profile field lookup
    return profile[key] || "";
  }

  /**
   * Normalizes HTML input types to the FormQuestion inputType union.
   */
  private normalizeInputType(type: string): "text" | "textarea" | "select" | "radio" | "checkbox" | "file" | "number" | "date" {
    const map: Record<string, any> = {
      text: "text",
      email: "text",
      tel: "text",
      url: "text",
      password: "text",
      search: "text",
      textarea: "textarea",
      select: "select",
      "select-one": "select",
      "select-multiple": "select",
      radio: "radio",
      checkbox: "checkbox",
      file: "file",
      number: "number",
      date: "date",
      "datetime-local": "date",
      month: "date",
    };
    return map[type.toLowerCase()] || "text";
  }
}
