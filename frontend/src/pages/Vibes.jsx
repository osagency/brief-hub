import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { AVATAR, QUOTES, ROLE_EMOJI, ROLE_LABEL, XP_LEVEL } from "../lib/constants";
import { Crown, RotateCw, Trophy, Flame } from "lucide-react";

const BADGES = {
  writer: ["📝","🎯","📚"],
  designer: ["🎨","🌟","💎"],
  mktg: ["📊","🚀","🔍"],
  webdev: ["💻","⚡","🛠️"],
  clientsvc: ["🤝","💬","🧭"],
  manager: ["👔","🧠","🧭"],
};

const scoreOf = (e) => (e.quality + e.csat + e.deadline + e.comm + e.initiative + e.collab) / 6;

export default function Vibes() {
  const [users, setUsers] = useState([]);
  const [kpi, setKpi] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [qIdx, setQIdx] = useState(0);

  useEffect(() => {
    Promise.all([api.get("/users"), api.get("/kpi", { params: { period: "monthly" } }), api.get("/jobs")])
      .then(([u,k,j]) => { setUsers(u.data); setKpi(k.data); setJobs(j.data); });
  }, []);

  const withScore = users.filter(u => u.id !== "u_yusuf").map(u => {
    const e = kpi.find(x => x.memberId === u.id);
    const s = e ? scoreOf(e) : 0;
    const active = jobs.filter(j => (j.assignees || []).includes(u.id) && ["active","todo","review","overdue"].includes(j.status)).length;
    const done = jobs.filter(j => (j.assignees || []).includes(u.id) && j.status === "done").length;
    return { u, score: s, active, done };
  }).sort((a,b) => b.score - a.score);

  const quote = QUOTES[qIdx % QUOTES.length];
  const rotate = () => setQIdx(i => i + 1);

  return (
    <div className="space-y-5" data-testid="vibes-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Intelligence</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1 flex items-center gap-2"><Trophy className="text-amber-500" size={20} /> Team Vibes</h1>
      </div>

      {/* Motivation banner */}
      <div className="rounded-[16px] p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(120deg, #8B5CF6 0%, #EC4899 100%)" }} data-testid="motivation-banner">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-widest mono opacity-70">Vibe of the day</div>
            <div className="text-2xl font-semibold mt-2 leading-snug">
              <span className="mr-2">{quote.emoji}</span>{quote.text}
            </div>
            <div className="text-[11px] mono opacity-80 mt-2">— {quote.author}</div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1 text-sm"><Flame size={14} /> <span className="mono">7-day streak</span></div>
            <button onClick={rotate} data-testid="rotate-quote" className="bg-white text-slate-900 rounded-full px-3 py-1.5 text-[12px] font-semibold flex items-center gap-1 hover:bg-white/90"><RotateCw size={12} /> New</button>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="card-surface p-5" data-testid="leaderboard">
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3">Leaderboard</div>
        <div className="space-y-2">
          {withScore.map((x, i) => {
            const medal = ["🥇","🥈","🥉"][i] || `${i+1}.`;
            return (
              <div key={x.u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition">
                <div className="w-6 text-center mono text-slate-500">{medal}</div>
                <img src={AVATAR[x.u.id]} className="w-8 h-8 rounded-full" alt={x.u.name} />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-slate-900">{x.u.name}</div>
                  <div className="text-[11px] mono text-slate-500">{x.u.role_label}</div>
                </div>
                <div className="mono text-[14px] font-semibold" style={{ color: x.score >= 8.5 ? "#10B981" : x.score >= 7.5 ? "#4361EE" : "#F59E0B" }}>{x.score.toFixed(1)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {withScore.map((x, i) => {
          const level = XP_LEVEL(x.score);
          const xpPct = Math.min(100, (x.score / 10) * 100);
          const badges = BADGES[x.u.role_key] || [];
          return (
            <div key={x.u.id} className="card-surface p-5 relative" data-testid={`vibes-card-${x.u.id}`}>
              {i === 0 && <Crown className="absolute top-3 right-3 text-amber-500" size={18} />}
              <div className="flex items-center gap-3">
                <img src={AVATAR[x.u.id]} className="w-12 h-12 rounded-full" alt={x.u.name} />
                <div>
                  <div className="text-[14px] font-semibold text-slate-900">{x.u.name}</div>
                  <div className="text-[11px] mono text-slate-500">{x.u.role_label}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-[12px]">
                <div><div className="text-[10px] mono text-slate-500 uppercase tracking-widest">Active</div><div className="mono text-lg text-slate-900">{x.active}</div></div>
                <div><div className="text-[10px] mono text-slate-500 uppercase tracking-widest">Done</div><div className="mono text-lg text-emerald-600">{x.done}</div></div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-[11px] mono text-slate-500"><span>XP · {level}</span><span>{x.score.toFixed(1)}/10</span></div>
                <div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${xpPct}%`, background: "linear-gradient(90deg, #8B5CF6, #EC4899)" }} /></div>
              </div>

              <div className="flex gap-1 mt-3 text-lg">
                {badges.map((b, j) => <span key={j} title={`${x.u.role_label} badge`}>{b}</span>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
