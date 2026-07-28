import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { fmtINR } from "../lib/constants";
import { AlertTriangle } from "lucide-react";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/clients"), api.get("/jobs"), api.get("/timelogs")]).then(([c, j, l]) => {
      setClients(c.data); setJobs(j.data); setLogs(l.data);
    });
  }, []);

  const now = new Date();
  const cur = { m: now.getMonth(), y: now.getFullYear() };

  return (
    <div className="space-y-5" data-testid="clients-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Clients</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Client Directory</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {clients.map(c => {
          const cJobs = jobs.filter(j => j.client === c.id);
          const active = cJobs.filter(j => ["active","todo","review","overdue"].includes(j.status)).length;
          const done = cJobs.filter(j => j.status === "done").length;
          const anyOverdue = cJobs.some(j => j.status === "overdue");
          const monthHours = logs
            .filter(l => cJobs.some(j => j.id === l.jobId))
            .filter(l => { const d = new Date(l.date); return d.getMonth() === cur.m && d.getFullYear() === cur.y; })
            .reduce((s,l)=>s+l.hours,0);
          return (
            <div key={c.id} className="card-surface p-5 relative" data-testid={`client-${c.id}`}>
              {anyOverdue && <span className="absolute top-3 right-3 chip status-overdue"><AlertTriangle size={10} /> Overdue</span>}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm mono" style={{ background: c.color }}>{c.short}</div>
                <div>
                  <div className="text-[14px] font-semibold text-slate-900">{c.name}</div>
                  <div className="text-[11px] mono text-slate-500">{c.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div>
                  <div className="text-[10px] uppercase mono tracking-widest text-slate-500">Active jobs</div>
                  <div className="mono text-lg font-semibold" style={{ color: c.color }}>{active}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase mono tracking-widest text-slate-500">Done</div>
                  <div className="mono text-lg font-semibold text-slate-900">{done}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase mono tracking-widest text-slate-500">Monthly retainer</div>
                  <div className="mono text-slate-900">{fmtINR(c.retainer)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase mono tracking-widest text-slate-500">Hours (mo)</div>
                  <div className="mono text-slate-900">{monthHours}h</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
