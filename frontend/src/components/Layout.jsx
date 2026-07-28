import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Inbox, Bell, Briefcase, KanbanSquare,
  Calendar, CheckCircle2, Timer, Users, LineChart, BookOpen,
  BarChart3, Sparkles, Trophy, LogOut, Search, UsersRound
} from "lucide-react";
import { useAuth } from "../lib/auth";
import api from "../lib/api";

const SECTIONS = [
  {
    label: "Command",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
      { to: "/inbox", label: "Smart Inbox", icon: Inbox, badge: "inbox", testid: "nav-inbox", managerOnly: true },
      { to: "/notifications", label: "Notifications", icon: Bell, badge: "notif", testid: "nav-notifications" },
    ],
  },
  {
    label: "Work",
    items: [
      { to: "/jobs", label: "All Jobs", icon: Briefcase, badge: "jobs", testid: "nav-jobs" },
      { to: "/board", label: "Board", icon: KanbanSquare, testid: "nav-board" },
      { to: "/calendar", label: "Content Calendar", icon: Calendar, testid: "nav-calendar" },
      { to: "/approvals", label: "Approvals", icon: CheckCircle2, badge: "approvals", testid: "nav-approvals" },
      { to: "/time", label: "Time Tracker", icon: Timer, testid: "nav-time" },
    ],
  },
  {
    label: "Clients",
    items: [
      { to: "/clients", label: "Clients", icon: Users, testid: "nav-clients" },
    ],
  },
  {
    label: "Team",
    items: [
      { to: "/kpi", label: "KPI & Performance", icon: LineChart, testid: "nav-kpi" },
      { to: "/team", label: "Manage Team", icon: UsersRound, testid: "nav-team", managerOnly: true },
      { to: "/sop", label: "SOP Library", icon: BookOpen, testid: "nav-sop" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3, testid: "nav-reports", managerOnly: true },
      { to: "/ai", label: "AI Assistant", icon: Sparkles, testid: "nav-ai" },
      { to: "/vibes", label: "Team Vibes", icon: Trophy, testid: "nav-vibes" },
    ],
  },
];

function Badge({ kind, counts }) {
  const map = {
    inbox: { count: counts.inboxUnread, className: "bg-emerald-500 text-white" },
    notif: { count: counts.notifUnread, className: "bg-red-500 text-white" },
    jobs: { count: counts.activeJobs, className: "bg-[#4361EE] text-white" },
    approvals: { count: counts.approvalsPending, className: "bg-amber-500 text-white" },
  };
  const b = map[kind];
  if (!b || !b.count) return null;
  return (
    <span data-testid={`badge-${kind}`} className={`ml-auto text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center mono ${b.className}`}>
      {b.count}
    </span>
  );
}

export default function Layout({ children }) {
  const { user, logout, isManager } = useAuth();
  const [counts, setCounts] = useState({ inboxUnread: 0, notifUnread: 0, activeJobs: 0, approvalsPending: 0 });
  const location = useLocation();

  useEffect(() => {
    const load = async () => {
      const c = { inboxUnread: 0, notifUnread: 0, activeJobs: 0, approvalsPending: 0 };
      try {
        const [jobs, notifs, approvals] = await Promise.all([
          api.get("/jobs"), api.get("/notifications"), api.get("/approvals"),
        ]);
        c.activeJobs = jobs.data.filter((j) => ["active", "todo", "review", "overdue"].includes(j.status)).length;
        c.notifUnread = notifs.data.filter((n) => !n.read).length;
        c.approvalsPending = approvals.data.filter((a) => a.status === "pending").length;
        if (isManager) {
          const inbox = await api.get("/inbox");
          c.inboxUnread = inbox.data.filter((e) => !e.read).length;
        }
      } catch {}
      setCounts(c);
    };
    load();
  }, [location.pathname, isManager]);

  return (
    <div className="min-h-screen bg-[#F4F6F9]" data-testid="app-shell">
      {/* Sidebar */}
      <aside data-testid="sidebar" className="fixed left-0 top-0 h-screen w-[220px] bg-white border-r border-[#E5E8F0] flex flex-col z-30">
        <div className="h-[54px] flex items-center gap-2 px-4 border-b border-[#E5E8F0]">
          <div className="w-7 h-7 rounded-lg bg-[#4361EE] flex items-center justify-center text-white font-bold text-xs">OS</div>
          <div>
            <div className="text-[13px] font-semibold text-slate-900 leading-tight">Openspace</div>
            <div className="text-[10px] text-slate-500 mono leading-tight">Agency OS</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {SECTIONS.map((sec) => (
            <div key={sec.label}>
              <div className="sidebar-section-label">{sec.label}</div>
              {sec.items.map((it) => {
                if (it.managerOnly && !isManager) return null;
                const Icon = it.icon;
                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    data-testid={it.testid}
                    className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                  >
                    <Icon size={16} />
                    <span>{it.label}</span>
                    <Badge kind={it.badge} counts={counts} />
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-[#E5E8F0]">
          <div className="flex items-center gap-2">
            <img src={`https://ui-avatars.com/api/?name=${user?.name || "U"}&background=4361EE&color=fff`} alt={user?.name} className="w-8 h-8 rounded-full" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-slate-900 truncate" data-testid="user-name">{user?.name}</div>
              <div className="text-[10px] text-slate-500 mono truncate">{user?.role_label} {user?.is_admin ? "· Admin" : ""}</div>
            </div>
            <button onClick={logout} data-testid="logout-btn" title="Logout" className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header className="fixed top-0 left-[220px] right-0 h-[54px] bg-white/85 backdrop-blur-md border-b border-[#E5E8F0] z-20 flex items-center justify-between px-6" data-testid="topbar">
        <div className="flex items-center gap-3 text-slate-600 flex-1 max-w-xl">
          <Search size={14} className="text-slate-400" />
          <input
            data-testid="global-search"
            placeholder="Search jobs, clients…"
            className="bg-transparent outline-none text-[13px] placeholder:text-slate-400 flex-1"
          />
        </div>
        <div className="flex items-center gap-3 text-[12px] text-slate-600 mono">
          <span>Mumbai · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
      </header>

      <main className="ml-[220px] pt-[54px] min-h-screen">
        <div className="p-6 md:p-8 fade-in-up" data-testid="page-content">{children}</div>
      </main>
    </div>
  );
}
