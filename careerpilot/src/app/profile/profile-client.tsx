"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  GraduationCap,
  Briefcase,
  FolderKanban,
  Wrench,
  Trophy,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";

type Tab = "personal" | "education" | "experience" | "projects" | "skills" | "achievements";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "personal", label: "Personal Info", icon: User },
  { key: "education", label: "Education", icon: GraduationCap },
  { key: "experience", label: "Experience", icon: Briefcase },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "skills", label: "Skills", icon: Wrench },
  { key: "achievements", label: "Achievements", icon: Trophy },
];

interface ProfileProps {
  profile: any;
  userId: string;
}

export function ProfileClient({ profile, userId }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  // Personal info state
  const [personal, setPersonal] = useState({
    fullName: profile?.fullName || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    location: profile?.location || "",
    linkedinUrl: profile?.linkedinUrl || "",
    githubUrl: profile?.githubUrl || "",
    portfolioUrl: profile?.portfolioUrl || "",
    summary: profile?.summary || "",
  });

  // Education state
  const [educations, setEducations] = useState(
    profile?.education || []
  );

  // Experience state
  const [experiences, setExperiences] = useState(
    profile?.experiences?.map((e: any) => ({
      ...e,
      technologies: safeParseArray(e.technologies),
      skills: safeParseArray(e.skills),
      domains: safeParseArray(e.domains),
    })) || []
  );

  // Projects state
  const [projects, setProjects] = useState(
    profile?.projects?.map((p: any) => ({
      ...p,
      technologies: safeParseArray(p.technologies),
      skills: safeParseArray(p.skills),
      domains: safeParseArray(p.domains),
    })) || []
  );

  // Skills state
  const [skills, setSkills] = useState(profile?.skills || []);

  // Achievements state
  const [achievements, setAchievements] = useState(profile?.achievements || []);

  async function saveProfile() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personal,
          educations,
          experiences: experiences.map((e: any) => ({
            ...e,
            technologies: JSON.stringify(e.technologies || []),
            skills: JSON.stringify(e.skills || []),
            domains: JSON.stringify(e.domains || []),
          })),
          projects: projects.map((p: any) => ({
            ...p,
            technologies: JSON.stringify(p.technologies || []),
            skills: JSON.stringify(p.skills || []),
            domains: JSON.stringify(p.domains || []),
          })),
          skills,
          achievements,
        }),
      });
      if (res.ok) {
        setMessage("Profile saved successfully");
        router.refresh();
      } else {
        setMessage("Error saving profile");
      }
    } catch {
      setMessage("Connection error");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Master Career Database
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
            Your verified career information — the source of truth for all generated resumes
          </p>
        </div>
        <button onClick={saveProfile} className="btn btn-primary" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Changes
        </button>
      </div>

      {/* Toast */}
      {message && (
        <div className="toast">{message}</div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--color-border-default)" }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-500 text-white"
                  : "border-transparent hover:text-zinc-300"
              }`}
              style={!isActive ? { color: "oklch(0.55 0.01 260)" } : undefined}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="card p-6">
        {activeTab === "personal" && (
          <PersonalInfoForm personal={personal} setPersonal={setPersonal} />
        )}
        {activeTab === "education" && (
          <EducationForm educations={educations} setEducations={setEducations} />
        )}
        {activeTab === "experience" && (
          <ExperienceForm experiences={experiences} setExperiences={setExperiences} />
        )}
        {activeTab === "projects" && (
          <ProjectsForm projects={projects} setProjects={setProjects} />
        )}
        {activeTab === "skills" && (
          <SkillsForm skills={skills} setSkills={setSkills} />
        )}
        {activeTab === "achievements" && (
          <AchievementsForm achievements={achievements} setAchievements={setAchievements} />
        )}
      </div>
    </div>
  );
}

// ═══ PERSONAL INFO ═══
function PersonalInfoForm({ personal, setPersonal }: { personal: any; setPersonal: any }) {
  const update = (field: string, value: string) =>
    setPersonal((p: any) => ({ ...p, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Full Name</label>
          <input className="input" value={personal.fullName} onChange={(e) => update("fullName", e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={personal.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={personal.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={personal.location} onChange={(e) => update("location", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">
            <LinkIcon className="w-3 h-3 inline mr-1" />LinkedIn URL
          </label>
          <input className="input" value={personal.linkedinUrl} onChange={(e) => update("linkedinUrl", e.target.value)} />
        </div>
        <div>
          <label className="label">
            <LinkIcon className="w-3 h-3 inline mr-1" />GitHub URL
          </label>
          <input className="input" value={personal.githubUrl} onChange={(e) => update("githubUrl", e.target.value)} />
        </div>
        <div>
          <label className="label">
            <LinkIcon className="w-3 h-3 inline mr-1" />Portfolio URL
          </label>
          <input className="input" value={personal.portfolioUrl} onChange={(e) => update("portfolioUrl", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Professional Summary</label>
        <textarea
          className="textarea"
          rows={3}
          value={personal.summary}
          onChange={(e) => update("summary", e.target.value)}
          placeholder="Brief professional summary for cover letters..."
        />
      </div>
    </div>
  );
}

// ═══ EDUCATION ═══
function EducationForm({ educations, setEducations }: { educations: any[]; setEducations: any }) {
  const addEducation = () =>
    setEducations((prev: any[]) => [
      ...prev,
      { id: `new-${Date.now()}`, degree: "", specialization: "", university: "", graduationDate: "", cgpa: "", coursework: "" },
    ]);

  const update = (index: number, field: string, value: string) =>
    setEducations((prev: any[]) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));

  const remove = (index: number) =>
    setEducations((prev: any[]) => prev.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      {educations.map((edu: any, i: number) => (
        <div key={edu.id || i} className="p-4 rounded-lg space-y-3" style={{ background: "var(--color-surface-0)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "oklch(0.50 0.01 260)" }}>
              Education #{i + 1}
            </span>
            <button onClick={() => remove(i)} className="btn btn-ghost btn-sm text-red-400 hover:text-red-300">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Degree</label>
              <input className="input" value={edu.degree} onChange={(e) => update(i, "degree", e.target.value)} placeholder="B.Tech" />
            </div>
            <div>
              <label className="label">Specialization</label>
              <input className="input" value={edu.specialization} onChange={(e) => update(i, "specialization", e.target.value)} placeholder="Robotics & AI" />
            </div>
            <div>
              <label className="label">University</label>
              <input className="input" value={edu.university} onChange={(e) => update(i, "university", e.target.value)} />
            </div>
            <div>
              <label className="label">Graduation Date</label>
              <input className="input" value={edu.graduationDate} onChange={(e) => update(i, "graduationDate", e.target.value)} placeholder="May 2026" />
            </div>
            <div>
              <label className="label">CGPA</label>
              <input className="input" value={edu.cgpa} onChange={(e) => update(i, "cgpa", e.target.value)} />
            </div>
            <div>
              <label className="label">Relevant Coursework</label>
              <input className="input" value={edu.coursework} onChange={(e) => update(i, "coursework", e.target.value)} placeholder="Comma-separated courses" />
            </div>
          </div>
        </div>
      ))}
      <button onClick={addEducation} className="btn btn-secondary w-full">
        <Plus className="w-4 h-4" />
        Add Education
      </button>
    </div>
  );
}

// ═══ EXPERIENCE ═══
function ExperienceForm({ experiences, setExperiences }: { experiences: any[]; setExperiences: any }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const addExperience = () =>
    setExperiences((prev: any[]) => [
      ...prev,
      {
        id: `new-${Date.now()}`, company: "", role: "", startDate: "", endDate: "Present",
        location: "", employmentType: "", description: "", technologies: [], skills: [], domains: [],
        bullets: [],
      },
    ]);

  const update = (index: number, field: string, value: any) =>
    setExperiences((prev: any[]) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));

  const remove = (index: number) =>
    setExperiences((prev: any[]) => prev.filter((_, i) => i !== index));

  const addBullet = (expIndex: number) =>
    update(expIndex, "bullets", [
      ...(experiences[expIndex].bullets || []),
      { id: `new-${Date.now()}`, content: "", isVerified: true, sortOrder: experiences[expIndex].bullets?.length || 0 },
    ]);

  const updateBullet = (expIndex: number, bulletIndex: number, content: string) => {
    const bullets = [...experiences[expIndex].bullets];
    bullets[bulletIndex] = { ...bullets[bulletIndex], content };
    update(expIndex, "bullets", bullets);
  };

  const removeBullet = (expIndex: number, bulletIndex: number) => {
    const bullets = experiences[expIndex].bullets.filter((_: any, i: number) => i !== bulletIndex);
    update(expIndex, "bullets", bullets);
  };

  return (
    <div className="space-y-3">
      {experiences.map((exp: any, i: number) => (
        <div key={exp.id || i} className="rounded-lg overflow-hidden" style={{ background: "var(--color-surface-0)" }}>
          <button
            onClick={() => toggle(i)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              {expanded.has(i) ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-zinc-500" /> : <ChevronRight className="w-4 h-4 flex-shrink-0 text-zinc-500" />}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{exp.role || "New Experience"}</p>
                <p className="text-xs truncate" style={{ color: "oklch(0.55 0.01 260)" }}>{exp.company} {exp.startDate && `• ${exp.startDate} – ${exp.endDate}`}</p>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); remove(i); }} className="btn btn-ghost btn-sm text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </button>

          {expanded.has(i) && (
            <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--color-border-default)" }}>
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div>
                  <label className="label">Company</label>
                  <input className="input" value={exp.company} onChange={(e) => update(i, "company", e.target.value)} />
                </div>
                <div>
                  <label className="label">Role</label>
                  <input className="input" value={exp.role} onChange={(e) => update(i, "role", e.target.value)} />
                </div>
                <div>
                  <label className="label">Start Date</label>
                  <input className="input" value={exp.startDate} onChange={(e) => update(i, "startDate", e.target.value)} placeholder="Jan 2024" />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input className="input" value={exp.endDate} onChange={(e) => update(i, "endDate", e.target.value)} placeholder="Present" />
                </div>
                <div>
                  <label className="label">Location</label>
                  <input className="input" value={exp.location} onChange={(e) => update(i, "location", e.target.value)} />
                </div>
                <div>
                  <label className="label">Employment Type</label>
                  <select className="input" value={exp.employmentType} onChange={(e) => update(i, "employmentType", e.target.value)}>
                    <option value="">Select...</option>
                    <option value="full-time">Full-time</option>
                    <option value="internship">Internship</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="leadership">Leadership</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Technologies (comma-separated)</label>
                <input
                  className="input"
                  value={Array.isArray(exp.technologies) ? exp.technologies.join(", ") : ""}
                  onChange={(e) => update(i, "technologies", e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean))}
                />
              </div>
              <div>
                <label className="label">Domains (comma-separated)</label>
                <input
                  className="input"
                  value={Array.isArray(exp.domains) ? exp.domains.join(", ") : ""}
                  onChange={(e) => update(i, "domains", e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean))}
                />
              </div>

              {/* Bullet Bank */}
              <div>
                <label className="label">Verified Bullet Points</label>
                <div className="space-y-2">
                  {(exp.bullets || []).map((bullet: any, bi: number) => (
                    <div key={bullet.id || bi} className="flex items-start gap-2">
                      <span className="text-xs mt-2.5 text-zinc-600 select-none">•</span>
                      <textarea
                        className="textarea !min-h-[2.5rem]"
                        rows={2}
                        value={bullet.content}
                        onChange={(e) => updateBullet(i, bi, e.target.value)}
                        placeholder="Describe what you did, technology used, and impact..."
                      />
                      <button onClick={() => removeBullet(i, bi)} className="btn btn-ghost btn-sm text-red-400 mt-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addBullet(i)} className="btn btn-secondary btn-sm w-full">
                    <Plus className="w-3 h-3" />
                    Add Bullet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      <button onClick={addExperience} className="btn btn-secondary w-full">
        <Plus className="w-4 h-4" />
        Add Experience
      </button>
    </div>
  );
}

// ═══ PROJECTS ═══
function ProjectsForm({ projects, setProjects }: { projects: any[]; setProjects: any }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const addProject = () =>
    setProjects((prev: any[]) => [
      ...prev,
      {
        id: `new-${Date.now()}`, projectName: "", description: "", technologies: [],
        skills: [], domains: [], githubUrl: "", demoUrl: "", bullets: [],
      },
    ]);

  const update = (index: number, field: string, value: any) =>
    setProjects((prev: any[]) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));

  const remove = (index: number) =>
    setProjects((prev: any[]) => prev.filter((_, i) => i !== index));

  const addBullet = (projIndex: number) =>
    update(projIndex, "bullets", [
      ...(projects[projIndex].bullets || []),
      { id: `new-${Date.now()}`, content: "", isVerified: true, sortOrder: projects[projIndex].bullets?.length || 0 },
    ]);

  const updateBullet = (projIndex: number, bulletIndex: number, content: string) => {
    const bullets = [...projects[projIndex].bullets];
    bullets[bulletIndex] = { ...bullets[bulletIndex], content };
    update(projIndex, "bullets", bullets);
  };

  const removeBullet = (projIndex: number, bulletIndex: number) => {
    const bullets = projects[projIndex].bullets.filter((_: any, i: number) => i !== bulletIndex);
    update(projIndex, "bullets", bullets);
  };

  return (
    <div className="space-y-3">
      {projects.map((proj: any, i: number) => (
        <div key={proj.id || i} className="rounded-lg overflow-hidden" style={{ background: "var(--color-surface-0)" }}>
          <button
            onClick={() => toggle(i)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              {expanded.has(i) ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-zinc-500" /> : <ChevronRight className="w-4 h-4 flex-shrink-0 text-zinc-500" />}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{proj.projectName || "New Project"}</p>
                <p className="text-xs truncate" style={{ color: "oklch(0.55 0.01 260)" }}>
                  {Array.isArray(proj.technologies) ? proj.technologies.slice(0, 4).join(" • ") : ""}
                </p>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); remove(i); }} className="btn btn-ghost btn-sm text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </button>

          {expanded.has(i) && (
            <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--color-border-default)" }}>
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div className="col-span-2">
                  <label className="label">Project Name</label>
                  <input className="input" value={proj.projectName} onChange={(e) => update(i, "projectName", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <textarea className="textarea" rows={2} value={proj.description} onChange={(e) => update(i, "description", e.target.value)} />
                </div>
                <div>
                  <label className="label">GitHub URL</label>
                  <input className="input" value={proj.githubUrl} onChange={(e) => update(i, "githubUrl", e.target.value)} />
                </div>
                <div>
                  <label className="label">Demo URL</label>
                  <input className="input" value={proj.demoUrl} onChange={(e) => update(i, "demoUrl", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Technologies (comma-separated)</label>
                <input
                  className="input"
                  value={Array.isArray(proj.technologies) ? proj.technologies.join(", ") : ""}
                  onChange={(e) => update(i, "technologies", e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean))}
                />
              </div>
              <div>
                <label className="label">Domains (comma-separated)</label>
                <input
                  className="input"
                  value={Array.isArray(proj.domains) ? proj.domains.join(", ") : ""}
                  onChange={(e) => update(i, "domains", e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean))}
                />
              </div>

              {/* Bullet Bank */}
              <div>
                <label className="label">Verified Bullet Points</label>
                <div className="space-y-2">
                  {(proj.bullets || []).map((bullet: any, bi: number) => (
                    <div key={bullet.id || bi} className="flex items-start gap-2">
                      <span className="text-xs mt-2.5 text-zinc-600 select-none">•</span>
                      <textarea
                        className="textarea !min-h-[2.5rem]"
                        rows={2}
                        value={bullet.content}
                        onChange={(e) => updateBullet(i, bi, e.target.value)}
                        placeholder="Describe feature/component, technology used, and measurable result..."
                      />
                      <button onClick={() => removeBullet(i, bi)} className="btn btn-ghost btn-sm text-red-400 mt-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addBullet(i)} className="btn btn-secondary btn-sm w-full">
                    <Plus className="w-3 h-3" />
                    Add Bullet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      <button onClick={addProject} className="btn btn-secondary w-full">
        <Plus className="w-4 h-4" />
        Add Project
      </button>
    </div>
  );
}

// ═══ SKILLS ═══
function SkillsForm({ skills, setSkills }: { skills: any[]; setSkills: any }) {
  const categories = ["Programming", "AI & ML", "Robotics", "Web & Frameworks", "Tools & Platforms", "Soft Skills", "Other"];

  const addSkill = () =>
    setSkills((prev: any[]) => [
      ...prev,
      { id: `new-${Date.now()}`, name: "", category: "Programming", evidenceLevel: "verified" },
    ]);

  const update = (index: number, field: string, value: string) =>
    setSkills((prev: any[]) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));

  const remove = (index: number) =>
    setSkills((prev: any[]) => prev.filter((_, i) => i !== index));

  // Group by category
  const grouped = categories.reduce((acc: Record<string, any[]>, cat) => {
    acc[cat] = skills.filter((s: any) => s.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: "oklch(0.50 0.01 260)" }}>
        Skills are evidence-based — credibility is determined by actual projects and work experience, not self-assessment ratings.
      </p>

      {categories.map((cat) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "oklch(0.55 0.01 260)" }}>
            {cat}
          </h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {grouped[cat]?.map((skill: any) => {
              const idx = skills.indexOf(skill);
              return (
                <div
                  key={skill.id || idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                  style={{ background: "var(--color-surface-0)", border: "1px solid var(--color-border-default)" }}
                >
                  <input
                    className="bg-transparent border-none outline-none text-white w-24 text-xs"
                    value={skill.name}
                    onChange={(e) => update(idx, "name", e.target.value)}
                    placeholder="Skill name"
                  />
                  <button onClick={() => remove(idx)} className="text-zinc-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <select
          id="new-skill-category"
          className="input !w-auto"
          defaultValue="Programming"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={() => {
            const select = document.getElementById("new-skill-category") as HTMLSelectElement;
            setSkills((prev: any[]) => [
              ...prev,
              { id: `new-${Date.now()}`, name: "", category: select.value, evidenceLevel: "verified" },
            ]);
          }}
          className="btn btn-secondary btn-sm"
        >
          <Plus className="w-3 h-3" />
          Add Skill
        </button>
      </div>
    </div>
  );
}

// ═══ ACHIEVEMENTS ═══
function AchievementsForm({ achievements, setAchievements }: { achievements: any[]; setAchievements: any }) {
  const addAchievement = () =>
    setAchievements((prev: any[]) => [
      ...prev,
      { id: `new-${Date.now()}`, title: "", category: "award", organization: "", date: "", description: "", link: "" },
    ]);

  const update = (index: number, field: string, value: string) =>
    setAchievements((prev: any[]) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));

  const remove = (index: number) =>
    setAchievements((prev: any[]) => prev.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      {achievements.map((ach: any, i: number) => (
        <div key={ach.id || i} className="p-4 rounded-lg space-y-3" style={{ background: "var(--color-surface-0)" }}>
          <div className="flex items-center justify-between">
            <select className="input !w-auto text-xs" value={ach.category} onChange={(e) => update(i, "category", e.target.value)}>
              <option value="award">Award</option>
              <option value="hackathon">Hackathon</option>
              <option value="certification">Certification</option>
              <option value="leadership">Leadership</option>
              <option value="publication">Publication</option>
              <option value="competition">Competition</option>
            </select>
            <button onClick={() => remove(i)} className="btn btn-ghost btn-sm text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Title</label>
              <input className="input" value={ach.title} onChange={(e) => update(i, "title", e.target.value)} />
            </div>
            <div>
              <label className="label">Organization</label>
              <input className="input" value={ach.organization} onChange={(e) => update(i, "organization", e.target.value)} />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" value={ach.date} onChange={(e) => update(i, "date", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="textarea" rows={2} value={ach.description} onChange={(e) => update(i, "description", e.target.value)} />
            </div>
          </div>
        </div>
      ))}
      <button onClick={addAchievement} className="btn btn-secondary w-full">
        <Plus className="w-4 h-4" />
        Add Achievement
      </button>
    </div>
  );
}

// ═══ HELPERS ═══
function safeParseArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val) {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}
