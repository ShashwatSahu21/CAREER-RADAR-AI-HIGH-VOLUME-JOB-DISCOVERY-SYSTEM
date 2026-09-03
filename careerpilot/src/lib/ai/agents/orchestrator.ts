import { getAIProvider, LLMProvider } from "../provider";
import { JobParserAgent } from "./job-parser";
import { RoleClassifierAgent } from "./role-classifier";
import { MatchEngineAgent } from "./match-engine";
import { ResumeRouterAgent } from "./resume-router";
import { ContentSelectorAgent } from "./content-selector";
import { ATSOptimizerAgent } from "./ats-optimizer";
import { ResumeWriterAgent } from "./resume-writer";
import { ClaimValidatorAgent } from "./claim-validator";
import { QualityControllerAgent } from "./quality-controller";
import { CoverLetterGeneratorAgent } from "./cover-letter-generator";

export interface PipelineExecutionOptions {
  providerName?: string;
  apiKey?: string;
}

export class CareerPilotOrchestrator {
  private provider: LLMProvider;
  private jobParser: JobParserAgent;
  private roleClassifier: RoleClassifierAgent;
  private matchEngine: MatchEngineAgent;
  private resumeRouter: ResumeRouterAgent;
  private contentSelector: ContentSelectorAgent;
  private atsOptimizer: ATSOptimizerAgent;
  private resumeWriter: ResumeWriterAgent;
  private claimValidator: ClaimValidatorAgent;
  private qualityController: QualityControllerAgent;
  private coverLetterGenerator: CoverLetterGeneratorAgent;

  constructor(options: PipelineExecutionOptions = {}) {
    this.provider = getAIProvider(options.providerName, options.apiKey);
    this.jobParser = new JobParserAgent(this.provider);
    this.roleClassifier = new RoleClassifierAgent(this.provider);
    this.matchEngine = new MatchEngineAgent();
    this.resumeRouter = new ResumeRouterAgent();
    this.contentSelector = new ContentSelectorAgent(this.provider);
    this.atsOptimizer = new ATSOptimizerAgent();
    this.resumeWriter = new ResumeWriterAgent(this.provider);
    this.claimValidator = new ClaimValidatorAgent();
    this.qualityController = new QualityControllerAgent();
    this.coverLetterGenerator = new CoverLetterGeneratorAgent(this.provider);
  }

  /**
   * Runs Step 1: Job Analysis Pipeline
   * Job Parser → Role Classifier → Match Engine → ATS Keyword Extractor
   */
  async runJobAnalysis(
    jobTitle: string,
    company: string,
    jobDescription: string,
    location: string | undefined,
    candidateProfile: any
  ) {
    // Agent 1: Job Parser
    const parsedJob = await this.jobParser.parse(jobTitle, company, jobDescription, location);

    // Agent 2: Role Classifier
    const classification = await this.roleClassifier.classify(parsedJob);

    // Agent 3: Match Engine
    const candidateContext = {
      education: candidateProfile.education || [],
      experiences: (candidateProfile.experiences || []).map((e: any) => ({
        company: e.company,
        role: e.role,
        technologies: typeof e.technologies === "string" ? JSON.parse(e.technologies || "[]") : e.technologies || [],
        skills: typeof e.skills === "string" ? JSON.parse(e.skills || "[]") : e.skills || [],
        description: e.description,
      })),
      projects: (candidateProfile.projects || []).map((p: any) => ({
        projectName: p.projectName,
        technologies: typeof p.technologies === "string" ? JSON.parse(p.technologies || "[]") : p.technologies || [],
        skills: typeof p.skills === "string" ? JSON.parse(p.skills || "[]") : p.skills || [],
        description: p.description,
      })),
      skills: candidateProfile.skills || [],
    };

    const matchResult = this.matchEngine.calculateMatch(parsedJob, classification, candidateContext);

    // Agent 6: ATS Keyword Engine
    const keywordMappings = this.atsOptimizer.optimize(parsedJob, candidateProfile);

    // Agent 4: Resume Router
    const routingResult = this.resumeRouter.route(classification, true);

    return {
      parsedJob,
      classification,
      matchResult,
      keywordMappings,
      routingResult,
    };
  }

  /**
   * Runs Step 2: Tailored Resume & Package Pipeline
   * Content Selector → Resume Writer → Claim Validator → Quality Control → Cover Letter Generator
   */
  async runDocumentGenerationPipeline(
    parsedJob: any,
    classification: any,
    routingResult: any,
    candidateProfile: any,
    supportedKeywords: string[],
    jobMatchScore: number
  ) {
    // Agent 5: Content Selector
    const selectedPlan = await this.contentSelector.selectContent(
      parsedJob,
      candidateProfile,
      routingResult.suggested_layout
    );

    // Agent 7: Resume Writer
    const tailoredResume = await this.resumeWriter.writeTailoredResume(
      parsedJob,
      candidateProfile,
      selectedPlan,
      supportedKeywords
    );

    // Agent 8: Claim Validator (Strict Truthfulness Guardrail)
    const validationReport = this.claimValidator.validateClaims(tailoredResume, candidateProfile);

    // Agent 9: Quality Controller
    const qualityReport = this.qualityController.evaluate(
      tailoredResume,
      validationReport,
      jobMatchScore
    );

    // Agent 10: Cover Letter Generator
    const coverLetter = await this.coverLetterGenerator.generate(
      parsedJob,
      tailoredResume,
      candidateProfile.summary
    );

    return {
      selectedPlan,
      tailoredResume,
      validationReport,
      qualityReport,
      coverLetter,
    };
  }
}
