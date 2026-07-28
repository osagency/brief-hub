import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtINR } from "../lib/constants";import { Sparkles, Printer, Loader2 } from "lucide-react";

const PERIODS = ["weekly", "monthly", "quarterly"];

export default function Reports() {
  const [period, setPeriod] = useState(null);
  const [insights, setInsights] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/clients"), api.get("/jobs")]).then(([c,j]) => { setClients(c.data); setJobs(j.data); });
  }, []);

  const run = async (p) => {
    setPeriod(p); setLoading(true); setInsights(""); setStats(null);
    try {
      const { data } = await api.post("/reports/insights", { period: p });
      setInsights(data.insights); setStats(data.stats);
    } catch (e) { toast.error("Failed"); }
    finally { setLoading(false); }
  };

  const clientBreakdown = clients.map(c => {
    const cJobs = jobs.filter(j => j.client === c.id);
    return { c, total: cJobs.length, done: cJobs.filter(j => j.status === "done").length, overdue: cJobs.filter(j => j.status === "overdue").length };
  });

  const maxJobs = Math.max(1, ...clientBreakdown.map(x => x.total));

  return (
    <div className="space-y-5" data-testid="reports-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Intelligence</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Reports</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PERIODS.map(p => (
          <button key={p} onClick={() => run(p)} data-testid={`report-${p}`} className={`card-surface p-6 text-left hover:border-[#4361EE] transition ${period === p ? "border-[#4361EE]" : ""}`}>
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Report</div>
            <div className="text-xl font-semibold text-slate-900 capitalize mt-1">{p}</div>
            <div className="text-sm text-slate-500 mt-1">AI-generated insights + client breakdown + velocity.</div>
          </button>
        ))}
      </div>

      {period && (
        <div className="card-surface p-6 fade-in-up" data-testid="report-output">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-slate-900 capitalize">{period} report</h2>
            <button onClick={() => window.print()} data-testid="print-report" className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm flex items-center gap-1"><Printer size={14} /> Print</button>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <Stat label="Jobs done" value={stats.jobsDone} />
              <Stat label="Overdue" value={stats.overdue} color="#EF4444" />
              <Stat label="Utilisation" value={stats.utilisation} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Client breakdown</div>
              <table className="w-full text-sm border border-[#E5E8F0] rounded-md overflow-hidden">
                <thead className="bg-slate-50 text-[10px] uppercase mono tracking-widest text-slate-500">
                  <tr><th className="px-3 py-2 text-left">Client</th><th className="px-3 py-2 text-left">Jobs</th><th className="px-3 py-2 text-left">Done</th><th className="px-3 py-2 text-left">Overdue</th></tr>
                </thead>
                <tbody>
                  {clientBreakdown.map(({c, total, done, overdue}) => (
                    <tr key={c.id} className="border-t border-[#E5E8F0]">
                      <td className="px-3 py-2"><span className="chip" style={{ background: c.color + "1A", color: c.color }}>{c.name}</span></td>
                      <td className="px-3 py-2 mono">{total}</td>
                      <td className="px-3 py-2 mono text-emerald-600">{done}</td>
                      <td className="px-3 py-2 mono text-red-600">{overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Job velocity</div>
              <div className="space-y-2">
                {clientBreakdown.map(({c, total}) => (
                  <div key={c.id}>
                    <div className="flex justify-between text-[11px] mono text-slate-500"><span>{c.name}</span><span>{total} jobs</span></div>
                    <div className="h-2.5 bg-slate-100 rounded-full mt-0.5"><div className="h-full rounded-full" style={{ width: `${(total/maxJobs)*100}%`, background: c.color }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2 flex items-center gap-1"><Sparkles size={12} className="text-[#4361EE]" /> AI insights</div>
            <div className="bg-slate-50 border border-[#E5E8F0] rounded-md p-4 whitespace-pre-wrap text-sm text-slate-800 min-h-[120px]">
              {loading ? <div className="flex items-center gap-2 text-slate-500"><Loader2 size={14} className="animate-spin" /> Thinking…</div> : insights}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "#0F172A" }) {
  return (
    <div className="border border-[#E5E8F0] rounded-md p-3 bg-white">
      <div className="text-[10px] uppercase mono tracking-widest text-slate-500">{label}</div>
      <div className="mono text-lg font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
