import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtDate, avatarFor } from "../lib/constants";
import { Play, Pause, RotateCcw, Timer as TimerIcon } from "lucide-react";

function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef(null);
  const intRef = useRef(null);
  const start = () => {
    if (running) return;
    startRef.current = Date.now() - elapsed;
    intRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    setRunning(true);
  };
  const pause = () => { if (intRef.current) clearInterval(intRef.current); setRunning(false); };
  const reset = () => { pause(); const v = elapsed; setElapsed(0); return v; };
  return { elapsed, running, start, pause, reset };
}

const fmtStopwatch = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2,"0");
  const m = String(Math.floor((s % 3600)/60)).padStart(2,"0");
  const sec = String(s % 60).padStart(2,"0");
  return `${h}:${m}:${sec}`;
};

export default function TimeTracker() {
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [jobId, setJobId] = useState("");
  const [notes, setNotes] = useState("");
  const timer = useTimer();

  const load = async () => {
    const [j, u, c, l] = await Promise.all([api.get("/jobs"), api.get("/users"), api.get("/clients"), api.get("/timelogs")]);
    setJobs(j.data); setUsers(u.data); setClients(c.data); setLogs(l.data);
    if (!jobId && j.data.length) setJobId(j.data[0].id);
  };
  useEffect(() => { load(); }, []);

  const doReset = async () => {
    const ms = timer.reset();
    const hours = Math.max(Math.round((ms / 3600000) * 100) / 100, 0.01);
    if (!jobId) { toast.error("Pick a job"); return; }
    const uid = JSON.parse(localStorage.getItem("os_user") || "null")?.id;
    await api.post("/timelogs", { jobId, date: new Date().toISOString().slice(0,10), hours, person: uid, notes });
    toast.success(`Logged ${hours}h to ${jobId}`);
    setNotes("");
    load();
  };

  // hours per client this month
  const now = new Date();
  const monthLogs = logs.filter(l => { const d = new Date(l.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const hoursByClient = clients.map(c => {
    const cJobIds = new Set(jobs.filter(j => j.client === c.id).map(j => j.id));
    const hours = monthLogs.filter(l => cJobIds.has(l.jobId)).reduce((s,l) => s + l.hours, 0);
    return { c, hours };
  });
  const maxClientHours = Math.max(1, ...hoursByClient.map(x => x.hours));

  const teamHours = users.map(u => {
    const total = logs.filter(l => l.person === u.id).reduce((s,l) => s + l.hours, 0);
    return { u, total };
  });
  const maxHours = Math.max(1, ...teamHours.map(t => t.total));

  return (
    <div className="space-y-5" data-testid="time-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Work</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Time Tracker</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <div className="card-surface p-6" data-testid="stopwatch">
            <div className="flex items-center gap-2 text-[11px] uppercase mono tracking-widest text-slate-500 mb-2"><TimerIcon size={14} /> Stopwatch</div>
            <div className="mono text-6xl font-semibold text-slate-900 tracking-tight">{fmtStopwatch(timer.elapsed)}</div>
            <div className="mt-4 flex gap-2 items-center flex-wrap">
              <select value={jobId} onChange={e => setJobId(e.target.value)} data-testid="job-select" className="h-10 px-3 border border-[#E5E8F0] rounded-md text-sm bg-white">
                {jobs.map(j => <option key={j.id} value={j.id}>{j.id} · {j.title.slice(0,40)}</option>)}
              </select>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="h-10 flex-1 px-3 border border-[#E5E8F0] rounded-md text-sm" />
              {!timer.running
                ? <button onClick={timer.start} data-testid="timer-start" className="h-10 px-4 rounded-md bg-emerald-500 text-white text-sm font-semibold flex items-center gap-1 hover:bg-emerald-600"><Play size={14} /> Start</button>
                : <button onClick={timer.pause} data-testid="timer-pause" className="h-10 px-4 rounded-md bg-amber-500 text-white text-sm font-semibold flex items-center gap-1 hover:bg-amber-600"><Pause size={14} /> Pause</button>
              }
              <button onClick={doReset} data-testid="timer-reset" className="h-10 px-4 rounded-md bg-slate-900 text-white text-sm font-semibold flex items-center gap-1"><RotateCcw size={14} /> Log & reset</button>
            </div>
          </div>

          <div className="card-surface overflow-hidden" data-testid="time-log">
            <div className="p-4 border-b border-[#E5E8F0] text-[11px] uppercase mono tracking-widest text-slate-500">Time log</div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase mono tracking-widest text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">Job</th>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Duration</th>
                  <th className="text-left px-4 py-2">Person</th>
                  <th className="text-left px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => {
                  const u = users.find(x => x.id === l.person);
                  return (
                    <tr key={l.id} className="border-t border-[#E5E8F0]">
                      <td className="px-4 py-2 mono text-slate-700">{l.jobId}</td>
                      <td className="px-4 py-2 mono text-slate-500">{l.date}</td>
                      <td className="px-4 py-2 mono text-slate-900">{l.hours}h</td>
                      <td className="px-4 py-2 text-slate-700">{u?.name || l.person}</td>
                      <td className="px-4 py-2 text-slate-500">{l.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card-surface p-5" data-testid="hours-per-client">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3">Hours per client · this month</div>
            <div className="space-y-3">
              {hoursByClient.map(({c, hours}) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-slate-800 font-medium" style={{ color: c.color }}>{c.name}</span>
                    <span className="mono text-slate-900 font-medium">{hours}h</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(hours/maxClientHours)*100}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface p-5" data-testid="team-hours">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3">Team hours this month</div>
            <div className="space-y-2">
              {teamHours.map(({u, total}) => (
                <div key={u.id} className="flex items-center gap-2">
                  <img src={avatarFor(u)} alt={u.name} className="w-6 h-6 rounded-full" />
                  <div className="flex-1">
                    <div className="text-[12px] text-slate-800">{u.name}</div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1"><div className="h-full bg-[#4361EE] rounded-full" style={{ width: `${(total/maxHours)*100}%` }} /></div>
                  </div>
                  <div className="mono text-[12px] text-slate-500">{total}h</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
