import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Loader2, TrendingUp } from "lucide-react";

// Compact client-workload snapshot — used inside job creation forms so the team
// can set realistic deadlines and priorities.
export default function ClientWorkloadWidget({ clientId, clientName, users = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    setLoading(true);
    api.get(`/clients/${clientId}/workload`)
      .then(({ data }) => { if (alive) setData(data); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div className="rounded-[12px] border border-[#E5E8F0] bg-slate-50/60 p-4" data-testid="client-workload-widget">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] mono uppercase tracking-widest text-slate-500">
          <TrendingUp size={12} /> {clientName || "Client"} · current workload
        </div>
        {loading && <Loader2 size={12} className="animate-spin text-slate-400" />}
      </div>

      {!loading && data && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <Metric label="Open jobs" value={data.total_open} tone={data.total_open > 6 ? "red" : data.total_open > 3 ? "amber" : "green"} />
            <Metric label="Active" value={data.by_status.active || 0} />
            <Metric label="In review" value={data.by_status.review || 0} tone="purple" />
            <Metric label="Overdue" value={data.by_status.overdue || 0} tone={data.by_status.overdue ? "red" : "default"} />
          </div>

          {data.upcoming?.length > 0 && (
            <div>
              <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1.5">Next 5 due for this client</div>
              <div className="space-y-1">
                {data.upcoming.map((j) => (
                  <div key={j.id} className="flex items-center gap-2 text-[12px]" data-testid={`workload-job-${j.id}`}>
                    <span className="mono text-[10px] text-slate-400 w-14">{j.id}</span>
                    <span className="text-slate-800 flex-1 truncate">{j.title}</span>
                    <span className={`chip priority-${j.priority || "medium"} text-[9px]`}>{j.priority}</span>
                    <span className="mono text-[10px] text-slate-500 w-16 text-right">{j.due || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.total_open === 0 && (
            <div className="text-[12px] text-slate-500 italic">No open work — great time to add something new.</div>
          )}

          {(data.by_status.overdue || 0) > 0 && (
            <div className="mt-3 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              ⚠️ {data.by_status.overdue} overdue for this client — consider tackling those first before adding new work.
            </div>
          )}
          {data.total_open > 6 && (data.by_status.overdue || 0) === 0 && (
            <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              💡 Heavy load ({data.total_open} open) — buffer the new deadline by an extra 2–3 days.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "default" }) {
  const colors = {
    default: "text-slate-900",
    green:   "text-emerald-600",
    amber:   "text-amber-600",
    red:     "text-red-600",
    purple:  "text-purple-600",
  };
  return (
    <div className="bg-white rounded-md border border-[#E5E8F0] px-2 py-1.5">
      <div className="text-[9px] mono uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mono text-lg font-semibold ${colors[tone]}`}>{value}</div>
    </div>
  );
}
