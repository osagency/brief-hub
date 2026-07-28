import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { fmtDate, ROLE_EMOJI, ROLE_COLOR } from "../lib/constants";
import { Repeat } from "lucide-react";
import JobDetailModal from "../components/JobDetailModal";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "active", label: "In Progress" },
  { key: "review", label: "In Review" },
  { key: "done", label: "Done" },
  { key: "overdue", label: "Overdue" },
];

export default function Board() {
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/jobs"), api.get("/clients"), api.get("/users")]).then(([j,c,u]) => {
      setJobs(j.data); setClients(c.data); setUsers(u.data);
    });
  }, []);

  return (
    <div className="space-y-5" data-testid="board-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Work</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Board</h1>
      </div>

      <div className="grid grid-cols-5 gap-3 min-h-[70vh]">
        {COLUMNS.map(col => {
          const items = jobs.filter(j => j.status === col.key);
          return (
            <div key={col.key} className="bg-slate-100/70 rounded-[12px] p-3 min-w-[220px] flex flex-col" data-testid={`col-${col.key}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] uppercase mono tracking-widest text-slate-600">{col.label}</div>
                <div className="text-[11px] mono text-slate-400">{items.length}</div>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto">
                {items.map(j => {
                  const c = clients.find(x => x.id === j.client) || {};
                  return (
                    <div key={j.id} onClick={() => setSel(j.id)} data-testid={`card-${j.id}`} className="bg-white border border-[#E5E8F0] rounded-lg p-3 hover:border-[#4361EE] cursor-pointer transition shadow-sm">
                      <div className="text-[10px] mono text-slate-400 mb-1">{j.id}</div>
                      <div className="text-[13px] font-medium text-slate-900 leading-snug line-clamp-2">{j.title}</div>
                      <div className="flex items-center gap-1 mt-2">
                        {(j.team || []).map(r => <span key={r} className="chip" style={{ background: (ROLE_COLOR[r] || "#4361EE") + "1A", color: ROLE_COLOR[r] || "#4361EE" }}>{ROLE_EMOJI[r]}</span>)}
                        {j.recurring !== "none" && <span className="chip status-recurring"><Repeat size={10} /> {j.recurring}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[10px]" style={{ color: c.color }}>{c.name}</span>
                        <span className="text-[10px] mono text-slate-500">{fmtDate(j.due)}</span>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && <div className="text-[11px] text-slate-400 text-center py-6">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>

      {sel && <JobDetailModal jobId={sel} onClose={() => setSel(null)} users={users} clients={clients} />}
    </div>
  );
}
