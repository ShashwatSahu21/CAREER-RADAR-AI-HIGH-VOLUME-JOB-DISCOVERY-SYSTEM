"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  User,
  FileText,
  History,
  Settings,
  FolderOpen,
  Zap,
  Globe,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Career Profile", href: "/profile", icon: User },
  { name: "Base Resumes", href: "/resumes", icon: FileText },
  { name: "Resume Versions", href: "/versions", icon: FolderOpen },
  { name: "Applications", href: "/applications", icon: History },
  { name: "Portfolio Sync", href: "/portfolio", icon: Globe },
  { name: "AI Pipeline", href: "/pipeline", icon: Zap },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r transition-all duration-300 ease-in-out ${
        collapsed ? "w-[60px]" : "w-[220px]"
      }`}
      style={{
        background: "var(--color-surface-1)",
        borderColor: "var(--color-border-default)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b" style={{ borderColor: "var(--color-border-default)" }}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold tracking-tight text-white truncate">
              CareerPilot
            </span>
            <span className="text-[10px] text-zinc-500 tracking-wide uppercase">
              AI Engine
            </span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`nav-item ${active ? "active" : ""}`}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="nav-icon" />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t" style={{ borderColor: "var(--color-border-default)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="nav-item w-full justify-center"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="truncate text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
