import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtDate, STATUS_LABEL, ROLE_EMOJI, ROLE_COLOR } from "../lib/constants";
import { Sunrise, AlertTriangle, Clock, Sparkles, Play, Loader2, Flame, RefreshCw, Lightbulb } from "lucide-react";
import JobDetailModal from "../components/JobDetailModal";
import EmptyState from "../components/EmptyState";
import { FEST_COLOR, FEST_LABEL } from "../components/ManageFestivalsModal";

const scoreOf = (e) => (e.quality + e.csat + e.deadline + e.comm + e.initiative + e.collab) / 6;

export default function MyDay({ user }) {
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [standup, setStandup] = useState({ loading: false, text: "" });
  const [streak, setStreak] = useState({ streak: 0, jobs_today: 0 });

  const load = async () => {
    const [j, c, u, s] = await Promise.all([
      api.get("/jobs"), api.get("/clients"), api.get("/users"), api.get("/kpi/streak").catch(() => ({ data: { streak: 0, jobs_today: 0 } })),
    ]);
    setJobs(j.data); setClients(c.data); setUsers(u.data); setStreak(s.data);
  };
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const myOverdue = jobs.filter(j => j.status === "overdue");
  const dueToday = jobs.filter(j => j.status !== "done" && j.due === today);
  const nextUp = jobs.filter(j => ["active","todo","review"].includes(j.status) && j.due !== today).slice(0, 5);

  const generateStandup = async () => {
    if (jobs.length === 0) return;
    setStandup({ loading: true, text: "" });
    try {
      // Ask AI standup for the top-priority job
      const target = jobs.find(j => j.status === "active") || jobs[0];
      const { data } = await api.post("/ai/job-help", { jobId: target.id, kind: "standup" });
      setStandup({ loading: false, text: data.reply });
    } catch (e) {
      setStandup({ loading: false, text: "Could not generate standup." });
    }
  };

  const JobRow = ({ j }) => {
    const c = clients.find(x => x.id === j.client) || {};
    return (
      <button onClick={() => setSelectedJob(j.id)} data-testid={`myday-job-${j.id}`} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-[#E5E8F0] transition text-left">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-slate-900 truncate">{j.title}</div>
          <div className="text-[11px] mono text-slate-500">{j.id} · <span style={{ color: c.color }}>{c.name}</span></div>
        </div>
        <div className="flex gap-1 items-center">
          {(j.team || []).map(r => <span key={r} className="chip" style={{ background: (ROLE_COLOR[r] || "#4361EE") + "1A", color: ROLE_COLOR[r] || "#4361EE" }}>{ROLE_EMOJI[r]}</span>)}
        </div>
        <span className={`chip status-${j.status}`}>{STATUS_LABEL[j.status]}</span>
        <span className="mono text-[11px] text-slate-500 w-14 text-right">{fmtDate(j.due)}</span>
      </button>
    );
  };

  return (
    <div className="space-y-6" data-testid="my-day">
      <div className="rounded-[16px] p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(120deg, #4361EE 0%, #06B6D4 100%)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase mono tracking-widest opacity-90"><Sunrise size={14} /> My Day</div>
            <h1 className="text-2xl md:text-3xl font-semibold mt-2 tracking-tight">Hey {user?.name?.split(" ")[0] || "there"} 👋</h1>
            <div className="text-sm opacity-90 mt-1">
              {myOverdue.length > 0 && <span className="mr-3"><b>{myOverdue.length}</b> overdue</span>}
              {dueToday.length > 0 && <span className="mr-3"><b>{dueToday.length}</b> due today</span>}
              {myOverdue.length + dueToday.length === 0 && <span>Nothing on fire. Focus mode. 🎯</span>}
            </div>
            <div className="flex items-center gap-3 mt-3">
              {streak.streak > 0 && (
                <div className="bg-white/20 backdrop-blur rounded-full px-3 py-1 flex items-center gap-1.5 text-[12px] font-medium" data-testid="streak-chip">
                  <Flame size={13} /> {streak.streak}-day streak
                </div>
              )}
              {streak.jobs_today > 0 && (
                <div className="bg-white/20 backdrop-blur rounded-full px-3 py-1 text-[12px] font-medium" data-testid="jobs-today-chip">
                  🎯 {streak.jobs_today} shipped today
                </div>
              )}
            </div>
          </div>
          <button onClick={generateStandup} disabled={standup.loading} data-testid="ai-standup-btn" className="px-3 h-9 rounded-md bg-white/20 backdrop-blur hover:bg-white/30 text-sm font-semibold flex items-center gap-1 disabled:opacity-60 whitespace-nowrap">
            {standup.loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} AI standup
          </button>
        </div>
        {standup.text && (
          <div className="mt-4 bg-white/15 backdrop-blur rounded-md p-3 text-sm whitespace-pre-wrap" data-testid="standup-output">{standup.text}</div>
        )}
      </div>

      {myOverdue.length > 0 && (
        <div className="card-surface" data-testid="section-overdue">
          <div className="p-4 border-b border-[#E5E8F0] flex items-center gap-2 text-red-600">
            <AlertTriangle size={16} />
            <span className="text-[13px] font-semibold">Overdue · needs today</span>
          </div>
          <div className="p-2 space-y-1">
            {myOverdue.map(j => <JobRow key={j.id} j={j} />)}
          </div>
        </div>
      )}

      {dueToday.length > 0 && (
        <div className="card-surface" data-testid="section-due-today">
          <div className="p-4 border-b border-[#E5E8F0] flex items-center gap-2 text-amber-600">
            <Clock size={16} />
            <span className="text-[13px] font-semibold">Due today</span>
          </div>
          <div className="p-2 space-y-1">
            {dueToday.map(j => <JobRow key={j.id} j={j} />)}
          </div>
        </div>
      )}

      {nextUp.length > 0 && (
        <div className="card-surface" data-testid="section-next-up">
          <div className="p-4 border-b border-[#E5E8F0] flex items-center gap-2 text-slate-700">
            <Play size={14} />
            <span className="text-[13px] font-semibold">Next up · your active work</span>
          </div>
          <div className="p-2 space-y-1">
            {nextUp.map(j => <JobRow key={j.id} j={j} />)}
          </div>
        </div>
      )}

      {jobs.length === 0 && <IdleIdeas />}
      {jobs.length > 0 && myOverdue.length === 0 && dueToday.length === 0 && nextUp.length === 0 && (
        <IdleIdeas />
      )}

      {selectedJob && <JobDetailModal jobId={selectedJob} onClose={() => setSelectedJob(null)} users={users} clients={clients} onUpdate={() => load()} />}
    </div>
  );
}

function IdleIdeas() {
  const [state, setState] = useState({ loading: true, ideas: [], festivals: [], error: "" });

  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const { data } = await api.post("/ai/idle-suggestions");
      setState({ loading: false, ideas: data.ideas || [], festivals: data.upcoming_festivals || [], error: "" });
    } catch (e) {
      setState({ loading: false, ideas: [], festivals: [], error: e?.response?.data?.detail || "Could not load ideas" });
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4" data-testid="idle-ideas">
      <div
        className="rounded-[16px] p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, #8B5CF6 0%, #EC4899 60%, #F59E0B 100%)" }}
      >
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full opacity-30" style={{ background: "radial-gradient(circle, #fff, transparent 70%)" }} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[11px] uppercase mono tracking-widest opacity-90">
              <Lightbulb size={14} /> Free head-space · use it well
            </div>
            <h2 className="text-2xl font-semibold mt-1.5 leading-tight">You've got no jobs assigned — perfect time to think proactively.</h2>
            <p className="text-sm opacity-90 mt-1 max-w-2xl">Here are 4 fresh ideas Claude picked for you, tied to upcoming festivals and your role. Pick one, pitch it to Yusuf, ship something people will actually notice.</p>
          </div>
          <button onClick={load} disabled={state.loading} data-testid="idle-refresh" className="h-9 px-3 rounded-full bg-white/20 hover:bg-white/30 text-[12px] font-semibold flex items-center gap-1.5 backdrop-blur transition disabled:opacity-60 whitespace-nowrap">
            {state.loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {state.loading ? "Thinking…" : "Refresh"}
          </button>
        </div>
      </div>

      {state.error && <div className="text-sm text-red-600" data-testid="idle-error">{state.error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {state.loading && !state.ideas.length && (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="card-surface p-4 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-slate-200 rounded w-4/5 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-3/5" />
            </div>
          ))
        )}
        {!state.loading && state.ideas.map((idea, i) => (
          <div key={i} data-testid={`idle-idea-${i}`} className="card-surface p-4 hover:border-[#4361EE] transition">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="chip status-active">{idea.brand_name || idea.brand}</span>
              {idea.tied_to && idea.tied_to.toLowerCase() !== "evergreen" ? (
                <span className="chip" style={{ background: "#F59E0B1A", color: "#F59E0B" }}>🎉 {idea.tied_to}</span>
              ) : (
                <span className="chip" style={{ background: "#06B6D41A", color: "#06B6D4" }}>Evergreen</span>
              )}
            </div>
            <div className="text-[15px] font-semibold text-slate-900 mt-2 leading-snug">{idea.title}</div>
            {idea.why && <div className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">{idea.why}</div>}
            <button
              onClick={() => { navigator.clipboard?.writeText(idea.title); toast.success("Idea copied — pitch it to Yusuf"); }}
              data-testid={`idle-copy-${i}`}
              className="mt-3 text-[11px] mono uppercase tracking-widest text-[#4361EE] hover:underline"
            >
              Copy to pitch
            </button>
          </div>
        ))}
      </div>

      {state.festivals.length > 0 && (
        <div className="card-surface p-4" data-testid="idle-festivals">
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Upcoming · next 60 days</div>
          <div className="flex flex-wrap gap-2">
            {state.festivals.map((f) => (
              <span key={f.id} className="chip" style={{ background: FEST_COLOR[f.type] + "1A", color: FEST_COLOR[f.type] }} data-testid={`idle-fest-${f.id}`}>
                {f.name} · {new Date(f.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
