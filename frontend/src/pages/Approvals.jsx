import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtDate } from "../lib/constants";
import { CheckCircle2, RotateCcw, Undo2 } from "lucide-react";

export default function Approvals() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [revisingId, setRevisingId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [isManager, setIsManager] = useState(false);

  const load = async () => {
    const [a, c] = await Promise.all([api.get("/approvals"), api.get("/clients")]);
    setItems(a.data); setClients(c.data);
    setIsManager(JSON.parse(localStorage.getItem("os_user") || "null")?.is_admin);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id, action, fb = "") => {
    await api.post(`/approvals/${id}/decide`, { action, feedback: fb });
    toast.success("Updated.");
    setRevisingId(null); setFeedback("");
    load();
  };

  return (
    <div className="space-y-5" data-testid="approvals-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Work</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Client Approvals</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(a => {
          const c = clients.find(x => x.id === a.client) || {};
          const tone = { pending: "priority-medium", approved: "status-done", rejected: "status-overdue" }[a.status];
          return (
            <div key={a.id} className="card-surface p-5" data-testid={`approval-${a.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] mono text-slate-400">{a.jobId} · sent {fmtDate(a.sent)}</div>
                  <div className="text-[15px] font-semibold text-slate-900 mt-1">{a.title}</div>
                  <div className="text-[12px]" style={{ color: c.color }}>{c.name}</div>
                </div>
                <span className={`chip ${tone}`}>{a.status === "pending" ? "Awaiting" : a.status === "approved" ? "Approved ✅" : "Revision 🔄"}</span>
              </div>
              <div className="text-sm text-slate-600 mt-3 leading-relaxed">{a.preview}</div>
              {a.status === "rejected" && a.feedback && (
                <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 text-[13px] rounded-md p-3">
                  <div className="text-[11px] uppercase mono tracking-widest mb-0.5">Client feedback</div>
                  {a.feedback}
                </div>
              )}

              {isManager && (
                <div className="flex gap-2 mt-4">
                  {a.status === "pending" && (
                    <>
                      <button onClick={() => decide(a.id, "approve")} data-testid={`approve-${a.id}`} className="px-3 h-9 rounded-md bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> Mark approved</button>
                      <button onClick={() => setRevisingId(a.id)} data-testid={`revise-${a.id}`} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm hover:bg-slate-50 flex items-center gap-1"><RotateCcw size={14} /> Request revision</button>
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
