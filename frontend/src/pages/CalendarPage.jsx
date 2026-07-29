import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Plus, CalendarDays, Sparkles } from "lucide-react";
import ManageFestivalsModal, { FEST_COLOR, FEST_LABEL } from "../components/ManageFestivalsModal";
import { useAuth } from "../lib/auth";

const STATUS_COLOR = {
  planned: "#94A3B8",
  draft: "#F59E0B",
  review: "#8B5CF6",
  approved: "#10B981",
  published: "#4361EE",
};

const PLATFORMS = ["LinkedIn", "Instagram", "Blog", "Email", "WhatsApp"];

export default function CalendarPage() {
  const { isManager } = useAuth();
  const [posts, setPosts] = useState([]);
  const [clients, setClients] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [filter, setFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [festOpen, setFestOpen] = useState(false);
  const [popover, setPopover] = useState(null);
  const [festPopover, setFestPopover] = useState(null);
  const [form, setForm] = useState({ client: "galalite", platform: "LinkedIn", date: "", topic: "", status: "planned" });
  const [monthOffset, setMonthOffset] = useState(0);

  const load = async () => {
    const [p, c, f] = await Promise.all([api.get("/content-posts"), api.get("/clients"), api.get("/festivals")]);
    setPosts(p.data); setClients(c.data); setFestivals(f.data);
  };
  useEffect(() => { load(); }, []);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const isCurrentMonth = monthOffset === 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now;

  const cellPosts = useMemo(() => {
    const map = {};
    posts.forEach(p => {
      if (filter !== "all" && p.client !== filter) return;
      const d = new Date(p.date);
      if (d.getMonth() !== month || d.getFullYear() !== year) return;
      const key = `${p.client}-${d.getDate()}`;
      map[key] = map[key] || [];
      map[key].push(p);
    });
    return map;
  }, [posts, filter, month, year]);

  // Festival map for this month (day-of-month -> [festival])
  const festByDay = useMemo(() => {
    const map = {};
    festivals.forEach((f) => {
      const d = new Date(f.date);
      if (d.getMonth() !== month || d.getFullYear() !== year) return;
      const day = d.getDate();
      (map[day] = map[day] || []).push(f);
    });
    return map;
  }, [festivals, month, year]);

  // Upcoming festivals across next 60 days (for the strip at top)
  const upcomingFestivals = useMemo(() => {
    const nowIso = now.toISOString().slice(0, 10);
    const horizon = new Date(now.getTime() + 60 * 86400000).toISOString().slice(0, 10);
    return festivals.filter((f) => f.date >= nowIso && f.date <= horizon).slice(0, 8);
  }, [festivals, now]);

  const visibleClients = filter === "all" ? clients : clients.filter(c => c.id === filter);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/content-posts", form);
    toast.success("Post added.");
    setAddOpen(false);
    load();
  };

  return (
    <div className="space-y-5" data-testid="calendar-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Work</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Content Calendar</h1>
          <div className="flex items-center gap-2 mt-1">
            <button data-testid="prev-month" onClick={() => setMonthOffset((o) => o - 1)} className="w-7 h-7 rounded-md hover:bg-slate-100 text-slate-500 text-sm">‹</button>
            <div className="text-sm text-slate-500 mono min-w-[140px] text-center">{viewDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
            <button data-testid="next-month" onClick={() => setMonthOffset((o) => o + 1)} className="w-7 h-7 rounded-md hover:bg-slate-100 text-slate-500 text-sm">›</button>
            {monthOffset !== 0 && (
              <button data-testid="reset-month" onClick={() => setMonthOffset(0)} className="text-[11px] text-[#4361EE] hover:underline">jump to today</button>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={filter} onChange={e => setFilter(e.target.value)} data-testid="calendar-filter" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
            <option value="all">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setFestOpen(true)} data-testid="manage-festivals-btn" className="px-3 h-9 rounded-md border border-[#E5E8F0] text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1"><CalendarDays size={13} /> Manage important dates</button>
          <button onClick={() => setAddOpen(true)} data-testid="add-post-btn" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold hover:bg-[#3651d0] flex items-center gap-1"><Plus size={14} /> Add post</button>
        </div>
      </div>

      {/* Upcoming festivals strip */}
      {upcomingFestivals.length > 0 && (
        <div className="card-surface p-4" data-testid="upcoming-festivals-strip">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[#F59E0B]" />
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Upcoming · next 60 days</div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {upcomingFestivals.map((f) => {
              const d = new Date(f.date);
              const days = Math.max(0, Math.round((d - now) / 86400000));
              return (
                <button
                  key={f.id}
                  onClick={() => setFestPopover(f)}
                  data-testid={`upcoming-fest-${f.id}`}
                  className="flex-shrink-0 w-36 text-left rounded-lg border border-[#E5E8F0] px-3 py-2 hover:border-[#4361EE] transition bg-white"
                >
                  <div className="text-[10px] mono uppercase tracking-widest" style={{ color: FEST_COLOR[f.type] }}>{FEST_LABEL[f.type]}</div>
                  <div className="text-[13px] font-semibold text-slate-900 truncate mt-0.5">{f.name}</div>
                  <div className="text-[11px] mono text-slate-500 mt-0.5">{d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · in {days}d</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] mono">
        <div className="flex items-center gap-1.5 text-slate-400">Posts:</div>
        {Object.entries(STATUS_COLOR).map(([k,v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: v }} />
            <span className="text-slate-600 capitalize">{k}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-slate-400 ml-2">Dates:</div>
        {Object.entries(FEST_LABEL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: FEST_COLOR[k] }} />
            <span className="text-slate-600">{v}</span>
          </div>
        ))}
      </div>

      <div className="card-surface overflow-auto">
        <table className="w-full text-[11px] mono" data-testid="calendar-grid">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="text-left px-3 py-2 sticky left-0 bg-slate-50 w-40">Client</th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayN = i + 1;
                const isToday = isCurrentMonth && dayN === today.getDate();
                const fest = festByDay[dayN] || [];
                return (
                  <th key={i} className={`text-center px-1 py-2 min-w-[28px] ${isToday ? "text-[#4361EE] font-bold" : ""}`}>
                    <div>{dayN}</div>
                    {fest.length > 0 && (
                      <button
                        onClick={() => setFestPopover(fest[0])}
                        data-testid={`fest-header-${fest[0].id}`}
                        title={fest.map((f) => f.name).join(", ")}
                        className="mx-auto mt-0.5 block w-2 h-2 rounded-sm hover:scale-125 transition"
                        style={{ background: FEST_COLOR[fest[0].type] }}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleClients.map(c => (
              <tr key={c.id} className="border-t border-[#E5E8F0]">
                <td className="px-3 py-2 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                    <span className="text-slate-800 text-[12px] font-medium not-italic" style={{ fontFamily: "Inter" }}>{c.name}</span>
                  </div>
                </td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const dayN = i + 1;
                  const key = `${c.id}-${dayN}`;
                  const cellItems = cellPosts[key] || [];
                  const fest = festByDay[dayN] || [];
                  const cellBg = fest.length > 0 ? `${FEST_COLOR[fest[0].type]}0D` : undefined;
                  return (
                    <td key={i} className="px-1 py-1 text-center border-l border-[#F1F5F9]" style={{ background: cellBg }}>
                      {cellItems.length > 0 && (
                        <div className="flex flex-col items-center gap-0.5">
                          {cellItems.slice(0,2).map(p => (
                            <button key={p.id} onClick={() => setPopover(p)} data-testid={`post-${p.id}`} title={p.topic} className="w-3 h-3 rounded-full" style={{ background: STATUS_COLOR[p.status] }} />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Festival popover */}
      {festPopover && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setFestPopover(null)}>
          <div className="bg-white rounded-[12px] w-full max-w-sm p-5" onClick={e => e.stopPropagation()} data-testid="festival-popover">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: FEST_COLOR[festPopover.type] }} />
              <div className="text-[11px] mono uppercase tracking-widest text-slate-500">{FEST_LABEL[festPopover.type]}</div>
            </div>
            <div className="text-lg font-semibold text-slate-900 mt-1">{festPopover.name}</div>
            <div className="text-[11px] mono text-slate-500 mt-0.5">{new Date(festPopover.date).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
            {festPopover.description && <div className="text-sm text-slate-600 mt-3 leading-relaxed">{festPopover.description}</div>}
            <div className="flex justify-end mt-4"><button onClick={() => setFestPopover(null)} className="px-3 h-8 rounded-md bg-slate-900 text-white text-sm">Close</button></div>
          </div>
        </div>
      )}

      <ManageFestivalsModal open={festOpen} onClose={() => setFestOpen(false)} canManage={isManager} onChanged={load} />

      {popover && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setPopover(null)}>
          <div className="bg-white rounded-[12px] w-full max-w-sm p-5" onClick={e => e.stopPropagation()} data-testid="post-popover">
            <div className="text-[11px] mono text-slate-500">{popover.date}</div>
            <div className="text-sm font-semibold text-slate-900 mt-1">{popover.topic}</div>
            <div className="mt-2 flex gap-2 text-[11px]">
              <span className="chip status-active">{popover.platform}</span>
              <span className="chip" style={{ background: STATUS_COLOR[popover.status] + "22", color: STATUS_COLOR[popover.status] }}>{popover.status}</span>
            </div>
            <div className="flex justify-end mt-3"><button onClick={() => setPopover(null)} className="px-3 h-8 rounded-md bg-slate-900 text-white text-sm">Close</button></div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <form onSubmit={submit} className="bg-white rounded-[12px] w-full max-w-md p-6 shadow-2xl space-y-3" onClick={e => e.stopPropagation()} data-testid="add-post-modal">
            <div className="text-[13px] font-semibold text-slate-900">New content post</div>
            <select value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
            <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="post-date" />
            <input type="text" required placeholder="Topic" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="post-topic" />
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
              {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              <button type="submit" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Add</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
