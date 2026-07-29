import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { fmtDate, STATUS_LABEL, ROLE_EMOJI, ROLE_COLOR } from "../lib/constants";
import { Briefcase, AlertTriangle, Clock, TrendingUp, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import JobDetailModal from "../components/JobDetailModal";
import { useAuth } from "../lib/auth";

const StatCard = ({ label, value, tone, icon: Icon, testid }) => {
  const tones = {
    default: { bg: "bg-white", fg: "text-slate-900" },
    red: { bg: "bg-white", fg: "text-red-600" },
    orange: { bg: "bg-white", fg: "text-amber-600" },
    green: { bg: "bg-white", fg: "text-emerald-600" },
  };
  const t = tones[tone || "default"];
  return (
    <div className={`card-surface p-5 ${t.bg}`} data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-slate-500 mono">{label}</div>
        {Icon && <Icon size={16} className="text-slate-400" />}
      </div>
      <div className={`mt-3 text-3xl font-semibold ${t.fg} mono`}>{value}</div>
    </div>
  );
};

function ManagerDigest() {
  const [state, setState] = useState({ loading: true, digest: "", generated_at: "", error: "" });

  const load = async (refresh = false) => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const { data } = await api.get("/ai/manager-digest", { params: refresh ? { refresh: true } : {} });
      setState({ loading: false, digest: data.digest || "", generated_at: data.generated_at || "", error: "" });
    } catch (e) {
      setState({ loading: false, digest: "", generated_at: "", error: e?.response?.data?.detail || "Could not load digest" });
    }
  };
  useEffect(() => { load(false); }, []);

  const lines = (state.digest || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const when = state.generated_at ? new Date(state.generated_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div
      className="rounded-[16px] p-6 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(120deg, #0F172A 0%, #4361EE 60%, #8B5CF6 100%)" }}
      data-testid="manager-digest"
    >
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-30" style={{ background: "radial-gradient(circle, #EC4899, transparent 70%)" }} />
      <div className="flex items-start justify-between gap-4 relative">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase mono tracking-widest opacity-80">
            <Sparkles size={14} /> AI Manager Digest · Monday briefing
          </div>
          <h2 className="text-xl font-semibold mt-1.5">State of the agency · this week</h2>
          {when && <div className="text-[11px] mono opacity-70 mt-0.5">Generated {when}</div>}
        </div>
        <button
          onClick={() => load(true)}
          disabled={state.loading}
          data-testid="digest-refresh"
          className="h-9 px-3 rounded-full bg-white/15 hover:bg-white/25 text-[12px] font-semibold flex items-center gap-1.5 backdrop-blur transition disabled:opacity-60 whitespace-nowrap"
        >
          {state.loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {state.loading ? "Thinking…" : "Refresh"}
        </button>
      </div>

      <div className="mt-5 relative">
        {state.loading && !lines.length && (
          <div className="space-y-2" data-testid="digest-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 rounded bg-white/10 animate-pulse" style={{ width: `${90 - i * 8}%` }} />
            ))}
          </div>
        )}
        {state.error && !state.loading && (
          <div className="text-sm bg-red-500/20 border border-red-300/30 rounded-md p-3" data-testid="digest-error">{state.error}</div>
        )}
        {!state.loading && lines.length > 0 && (
          <ul className="space-y-2.5" data-testid="digest-bullets">
            {lines.slice(0, 5).map((line, i) => (
              <li key={i} className="text-[14px] leading-relaxed bg-white/10 backdrop-blur rounded-lg px-3 py-2" data-testid={`digest-bullet-${i}`}>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isManager = !!user?.is_admin;
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [jobsR, clientsR, apprR, usersR] = await Promise.all([
        api.get("/jobs"), api.get("/clients"), api.get("/approvals"), api.get("/users"),
      ]);
      setJobs(jobsR.data); setClients(clientsR.data); setApprovals(apprR.data); setUsers(usersR.data);
    };
    load();
  }, []);

  const active = jobs.filter(j => ["active","todo","review"].includes(j.status)).length;
  const overdue = jobs.filter(j => j.status === "overdue").length;
  const awaiting = approvals.filter(a => a.status === "pending").length;

  const now = new Date();
  const doneThisMonth = jobs.filter(j => {
    if (j.status !== "done") return false;
    const d = new Date(j.updatedAt || j.createdAt || j.due);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const brandHealth = clients.map(c => {
    const forC = jobs.filter(j => j.client === c.id);
    if (forC.length === 0) return { ...c, pct: 0, tone: "grey" };
    const done = forC.filter(j => j.status === "done").length;
    const pct = Math.round((done / forC.length) * 100);
    const anyOverdue = forC.some(j => j.status === "overdue");
    let tone = "blue";
    if (anyOverdue) tone = "red";
    else if (pct < 30) tone = "yellow";
    else if (pct >= 70) tone = "green";
    return { ...c, pct, tone };
  });

  const recent = [...jobs].slice(0, 7);
  const workload = users.map(u => ({ u, count: jobs.filter(j => (j.assignees || []).includes(u.id) && ["active","todo","review","overdue"].includes(j.status)).length }));

  const toneColor = { red: "#EF4444", yellow: "#F59E0B", blue: "#4361EE", green: "#10B981", grey: "#94A3B8" };

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Command Centre</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Dashboard</h1>
      </div>

      {isManager && <ManagerDigest />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active jobs" value={active} icon={Briefcase} testid="stat-active-jobs" />
        <StatCard label="Overdue" value={overdue} tone="red" icon={AlertTriangle} testid="stat-overdue" />
        <StatCard label="Awaiting approval" value={awaiting} tone="orange" icon={Clock} testid="stat-awaiting" />
        <StatCard label="Done this month" value={doneThisMonth} tone="green" icon={TrendingUp} testid="stat-done-month" />
      </div>

      {/* Multi-Brand Health */}
      <div className="card-surface p-5" data-testid="brand-health">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Multi-Brand Health</div>
            <div className="text-sm text-slate-500">% of jobs completed this month · red if overdue exists</div>
          </div>
        </div>
        <div className="space-y-3">
          {brandHealth.map(b => (
            <div key={b.id} className="flex items-center gap-3">
              <div className="w-40 text-[13px] font-medium text-slate-900">{b.name}</div>
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${b.pct}%`, background: toneColor[b.tone] }} />
              </div>
              <div className="w-14 text-right mono text-[12px] text-slate-600">{b.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Jobs */}
        <div className="lg:col-span-2 card-surface" data-testid="recent-jobs">
          <div className="p-5 border-b border-[#E5E8F0]">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Recent jobs</div>
          </div>
          <div className="divide-y divide-[#E5E8F0]">
            {recent.map(j => {
              const c = clients.find(x => x.id === j.client) || {};
              return (
                <div key={j.id} onClick={() => setSelectedJob(j.id)} data-testid={`recent-job-${j.id}`} className="p-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-slate-900 truncate">{j.title}</div>
                    <div className="text-[11px] mono text-slate-500 mt-0.5">{j.id}</div>
                  </div>
                  <span className="chip" style={{ background: (c.color || "#94A3B8") + "1A", color: c.color }}>{c.name}</span>
                  <span className={`chip status-${j.status}`}>{STATUS_LABEL[j.status]}</span>
                  <span className="mono text-[12px] text-slate-500 w-14 text-right">{fmtDate(j.due)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          {/* Team workload */}
          <div className="card-surface p-5" data-testid="team-workload">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3">Team workload</div>
            <div className="space-y-3">
              {workload.map(w => (
                <div key={w.u.id} className="flex items-center gap-3">
                  <div className="text-lg leading-none">{ROLE_EMOJI[w.u.role_key]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-slate-700">{w.u.name}</div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, w.count * 12)}%`, background: ROLE_COLOR[w.u.role_key] }} />
                    </div>
                  </div>
                  <div className="mono text-[12px] text-slate-500 w-8 text-right">{w.count}</div>
                </div>
              ))}
            </div>
          </div>

          {isManager && (
            <div className="card-surface p-5" data-testid="client-mix">
              <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3">Jobs per client</div>
              <div className="space-y-2">
                {clients.map(c => {
                  const total = jobs.filter(j => j.client === c.id).length;
                  const active = jobs.filter(j => j.client === c.id && ["active","todo","review","overdue"].includes(j.status)).length;
                  return (
                    <div key={c.id} className="flex items-center justify-between text-[12px]">
                      <span className="font-medium" style={{ color: c.color }}>{c.name}</span>
                      <span className="mono text-slate-600"><span className="font-semibold text-slate-900">{active}</span> active · {total} total</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card-surface p-5" data-testid="pending-approvals">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3">Pending approvals</div>
            <div className="space-y-2">
              {approvals.filter(a => a.status === "pending").slice(0,4).map(a => {
                const c = clients.find(x => x.id === a.client) || {};
                return (
                  <div key={a.id} className="flex items-center gap-2 justify-between">
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-slate-900 truncate">{a.title}</div>
                      <div className="text-[11px] mono" style={{ color: c.color }}>{c.name}</div>
                    </div>
                    <button onClick={() => setSelectedJob(a.jobId)} data-testid={`view-approval-${a.id}`} className="text-[11px] font-medium text-[#4361EE] hover:underline">View</button>
                  </div>
                );
              })}
              {approvals.filter(a => a.status === "pending").length === 0 && <div className="text-xs text-slate-400">Nothing pending.</div>}
            </div>
          </div>
        </div>
      </div>

      {selectedJob && <JobDetailModal jobId={selectedJob} onClose={() => setSelectedJob(null)} users={users} clients={clients} />}
    </div>
  );
}
