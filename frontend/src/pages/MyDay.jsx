import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtDate, STATUS_LABEL, ROLE_EMOJI, ROLE_COLOR } from "../lib/constants";
import { Sunrise, AlertTriangle, Clock, Sparkles, Play, Loader2 } from "lucide-react";
import JobDetailModal from "../components/JobDetailModal";

const scoreOf = (e) => (e.quality + e.csat + e.deadline + e.comm + e.initiative + e.collab) / 6;

export default function MyDay({ user }) {
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [standup, setStandup] = useState({ loading: false, text: "" });

  const load = async () => {
    const [j, c, u] = await Promise.all([api.get("/jobs"), api.get("/clients"), api.get("/users")]);
    setJobs(j.data); setClients(c.data); setUsers(u.data);
  };
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const myOverdue = jobs.filter(j => j.status === "overdue");
  const dueToday = jobs.filter(j => j.status !== "done" && j.due === today);
  const nextUp = jobs.filter(j => ["active","todo","review"].includes(j.status) && j.due !== today).slice(0, 5);

  const gitStandup = async () => {
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
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase mono tracking-widest opacity-90"><Sunrise size={14} /> My Day</div>
            <h1 className="text-3xl font-semibold mt-2 tracking-tight">Hey {user?.name?.split(" ")[0] || "there"} 👋</h1>
            <div className="text-sm opacity-90 mt-1">
              {myOverdue.length > 0 && <span className="mr-3"><b>{myOverdue.length}</b> overdue</span>}
              {dueToday.length > 0 && <span className="mr-3"><b>{dueToday.length}</b> due today</span>}
              {myOverdue.length + dueToday.length === 0 && <span>Nothing on fire. Focus mode. 🎯</span>}
            </div>
          </div>
          <button onClick={gitStandup} disabled={standup.loading} data-testid="ai-standup-btn" className="px-3 h-9 rounded-md bg-white/20 backdrop-blur hover:bg-white/30 text-sm font-semibold flex items-center gap-1 disabled:opacity-60">
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

      {jobs.length === 0 && (
        <div className="card-surface p-10 text-center text-slate-500">
          <div className="text-lg font-semibold text-slate-900">No jobs assigned yet</div>
          <div className="text-sm mt-1">When Yusuf delegates work to you, it'll show up here.</div>
        </div>
      )}

      {selectedJob && <JobDetailModal jobId={selectedJob} onClose={() => setSelectedJob(null)} users={users} clients={clients} onUpdate={() => load()} />}
    </div>
  );
}
