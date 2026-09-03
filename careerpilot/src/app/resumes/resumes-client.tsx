"use client";

import { useState } from "react";
import { FileText, Upload, Bot, Code, ShoppingBag, CheckCircle, ArrowRight } from "lucide-react";

interface ResumesClientProps {
  baseResumes: any[];
}

export function ResumesClient({ baseResumes }: ResumesClientProps) {
  const tracks = [
    {
      key: "robotics",
      title: "Robotics / Hardware Resume Base",
      description: "Optimized for Physical AI, ROS2, Mechatronics, Embedded, Computer Vision & Autonomous Systems roles.",
      icon: Bot,
      color: "text-purple-400 border-purple-500/20 bg-purple-500/10",
    },
    {
      key: "software",
      title: "Software / AI Resume Base",
      description: "Optimized for Software Engineer, Backend, Python Developer, AI/ML, LLM & Full-Stack AI roles.",
      icon: Code,
      color: "text-blue-400 border-blue-500/20 bg-blue-500/10",
    },
    {
      key: "product",
      title: "Product / Technical Product Resume Base",
      description: "Optimized for APM, Product Analyst, Technical Product Manager, Founder's Office & Product Operations.",
      icon: ShoppingBag,
      color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Base Resume Templates
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.01 260)" }}>
          Manage your 3 core track starting resumes. The AI uses these alongside your Master Career Database to generate targeted applications.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {tracks.map((t) => {
          const Icon = t.icon;
          const resume = baseResumes.find((r) => r.track === t.key);
          return (
            <div key={t.key} className="card p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${t.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {resume ? (
                    <span className="badge bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      <CheckCircle className="w-3 h-3 mr-1 inline" /> Active
                    </span>
                  ) : (
                    <span className="badge bg-zinc-800 text-zinc-500 border-zinc-700">
                      Default Database Mode
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white">{t.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{t.description}</p>
              </div>

              <div className="pt-3 border-t border-zinc-800 space-y-2">
                {resume ? (
                  <div className="text-xs text-zinc-300 font-mono flex items-center justify-between">
                    <span className="truncate">{resume.fileName}</span>
                    <span className="text-[10px] text-zinc-500">v1.0</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 italic">Using Master Career Database to generate content dynamically.</p>
                )}

                <button className="btn btn-secondary btn-sm w-full justify-center mt-2">
                  <Upload className="w-3.5 h-3.5" />
                  {resume ? "Replace Template (DOCX/PDF)" : "Upload Template (DOCX/PDF)"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
