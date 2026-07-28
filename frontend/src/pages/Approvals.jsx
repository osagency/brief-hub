import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtDate } from "../lib/constants";
import { CheckCircle2, RotateCcw, Undo2, MessageSquare, Send, Bell, Clock, RefreshCw } from "lucide-react";

const daysAgo = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.max(0, Math.round((now - d) / (1000 * 60 * 60 * 24)));
  if (diff === 0) return "today";
  if (diff === 1) return "1 day ago";
  return `${diff} days ago`;
};

export default function Approvals() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [me, setMe] = useState(null);
  const [revisingId, setRevisingId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [commentDraft, setCommentDraft] = useState({});
  const [reminding, setReminding] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    const [a, c] = await Promise.all([api.get("/approvals"), api.get("/clients")]);
    setItems(a.data); setClients(c.data);
    setMe(JSON.parse(localStorage.getItem("os_user") || "null"));
  };
  useEffect(() => { load(); }, []);

  const isManager = me?.is_admin;

  const decide = async (id, action, fb = "") => {
    await api.post(`/approvals/${id}/decide`, { action, feedback: fb });
    toast.success("Updated.");
    setRevisingId(null); setFeedback("");
    load();
  };

  const remind = async (id) => {
    setReminding(r => ({ ...r, [id]: true }));
    try {
      await api.post(`/approvals/${id}/reminder`);
      toast.success("Reminder logged. (Real email requires Resend integration.)");
      load();
    } finally {
      setReminding(r => ({ ...r, [id]: false }));
    }
  };

  const postComment = async (id) => {
    const text = (commentDraft[id] || "").trim();
    if (!text) return;
    await api.post(`/approvals/${id}/comments`, { text });
    setCommentDraft(d => ({ ...d, [id]: "" }));
    load();
  };

  const filtered = statusFilter === "all" ? items : items.filter(a => a.status === statusFilter);

  // Stats row
  const pending = items.filter(a => a.status === "pending").length;
  const approved = items.filter(a => a.status === "approved").length;
  const revising = items.filter(a => a.status === "rejected").length;

  return (
    <div className="space-y-5" data-testid="approvals-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Work</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Client Approvals</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Awaiting" value={pending} color="#F59E0B" testid="stat-awaiting" />
        <StatCard label="Approved" value={approved} color="#10B981" testid="stat-approved" />
        <StatCard label="Revising" value={revising} color="#EF4444" testid="stat-revising" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "All" },
          { key: "pending", label: "Awaiting" },
          { key: "approved", label: "Approved" },
          { key: "rejected", label: "Revising" },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)} data-testid={`filter-${f.key}`} className={`px-3 py-1.5 rounded-full text-[12px] font-medium ${statusFilter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{f.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(a => {
          const c = clients.find(x => x.id === a.client) || {};
          const tone = { pending: "priority-medium", approved: "status-done", rejected: "status-overdue" }[a.status];
          const label = a.status === "pending" ? "Awaiting" : a.status === "approved" ? "Approved ✅" : "Revising 🔄";
          const remindCount = a.reminder_count || 0;
          return (
            <div key={a.id} className="card-surface p-5" data-testid={`approval-${a.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] mono text-slate-400">{a.jobId}</div>
                  <div className="text-[15px] font-semibold text-slate-900 mt-1">{a.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-[11px]">
                    <span style={{ color: c.color }} className="font-medium">{c.name}</span>
                    <span className="text-slate-400 mono">·</span>
                    <span className="text-slate-500 mono flex items-center gap-1"><Clock size={11} /> sent {daysAgo(a.sent)}</span>
                    {remindCount > 0 && <><span className="text-slate-400">·</span><span className="text-slate-500 mono">{remindCount} reminder{remindCount>1?"s":""}</span></>}
                  </div>
                </div>
                <span className={`chip ${tone}`}>{label}</span>
              </div>

              <div className="text-sm text-slate-600 mt-3 leading-relaxed bg-slate-50 rounded-md p-3">{a.preview}</div>

              {a.status === "rejected" && a.feedback && (
                <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 text-[13px] rounded-md p-3" data-testid={`feedback-${a.id}`}>
                  <div className="text-[11px] uppercase mono tracking-widest mb-0.5">Client feedback</div>
                  {a.feedback}
                </div>
              )}

              {/* Comment thread */}
              {(a.comments || []).length > 0 && (
                <div className="mt-3 space-y-2" data-testid={`comments-${a.id}`}>
                  <div className="text-[11px] uppercase mono tracking-widest text-slate-500 flex items-center gap-1"><MessageSquare size={11} /> Internal notes</div>
                  {(a.comments || []).map(cm => (
                    <div key={cm.id} className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-700">{cm.author?.[0]}</div>
                      <div className="flex-1">
                        <div className="text-[11px]"><span className="font-semibold text-slate-900">{cm.author}</span> <span className="text-slate-400 mono ml-1">{fmtDate(cm.at)}</span></div>
                        <div className="text-[13px] text-slate-700">{cm.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <input value={commentDraft[a.id] || ""} onChange={e => setCommentDraft(d => ({ ...d, [a.id]: e.target.value }))} onKeyDown={e => e.key === "Enter" && postComment(a.id)} placeholder="Add an internal note…" data-testid={`comment-input-${a.id}`} className="flex-1 h-9 px-3 border border-[#E5E8F0] rounded-md text-sm" />
                <button onClick={() => postComment(a.id)} className="px-3 h-9 rounded-md bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-700 flex items-center gap-1"><Send size={11} /> Post</button>
              </div>

              {isManager && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {a.status === "pending" && (
                    <>
                      <button onClick={() => decide(a.id, "approve")} data-testid={`approve-${a.id}`} className="px-3 h-9 rounded-md bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> Mark approved</button>
                      <button onClick={() => setRevisingId(a.id)} data-testid={`revise-${a.id}`} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm hover:bg-slate-50 flex items-center gap-1"><RotateCcw size={14} /> Request revision</button>
                      <button onClick={() => remind(a.id)} disabled={reminding[a.id]} data-testid={`remind-${a.id}`} className="px-3 h-9 rounded-md border border-amber-300 text-amber-700 text-sm hover:bg-amber-50 flex items-center gap-1 ml-auto disabled:opacity-60">
                        {reminding[a.id] ? <RefreshCw size={13} className="animate-spin" /> : <Bell size={13} />} Send reminder
                      </button>
                    </>
                  )}
                  {a.status !== "pending" && (
                    <button onClick={() => decide(a.id, "reopen")} data-testid={`reopen-${a.id}`} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm hover:bg-slate-50 flex items-center gap-1"><Undo2 size={14} /> Reopen</button>
                  )}
                </div>
              )}

              {revisingId === a.id && (
                <div className="mt-3">
                  <textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Client feedback…" className="w-full p-3 border border-[#E5E8F0] rounded-md text-sm" data-testid={`feedback-input-${a.id}`} />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => { setRevisingId(null); setFeedback(""); }} className="px-3 h-8 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
                    <button onClick={() => decide(a.id, "revise", feedback)} className="px-3 h-8 rounded-md bg-amber-500 text-white text-sm">Save feedback</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, testid }) {
  return (
    <div className="card-surface p-4" data-testid={testid}>
      <div className="text-[11px] uppercase mono tracking-widest text-slate-500">{label}</div>
      <div className="mono text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
