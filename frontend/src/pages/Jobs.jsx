import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { fmtDate, ROLE_EMOJI, ROLE_COLOR, STATUS_LABEL } from "../lib/constants";
import { Search, Bell as BellIcon } from "lucide-react";
import JobDetailModal from "../components/JobDetailModal";

const TEAM_FILTERS = [
  { key: "all", label: "Everyone", emoji: "👥" },
  { key: "arjun", label: "Arjun", emoji: "✍️" },
  { key: "priya", label: "Priya", emoji: "🎨" },
  { key: "kavya", label: "Kavya", emoji: "📊" },
  { key: "rohan", label: "Rohan", emoji: "💻" },
  { key: "meera", label: "Meera", emoji: "🤝" },
  { key: "yusuf", label: "Yusuf", emoji: "👔" },
];

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [team, setTeam] = useState("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [client, setClient] = useState("all");
  const [priority, setPriority] = useState("all");
  const [type, setType] = useState("all");
  const [sel, setSel] = useState(null);

  const load = async (t = team) => {
    const params = t !== "all" ? { assignee: t } : {};
    const [j, c, u] = await Promise.all([api.get("/jobs", { params }), api.get("/clients"), api.get("/users")]);
    setJobs(j.data); setClients(c.data); setUsers(u.data);
  };
  useEffect(() => { load(); }, [team]);

  const filtered = jobs.filter(j => {
    if (q && !j.title.toLowerCase().includes(q.toLowerCase()) && !j.id.toLowerCase().includes(q.toLowerCase())) return false;
    if (status !== "all" && j.status !== status) return false;
    if (client !== "all" && j.client !== client) return false;
    if (priority !== "all" && j.priority !== priority) return false;
    if (type === "recurring" && j.recurring === "none") return false;
    if (type === "onetime" && j.recurring !== "none") return false;
    return true;
  });

  return (
    <div className="space-y-5" data-testid="jobs-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Work</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">All Jobs</h1>
      </div>

      {/* Team filter pills */}
      <div className="card-surface p-3 flex flex-wrap gap-2 sticky top-[54px] z-10">
        {TEAM_FILTERS.map(t => (
          <button
            key={t.key}
            onClick={() => setTeam(t.key)}
            data-testid={`team-filter-${t.key}`}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ${team === t.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            <span className="mr-1">{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card-surface p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[180px] flex items-center gap-2 h-9 px-3 rounded-md border border-[#E5E8F0] bg-white">
          <Search size={14} className="text-slate-400" />
          <input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} data-testid="jobs-search" className="flex-1 text-sm bg-transparent outline-none" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} data-testid="filter-status" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={client} onChange={e => setClient(e.target.value)} data-testid="filter-client" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
          <option value="all">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} data-testid="filter-priority" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
          <option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <select value={type} onChange={e => setType(e.target.value)} data-testid="filter-type" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
          <option value="all">All types</option><option value="onetime">One-time</option><option value="recurring">Recurring</option>
        </select>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden" data-testid="jobs-table">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase mono tracking-widest text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Job</th>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Team</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Due</th>
              <th className="text-left px-4 py-3">Hrs</th>
              <th className="text-left px-4 py-3">Progress</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(j => {
              const c = clients.find(x => x.id === j.client) || {};
              return (
                <tr key={j.id} onClick={() => setSel(j.id)} data-testid={`job-row-${j.id}`} className="border-t border-[#E5E8F0] hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-[13px] font-medium text-slate-900 flex items-center gap-1">
                          {j.title}
                          {j.scopeAdded > 0 && <BellIcon size={12} className="text-amber-500" title={`Scope creep: ${j.scopeAdded} additions`} data-testid={`scope-flag-${j.id}`} />}
                        </div>
                        <div className="text-[10px] mono text-slate-400">{j.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="chip" style={{ background: (c.color || "#94A3B8") + "1A", color: c.color }}>{c.name}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {(j.team || []).map(r => <span key={r} className="chip" style={{ background: (ROLE_COLOR[r] || "#4361EE") + "1A", color: ROLE_COLOR[r] || "#4361EE" }}>{ROLE_EMOJI[r]}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`chip priority-${j.priority}`}>{j.priority}</span></td>
                  <td className="px-4 py-3"><span className={`chip status-${j.status}`}>{STATUS_LABEL[j.status]}</span></td>
                  <td className="px-4 py-3 mono text-[12px] text-slate-600">{fmtDate(j.due)}</td>
                  <td className="px-4 py-3 mono text-[12px] text-slate-600">{j.hours}</td>
                  <td className="px-4 py-3 w-28">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#4361EE]" style={{ width: `${j.progress}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400 text-sm">No jobs match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sel && <JobDetailModal jobId={sel} onClose={() => setSel(null)} users={users} clients={clients} onUpdate={() => load()} />}
    </div>
  );
}
