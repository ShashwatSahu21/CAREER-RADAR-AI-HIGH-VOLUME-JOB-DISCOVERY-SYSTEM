import { Zap, Bot, ShieldCheck, FileCheck, Mail, CheckCircle } from "lucide-react";

export default function PipelinePage() {
  const agents = [
    { num: 1, name: "Job Parser Agent", desc: "Extracts structured requirements, tech stack, and seniority from raw posting." },
    { num: 2, name: "Role Classifier Agent", desc: "Classifies role into 16 categories & maps to Robotics, Software, or Product track." },
    { num: 3, name: "Match Engine Agent", desc: "Calculates granular 0-100 match score across 6 weighted factors." },
    { num: 4, name: "Resume Router Agent", desc: "Selects best base resume template & content strategy." },
    { num: 5, name: "Content Selector Agent", desc: "Picks top relevant experiences and projects from Master Career Database." },
    { num: 6, name: "ATS Optimizer Agent", desc: "Verifies evidence for ATS keywords to ensure 100% truthfulness." },
    { num: 7, name: "Resume Writer Agent", desc: "Generates tailored bullet points using ACTION VERB + WHAT + TECH + IMPACT formula." },
    { num: 8, name: "Claim Validator Agent", desc: "Strict Guardrail: Verifies every single generated bullet against verified source data." },
    { num: 9, name: "Quality Control Agent", desc: "Checks 1-page height constraint, ATS formatting, bullet density & verb repetition." },
    { num: 10, name: "Cover Letter Generator", desc: "Creates personalized cover/intent letter with custom opening hook." },
    { num: 11, name: "Document Package Generator", desc: "Renders ATS-compliant DOCX and converts to high-fidelity PDF." },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-400" />
          11-Agent AI Pipeline Architecture
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
          Modular agent orchestration pipeline ensuring precision, ATS alignment, and 100% truthful data traceability
        </p>
      </div>

      <div className="space-y-3">
        {agents.map((a) => (
          <div key={a.num} className="card p-4 flex items-center gap-4 hover:border-blue-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0 text-sm font-mono">
              #{a.num}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {a.name}
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">{a.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
