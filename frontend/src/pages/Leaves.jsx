import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import { CalendarCheck, Plus, X, Check, XCircle, Users as UsersIcon, Loader2, Info } from "lucide-react";

const TYPES = [
  { key: "PL", label: "Privilege",    color: "#4361EE" },
  { key: "CL", label: "Casual",       color: "#10B981" },
  { key: "SL", label: "Sick",         color: "#EF4444" },
  { key: "CO", label: "Comp-Off",     color: "#8B5CF6" },
];

const STATUS_TONE = { pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800" };

export default function Leaves() {
  const { user, isManager } = useAuth();
  const [balance, setBalance] = useState(null);
  const [applications, setApplications] = useState([]);
  const [teamCalendar, setTeamCalendar] = useState([]);
  const [users, setUsers] = useState([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState(false);

  const load = async () => {
    const [b, a, tc, u] = await Promise.all([
      api.get("/hr/leaves/balance"),
      api.get("/hr/leaves"),
      api.get("/hr/leaves/team-calendar"),
      api.get("/users"),
    ]);
    setBalance(b.data); setApplications(a.data); setTeamCalendar(tc.data); setUsers(u.data);
  };
  useEffect(() => { load(); }, []);

  const nameOf = (id) => users.find(u => u.id === id)?.name || id;

  const remaining = (t) => {
    if (!balance) return 0;
    return (balance.balances?.[t] || 0) - (balance.used?.[t] || 0);
  };

  const [pending, others] = useMemo(() => {
    const p = applications.filter(a => a.status === "pending");
    const o = applications.filter(a => a.status !== "pending");
    return [p, o];
  }, [applications]);

  const visible = pendingTab ? pending : applications;

  return (
    <div className="space-y-6" data-testid="leaves-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">People</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Leaves</h1>
          <div className="text-sm text-slate-500 mt-1">Apply, track balances, and see who's out.</div>
        </div>
        <button onClick={() => setApplyOpen(true)} data-testid="apply-leave-btn" className="px-3 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold hover:bg-[#3651d0] flex items-center gap-1"><Plus size={14} /> Apply for leave</button>
      </div>

      {balance && !balance.eligible && (
        <div className="rounded-[12px] p-4 bg-amber-50 border border-amber-200 flex items-start gap-2 text-[13px] text-amber-800" data-testid="probation-notice">
          <Info size={14} className="mt-0.5" />
          <div>You're still on your 3-month probation period. Leave entitlement becomes active once probation ends.</div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TYPES.map(t => (
          <div key={t.key} className="card-surface p-4" data-testid={`balance-${t.key}`}>
            <div className="text-[10px] mono uppercase tracking-widest text-slate-500">{t.label}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <div className="text-3xl font-semibold mono" style={{ color: t.color }}>{remaining(t.key)}</div>
              <div className="text-[11px] mono text-slate-400">/ {balance?.balances?.[t.key] || 0}</div>
            </div>
            <div className="text-[11px] mono text-slate-500">used {balance?.used?.[t.key] || 0}</div>
          </div>
        ))}
        <div className="card-surface p-4" data-testid="balance-PH">
          <div className="text-[10px] mono uppercase tracking-widest text-slate-500">Public Holidays</div>
          <div className="mt-2 flex items-baseline gap-1">
            <div className="text-3xl font-semibold mono text-slate-900">{(balance?.balances?.PH || 0) - (balance?.used?.PH || 0)}</div>
            <div className="text-[11px] mono text-slate-400">/ {balance?.balances?.PH || 0}</div>
          </div>
          <div className="text-[11px] mono text-slate-500">Auto-tracked from calendar</div>
        </div>
      </div>

      {teamCalendar.length > 0 && (
        <div className="card-surface p-5" data-testid="team-out-widget">
          <div className="flex items-center gap-2 mb-3">
            <UsersIcon size={14} className="text-slate-400" />
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Who's out — approved leaves</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {teamCalendar.slice(0, 12).map(l => (
              <div key={l.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] flex items-center gap-1.5" data-testid={`team-out-${l.id}`}>
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(nameOf(l.user_id))}&background=4361EE&color=fff&size=32`} className="w-5 h-5 rounded-full" alt="" />
                <span className="text-slate-800 font-medium">{nameOf(l.user_id)}</span>
                <span className="text-slate-500">·</span>
                <span className="mono text-slate-500">{l.from_date} → {l.to_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={() => setPendingTab(false)} className={`chip ${!pendingTab ? "status-active" : ""}`} data-testid="tab-all">All ({applications.length})</button>
        <button onClick={() => setPendingTab(true)} className={`chip ${pendingTab ? "status-active" : ""}`} data-testid="tab-pending">Pending ({pending.length})</button>
      </div>

      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm" data-testid="leave-applications-table">
          <thead className="bg-slate-50 text-[10px] uppercase mono tracking-widest text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Employee</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Dates</th>
              <th className="text-left px-4 py-2">Days</th>
              <th className="text-left px-4 py-2">Lead</th>
              <th className="text-left px-4 py-2">Status</th>
              {isManager && <th className="text-right px-4 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-6">No applications</td></tr>
            )}
            {visible.map(l => (
              <LeaveRow key={l.id} leave={l} nameOf={nameOf} isManager={isManager} onChange={load} />
            ))}
          </tbody>
        </table>
      </div>

      {applyOpen && <ApplyLeaveModal onClose={() => setApplyOpen(false)} users={users.filter(u => u.id !== user.id)} onCreated={load} balance={balance} />}
    </div>
  );
}

function LeaveRow({ leave, nameOf, isManager, onChange }) {
  const [note, setNote] = useState("");
  const [action, setAction] = useState(null);
  const decide = async (decision) => {
    try {
      await api.post(`/hr/leaves/${leave.id}/decide`, { decision, note });
      toast.success(`Leave ${decision}`);
      setAction(null); setNote("");
      onChange?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };
  const typeMeta = TYPES.find(t => t.key === leave.type) || { color: "#94A3B8", label: leave.type };
  return (
    <>
      <tr className="border-t border-[#E5E8F0]" data-testid={`leave-row-${leave.id}`}>
        <td className="px-4 py-3 text-slate-900 font-medium">{nameOf(leave.user_id)}</td>
        <td className="px-4 py-3"><span className="chip" style={{ background: typeMeta.color + "1A", color: typeMeta.color }}>{typeMeta.label}</span></td>
        <td className="px-4 py-3 mono text-[12px] text-slate-600">{leave.from_date} → {leave.to_date}</td>
        <td className="px-4 py-3 mono text-slate-900">{leave.days}</td>
        <td className="px-4 py-3 text-slate-600">{nameOf(leave.lead_person_id)}</td>
        <td className="px-4 py-3"><span className={`chip ${STATUS_TONE[leave.status]}`}>{leave.status}</span></td>
        {isManager && (
          <td className="px-4 py-3 text-right">
            {leave.status === "pending" ? (
              <div className="inline-flex items-center gap-1">
                <button onClick={() => setAction("approve")} data-testid={`approve-${leave.id}`} className="px-2 h-7 rounded-md bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600 flex items-center gap-1"><Check size={11} /> Approve</button>
                <button onClick={() => setAction("reject")} data-testid={`reject-${leave.id}`} className="px-2 h-7 rounded-md bg-red-500 text-white text-[11px] font-semibold hover:bg-red-600 flex items-center gap-1"><XCircle size={11} /> Reject</button>
              </div>
            ) : (
              <span className="text-[11px] mono text-slate-400">{leave.decision_note || "—"}</span>
            )}
          </td>
        )}
      </tr>
      <tr className="bg-slate-50/50 border-t border-[#E5E8F0]"><td colSpan={7} className="px-4 py-2 text-[12px] text-slate-600"><span className="mono text-slate-400">Reason:</span> {leave.reason} · <span className="mono text-slate-400">Handover:</span> {leave.handover_notes}</td></tr>
      {action && (
        <tr className="bg-white border-t border-[#E5E8F0]">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <input value={note} onChange={e => setNote(e.target.value)} placeholder={`Optional note for ${action}...`} className="flex-1 h-9 px-3 rounded-md border border-[#E5E8F0] text-sm" data-testid={`decide-note-${leave.id}`} />
              <button onClick={() => decide(action === "approve" ? "approved" : "rejected")} data-testid={`confirm-${action}-${leave.id}`} className={`px-3 h-9 rounded-md text-white text-sm font-semibold ${action === "approve" ? "bg-emerald-500" : "bg-red-500"}`}>Confirm {action}</button>
              <button onClick={() => setAction(null)} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ApplyLeaveModal({ onClose, users, onCreated, balance }) {
  const [form, setForm] = useState({ type: "PL", from_date: "", to_date: "", reason: "", lead_person_id: "", handover_notes: "" });
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => {
    if (!form.from_date || !form.to_date) return 0;
    const f = new Date(form.from_date); const t = new Date(form.to_date);
    return Math.max(0, Math.round((t - f) / 86400000) + 1);
  }, [form.from_date, form.to_date]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/hr/leaves", form);
      toast.success("Leave application submitted — Yusuf will review.");
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const bigLeave = days >= 3;
  const noticeGap = form.from_date ? Math.round((new Date(form.from_date) - new Date()) / 86400000) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} data-testid="apply-leave-modal">
      <form onSubmit={submit} className="bg-white rounded-[12px] w-full max-w-lg p-6 space-y-4 max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Leave</div>
            <div className="text-lg font-semibold text-slate-900">Apply for leave</div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">Type</div>
            <select data-testid="leave-type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full h-10 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
              {TYPES.map(t => <option key={t.key} value={t.key}>{t.label} (bal {(balance?.balances?.[t.key] || 0) - (balance?.used?.[t.key] || 0)})</option>)}
            </select>
          </label>
          <div className="text-right self-end">
            {days > 0 && <div className="text-[11px] mono text-slate-500">{days} calendar day{days > 1 ? "s" : ""} (sandwich rule applies)</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">From</div>
            <input required type="date" data-testid="leave-from" value={form.from_date} onChange={e => setForm({ ...form, from_date: e.target.value })} className="w-full h-10 px-2 rounded-md border border-[#E5E8F0] text-sm" />
          </label>
          <label className="block">
            <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">To</div>
            <input required type="date" data-testid="leave-to" value={form.to_date} onChange={e => setForm({ ...form, to_date: e.target.value })} className="w-full h-10 px-2 rounded-md border border-[#E5E8F0] text-sm" />
          </label>
        </div>

        {bigLeave && noticeGap < 20 && (
          <div className="text-[11px] bg-red-50 border border-red-200 rounded p-2 text-red-700" data-testid="notice-warning">
            ⚠️ Leaves of 3+ days need 20 days advance notice — you're applying with only {noticeGap} day(s) notice. Manager may reject.
          </div>
        )}

        <label className="block">
          <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">Reason</div>
          <input required maxLength={500} data-testid="leave-reason" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Family function, medical, travel..." className="w-full h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" />
        </label>

        <label className="block">
          <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">Lead person during your absence (required)</div>
          <select required data-testid="leave-lead" value={form.lead_person_id} onChange={e => setForm({ ...form, lead_person_id: e.target.value })} className="w-full h-10 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
            <option value="">Choose a team member…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} · {u.role_label}</option>)}
          </select>
        </label>

        <label className="block">
          <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">Handover notes — what your lead needs to know</div>
          <textarea required maxLength={2000} rows={4} data-testid="leave-handover" value={form.handover_notes} onChange={e => setForm({ ...form, handover_notes: e.target.value })} placeholder="Active jobs, client communications to watch, credentials, pending approvals..." className="w-full p-3 rounded-md border border-[#E5E8F0] text-sm resize-none" />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 h-10 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
          <button type="submit" disabled={busy} data-testid="submit-leave" className="px-4 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1">
            {busy && <Loader2 size={13} className="animate-spin" />} Submit
          </button>
        </div>
      </form>
    </div>
  );
}
