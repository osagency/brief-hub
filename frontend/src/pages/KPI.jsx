import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { avatarFor } from "../lib/constants";
import { Sparkles, TrendingUp, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

const PERIODS = ["weekly", "monthly", "quarterly"];

function Ring({ value }) {
  const size = 90, stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / 10));
  const color = value >= 9 ? "#10B981" : value >= 8 ? "#4361EE" : value >= 7 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} stroke="#E5E8F0" strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-pct)} style={{ transition: "stroke-dashoffset 400ms" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle" transform={`rotate(90 ${size/2} ${size/2})`} className="mono" fontSize={20} fontWeight={600} fill="#0F172A">{value.toFixed(1)}</text>
    </svg>
  );
}

const scoreOf = (e) => (e.quality + e.csat + e.deadline + e.comm + e.initiative + e.collab) / 6;

export default function KPI() {
  const [period, setPeriod] = useState("monthly");
  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [teamReview, setTeamReview] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [coach, setCoach] = useState({ open: false, member: null, text: "", loading: false });
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({ memberId: "u_priya", period: "monthly", periodLabel: "Feb 2026", jobsDone: 10, onTime: 90, quality: 8.5, csat: 8.5, deadline: 8.5, comm: 8.5, initiative: 8.5, collab: 8.5, good: "", improve: "", actions: [] });

  const load = async () => {
    const [k, u] = await Promise.all([api.get("/kpi", { params: { period } }), api.get("/users")]);
    setEntries(k.data); setUsers(u.data);
  };
  useEffect(() => { load(); }, [period]);

  const withUser = entries.map(e => ({ e, u: users.find(x => x.id === e.memberId) })).filter(x => x.u);
  const ranked = [...withUser].sort((a,b) => scoreOf(b.e) - scoreOf(a.e));

  const avg = withUser.length ? withUser.reduce((s,x) => s + scoreOf(x.e), 0) / withUser.length : 0;
  const top = ranked[0];
  const needsFocus = ranked[ranked.length - 1];
  const jobsDoneTotal = withUser.reduce((s,x) => s + x.e.jobsDone, 0);

  const runTeamReview = async () => {
    setReviewLoading(true);
    try {
      const { data } = await api.post("/kpi/team-review");
      setTeamReview(data.review);
    } catch (e) { toast.error("Team review failed"); }
    finally { setReviewLoading(false); }
  };

  const openCoach = async (entry, user) => {
    setCoach({ open: true, member: user, text: "", loading: true });
    try {
      const { data } = await api.post("/kpi/coaching", { kpiId: entry.id });
      setCoach(c => ({ ...c, text: data.advice, loading: false }));
    } catch (e) { setCoach(c => ({ ...c, text: "Failed", loading: false })); }
  };

  const submitLog = async (e) => {
    e.preventDefault();
    await api.post("/kpi", form);
    toast.success("KPI review logged.");
    setLogOpen(false);
    load();
  };

  return (
    <div className="space-y-5" data-testid="kpi-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Team</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">KPI &amp; Performance</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={runTeamReview} disabled={reviewLoading} data-testid="ai-team-review" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-60">
            {reviewLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} AI team review
          </button>
          <button onClick={() => setLogOpen(true)} data-testid="log-review" className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm hover:bg-slate-50">Log review</button>
        </div>
      </div>

      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)} data-testid={`period-${p}`} className={`px-3 py-1.5 rounded-full text-[12px] font-medium capitalize ${period === p ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{p}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-surface p-5"><div className="text-[11px] uppercase mono tracking-widest text-slate-500">Avg team score</div><div className="mono text-3xl font-semibold text-slate-900 mt-2">{avg.toFixed(1)}<span className="text-slate-400 text-lg">/10</span></div></div>
        <div className="card-surface p-5"><div className="text-[11px] uppercase mono tracking-widest text-slate-500">Top performer</div><div className="text-lg font-semibold text-emerald-600 mt-2">{top?.u?.name || "—"}</div><div className="text-[11px] mono text-slate-500">{top ? scoreOf(top.e).toFixed(1) : ""}</div></div>
        <div className="card-surface p-5"><div className="text-[11px] uppercase mono tracking-widest text-slate-500">Jobs done</div><div className="mono text-3xl font-semibold text-slate-900 mt-2">{jobsDoneTotal}</div></div>
        <div className="card-surface p-5"><div className="text-[11px] uppercase mono tracking-widest text-slate-500">Needs focus</div><div className="text-lg font-semibold text-red-600 mt-2">{needsFocus?.u?.name || "—"}</div><div className="text-[11px] mono text-slate-500">{needsFocus ? scoreOf(needsFocus.e).toFixed(1) : ""}</div></div>
      </div>

      {teamReview && (
        <div className="card-surface p-5 fade-in-up" data-testid="team-review-output">
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2 flex items-center gap-1"><Sparkles size={12} className="text-[#4361EE]" /> AI team review</div>
          <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">{teamReview}</div>
        </div>
      )}

      <div className="card-surface overflow-hidden" data-testid="kpi-table">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase mono tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Rank</th>
              <th className="px-4 py-2 text-left">Member</th>
              <th className="px-4 py-2 text-left">Jobs</th>
              <th className="px-4 py-2 text-left">On-time</th>
              <th className="px-4 py-2 text-left">Quality</th>
              <th className="px-4 py-2 text-left">CSAT</th>
              <th className="px-4 py-2 text-left">Score</th>
              <th className="px-4 py-2 text-left">Trend</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({e, u}, idx) => {
              const s = scoreOf(e);
              const trendUp = e.trend?.length > 1 && e.trend[e.trend.length-1] > e.trend[e.trend.length-2];
              return (
                <tr key={u.id} className="border-t border-[#E5E8F0]">
                  <td className="px-4 py-2 mono">#{idx+1}</td>
                  <td className="px-4 py-2"><div className="flex items-center gap-2"><img src={avatarFor(u)} className="w-6 h-6 rounded-full" alt={u.name} /><span>{u.name}</span></div></td>
                  <td className="px-4 py-2 mono">{e.jobsDone}</td>
                  <td className="px-4 py-2 mono">{e.onTime}%</td>
                  <td className="px-4 py-2 mono">{e.quality.toFixed(1)}</td>
                  <td className="px-4 py-2 mono">{e.csat.toFixed(1)}</td>
                  <td className="px-4 py-2 mono font-semibold">{s.toFixed(1)}</td>
                  <td className="px-4 py-2">{trendUp ? <ArrowUp size={14} className="text-emerald-500" /> : <ArrowDown size={14} className="text-red-500" />}</td>
                </tr>
              );
            })}
            {ranked.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400 text-sm">No entries for this period.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ranked.map(({e, u}) => (
          <div key={u.id} className="card-surface p-5" data-testid={`kpi-card-${u.id}`}>
            <div className="flex items-center gap-3">
              <img src={avatarFor(u)} className="w-10 h-10 rounded-full" alt={u.name} />
              <div>
                <div className="text-[14px] font-semibold text-slate-900">{u.name}</div>
                <div className="text-[11px] mono text-slate-500">{u.role_label}</div>
              </div>
              <div className="ml-auto"><Ring value={scoreOf(e)} /></div>
            </div>
            <div className="mt-4 space-y-2 text-[12px]">
              <Bar label="Quality" v={e.quality} color="#4361EE" />
              <Bar label="CSAT" v={e.csat} color="#10B981" />
              <Bar label="Avg" v={scoreOf(e)} color="#8B5CF6" />
            </div>
            <button onClick={() => openCoach(e, u)} data-testid={`coach-${u.id}`} className="mt-4 w-full h-9 rounded-md border border-[#4361EE] text-[#4361EE] text-sm font-semibold hover:bg-[#4361EE]/5 flex items-center justify-center gap-1"><Sparkles size={14} /> AI coaching</button>
          </div>
        ))}
      </div>

      {coach.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCoach({ open: false })}>
          <div className="bg-white rounded-[12px] w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="coach-modal">
            <div className="flex items-center gap-2 mb-3"><Sparkles size={14} className="text-[#4361EE]" /><div className="text-[13px] font-semibold">Coaching for {coach.member?.name}</div></div>
            {coach.loading ? <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 size={14} className="animate-spin"/> Thinking…</div> : <div className="whitespace-pre-wrap text-sm text-slate-700">{coach.text}</div>}
            <div className="flex justify-end mt-4"><button onClick={() => setCoach({ open: false })} className="px-3 h-8 rounded-md bg-slate-900 text-white text-sm">Close</button></div>
          </div>
        </div>
      )}

      {logOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLogOpen(false)}>
          <form onSubmit={submitLog} className="bg-white rounded-[12px] w-full max-w-lg p-6 shadow-2xl space-y-2 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="log-modal">
            <div className="text-[13px] font-semibold text-slate-900 mb-2">Log KPI review</div>
            <select value={form.memberId} onChange={e => setForm({ ...form, memberId: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
              {users.filter(u => u.id !== "u_yusuf").map(u => <option key={u.id} value={u.id}>{u.name} — {u.role_label}</option>)}
            </select>
            <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
              {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={form.periodLabel} onChange={e => setForm({ ...form, periodLabel: e.target.value })} placeholder="Period label (e.g. Feb 2026)" className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" />
            <div className="grid grid-cols-2 gap-2">
              {["jobsDone","onTime","quality","csat","deadline","comm","initiative","collab"].map(k => (
                <label key={k} className="text-[11px] mono text-slate-500 flex flex-col">{k}
                  <input type="number" step={k==="jobsDone"||k==="onTime"?1:0.1} value={form[k]} onChange={e => setForm({ ...form, [k]: Number(e.target.value) })} className="mt-1 h-9 px-2 border border-[#E5E8F0] rounded-md text-sm" />
                </label>
              ))}
            </div>
            <textarea rows={2} placeholder="What went well" value={form.good} onChange={e => setForm({ ...form, good: e.target.value })} className="w-full p-2 border border-[#E5E8F0] rounded-md text-sm" />
            <textarea rows={2} placeholder="Needs improvement" value={form.improve} onChange={e => setForm({ ...form, improve: e.target.value })} className="w-full p-2 border border-[#E5E8F0] rounded-md text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLogOpen(false)} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              <button type="submit" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Save review</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Bar({ label, v, color }) {
  const pct = Math.max(0, Math.min(1, v / 10)) * 100;
  return (
    <div>
      <div className="flex justify-between text-[10px] mono text-slate-500"><span>{label}</span><span>{v.toFixed(1)}</span></div>
      <div className="h-1.5 bg-slate-100 rounded-full mt-0.5"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}
