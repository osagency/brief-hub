import React, { useEffect, useState, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard, Inbox, Bell, Briefcase, KanbanSquare,
  Calendar, CheckCircle2, Timer, Users, LineChart, BookOpen,
  BarChart3, Sparkles, Trophy, LogOut, Search, UsersRound, Wand2,
  Menu, X, Eye, EyeOff, Volume2, VolumeX, ChevronDown, CalendarCheck, HeartHandshake, Rocket
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
    label: "Sales & Growth",
    items: [
      { to: "/leads", label: "Lead Generation", icon: Rocket, testid: "nav-leads" },
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
      { to: "/leaves", label: "Leaves", icon: CalendarCheck, testid: "nav-leaves" },
      { to: "/hr", label: "HR & Culture", icon: HeartHandshake, testid: "nav-hr" },
      { to: "/sop", label: "SOP Library", icon: BookOpen, testid: "nav-sop" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3, testid: "nav-reports", managerOnly: true },
      { to: "/ai", label: "AI Assistant", icon: Sparkles, testid: "nav-ai" },
      { to: "/prompts", label: "Prompt Studio", icon: Wand2, testid: "nav-prompts", managerOnly: true },
      { to: "/vibes", label: "Team Vibes", icon: Trophy, testid: "nav-vibes" },
    ],
  },
];

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState({ jobs: [], clients: [], approvals: [] });
  const nav = useNavigate();

  useEffect(() => {
    if (q.trim().length < 2) { setResults({ jobs: [], clients: [], approvals: [] }); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/search", { params: { q } });
        setResults(data);
        setOpen(true);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const total = results.jobs.length + results.clients.length + results.approvals.length;

  return (
    <div className="relative flex-1 max-w-xl">
      <div className="flex items-center gap-3 text-slate-600 h-9">
        <Search size={14} className="text-slate-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          data-testid="global-search"
          placeholder="Search jobs, clients, approvals…"
          className="bg-transparent outline-none text-[13px] placeholder:text-slate-400 flex-1"
        />
      </div>
      {open && total > 0 && (
        <div className="absolute top-11 left-0 right-0 bg-white border border-[#E5E8F0] rounded-[12px] shadow-lg overflow-hidden z-40" data-testid="search-results">
          {results.jobs.length > 0 && <SearchSection label="Jobs" items={results.jobs} render={(j) => (
            <button key={j.id} onMouseDown={() => nav("/jobs")} data-testid={`search-job-${j.id}`} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
              <span className="mono text-[10px] text-slate-400 w-14">{j.id}</span>
              <span className="text-[13px] text-slate-900 flex-1 truncate">{j.title}</span>
              <span className={`chip status-${j.status}`}>{j.status}</span>
            </button>
          )} />}
          {results.clients.length > 0 && <SearchSection label="Clients" items={results.clients} render={(c) => (
            <button key={c.id} onMouseDown={() => nav("/clients")} data-testid={`search-client-${c.id}`} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
              <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
              <span className="text-[13px] text-slate-900 flex-1">{c.name}</span>
            </button>
          )} />}
          {results.approvals.length > 0 && <SearchSection label="Approvals" items={results.approvals} render={(a) => (
            <button key={a.id} onMouseDown={() => nav("/approvals")} data-testid={`search-approval-${a.id}`} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
              <span className="mono text-[10px] text-slate-400 w-14">{a.jobId}</span>
              <span className="text-[13px] text-slate-900 flex-1 truncate">{a.title}</span>
            </button>
          )} />}
        </div>
      )}
    </div>
  );
}

function SearchSection({ label, items, render }) {
  return (
    <div className="border-b border-[#E5E8F0] last:border-b-0">
      <div className="px-3 py-1.5 text-[10px] uppercase mono tracking-widest text-slate-500 bg-slate-50">{label}</div>
      {items.map(render)}
    </div>
  );
}


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

function ViewAsSwitcher() {
  const { realUser, viewAsUser, setViewAs, canImpersonate } = useAuth();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    if (!canImpersonate) return;
    api.get("/users").then(({ data }) => setTeam(data.filter(u => u.id !== realUser?.id))).catch(() => {});
  }, [canImpersonate, realUser?.id]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!canImpersonate) return null;

  return (
    <div ref={ref} className="relative">
      <button
        data-testid="view-as-btn"
        onClick={() => setOpen(o => !o)}
        className={`h-9 px-3 rounded-full text-[12px] font-medium flex items-center gap-1.5 transition ${
          viewAsUser
            ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
      >
        {viewAsUser ? <Eye size={13} /> : <EyeOff size={13} />}
        <span className="hidden sm:inline">
          {viewAsUser ? `Viewing as ${viewAsUser.name.split(" ")[0]}` : "View as…"}
        </span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute top-11 right-0 bg-white border border-[#E5E8F0] rounded-[12px] shadow-lg overflow-hidden z-50 w-64" data-testid="view-as-dropdown">
          <div className="px-3 py-2 text-[10px] uppercase mono tracking-widest text-slate-500 bg-slate-50 border-b border-[#E5E8F0]">
            See app as a team member
          </div>
          <button
            onMouseDown={() => { setViewAs(null); setOpen(false); }}
            data-testid="view-as-self"
            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 ${!viewAsUser ? "bg-blue-50" : ""}`}
          >
            <div className="w-7 h-7 rounded-full bg-[#4361EE] text-white flex items-center justify-center text-[11px] font-bold">
              {realUser?.name?.[0]}
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-slate-900">{realUser?.name} (you)</div>
              <div className="text-[10px] mono text-slate-500">Admin view</div>
            </div>
            {!viewAsUser && <CheckCircle2 size={14} className="text-emerald-500" />}
          </button>
          {team.map(u => (
            <button
              key={u.id}
              onMouseDown={() => { setViewAs(u); setOpen(false); toast(`Now viewing as ${u.name.split(" ")[0]}`, { icon: "👁" }); }}
              data-testid={`view-as-${u.id}`}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 ${viewAsUser?.id === u.id ? "bg-amber-50" : ""}`}
            >
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=4361EE&color=fff`} className="w-7 h-7 rounded-full" alt={u.name} />
              <div className="flex-1">
                <div className="text-[13px] font-medium text-slate-900">{u.name}</div>
                <div className="text-[10px] mono text-slate-500">{u.role_label}</div>
              </div>
              {viewAsUser?.id === u.id && <CheckCircle2 size={14} className="text-amber-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(() => localStorage.getItem("os_sound") === "on");
  const toggle = () => {
    const next = !on;
    setOn(next);
    localStorage.setItem("os_sound", next ? "on" : "off");
    toast(next ? "Sound effects on 🔔" : "Sound muted", { duration: 1500 });
  };
  return (
    <button
      onClick={toggle}
      data-testid="sound-toggle"
      title={on ? "Mute" : "Unmute celebration sound"}
      className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition"
    >
      {on ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}

// Poll notifications every 45s. Toast only new ones (by id).
function useNotifPoller() {
  const seen = useRef(new Set());
  const primed = useRef(false);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await api.get("/notifications");
        if (!alive) return;
        const unread = data.filter(n => !n.read);
        if (!primed.current) {
          unread.forEach(n => seen.current.add(n.id));
          primed.current = true;
          return;
        }
        unread.forEach(n => {
          if (!seen.current.has(n.id)) {
            seen.current.add(n.id);
            toast(n.title, { description: n.subtitle, icon: "🔔", duration: 6000 });
          }
        });
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 45000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
}

function Sidebar({ isManager, counts, user, viewAsUser, logout, onNavigate }) {
  return (
    <aside data-testid="sidebar" className="h-full w-[220px] bg-white border-r border-[#E5E8F0] flex flex-col">
      <div className="h-[54px] flex items-center gap-2 px-4 border-b border-[#E5E8F0]">
        <img src="/logos/openspace-logo.png" alt="Openspace" className="h-7 w-7 object-contain" />
        <div>
          <div className="text-[13px] font-semibold text-slate-900 leading-tight tracking-tight">Openspace</div>
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
                  onClick={onNavigate}
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
            <div className="text-[10px] text-slate-500 mono truncate">{user?.role_label} {user?.is_admin && !viewAsUser ? "· Admin" : ""}</div>
          </div>
          <button onClick={logout} data-testid="logout-btn" title="Logout" className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function Layout({ children }) {
  const { user, viewAsUser, logout, isManager, isImpersonating } = useAuth();
  const [counts, setCounts] = useState({ inboxUnread: 0, notifUnread: 0, activeJobs: 0, approvalsPending: 0 });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useNotifPoller();

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
  }, [location.pathname, isManager, isImpersonating]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#F4F6F9]" data-testid="app-shell">
      {/* Desktop sidebar (fixed) */}
      <div className="hidden md:block fixed left-0 top-0 h-screen z-30">
        <Sidebar isManager={isManager} counts={counts} user={user} viewAsUser={viewAsUser} logout={logout} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40" data-testid="mobile-drawer">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[220px] shadow-2xl">
            <Sidebar isManager={isManager} counts={counts} user={user} viewAsUser={viewAsUser} logout={logout} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 md:left-[220px] right-0 h-8 bg-amber-500 text-white text-[12px] font-medium flex items-center justify-center gap-2 z-40" data-testid="impersonation-banner">
          <Eye size={12} />
          Viewing as {viewAsUser?.name} ({viewAsUser?.role_label}) — this is what they see
        </div>
      )}

      {/* Topbar */}
      <header className={`fixed left-0 md:left-[220px] right-0 h-[54px] bg-white/85 backdrop-blur-md border-b border-[#E5E8F0] z-20 flex items-center justify-between px-4 md:px-6 gap-2 ${isImpersonating ? "top-8" : "top-0"}`} data-testid="topbar">
        <button
          onClick={() => setMobileOpen(true)}
          data-testid="mobile-menu-btn"
          className="md:hidden w-9 h-9 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-600"
        >
          <Menu size={18} />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <img src="/logos/openspace-logo.png" alt="Openspace" className="md:hidden h-6 w-6 object-contain" />
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-2">
          <ViewAsSwitcher />
          <SoundToggle />
          <span className="hidden lg:inline text-[12px] text-slate-600 mono ml-1">
            Mumbai · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>
      </header>

      <main className={`md:ml-[220px] min-h-screen ${isImpersonating ? "pt-[86px]" : "pt-[54px]"}`}>
        <div className="p-4 md:p-8 fade-in-up" data-testid="page-content">{children}</div>
      </main>
    </div>
  );
}
