import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import {
  Plus, Search, TrendingUp, LayoutGrid, List, Sparkles, X, RotateCw,
  Loader2, CheckCircle2, Phone, Mail, Linkedin, MessageSquare, AlertTriangle,
  Trash2, ArrowRight, Merge
} from "lucide-react";

const STATUSES = [
  { key: "new",             label: "New",             color: "#94A3B8" },
  { key: "contacted",       label: "Contacted",       color: "#4361EE" },
  { key: "qualified",       label: "Qualified",       color: "#10B981" },
  { key: "nurturing",       label: "Nurturing",       color: "#06B6D4" },
  { key: "call_scheduled",  label: "Call scheduled",  color: "#F59E0B" },
  { key: "proposal_sent",   label: "Proposal sent",   color: "#8B5CF6" },
  { key: "won",             label: "Won",             color: "#059669" },
  { key: "onboarding",      label: "Onboarding",      color: "#EA580C" },
  { key: "lost",            label: "Lost",            color: "#EF4444" },
];

const SOURCES = ["outbound", "inbound", "manual"];
const CHANNELS = ["LinkedIn", "Apollo", "Google Maps", "SEO", "Referral", "Website form", "Event", "Other"];
const LOST_REASONS = [
  { key: "price",       label: "Price" },
  { key: "timing",      label: "Timing" },
  { key: "no_fit",      label: "No fit" },
  { key: "silent",      label: "Went silent" },
  { key: "competitor",  label: "Chose competitor" },
  { key: "other",       label: "Other" },
];

export default function Leads() {
  const { isManager } = useAuth();
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({ proposal_cap_monthly: 8, won_cap_monthly: 5 });
  const [funnel, setFunnel] = useState(null);
  const [view, setView] = useState("table"); // table | board | funnel
  const [q, setQ] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = async () => {
    const [l, u, s, f] = await Promise.all([
      api.get("/leads"), api.get("/users"),
      isManager ? api.get("/leads/settings") : Promise.resolve({ data: settings }),
      api.get("/leads/funnel"),
    ]);
    setLeads(l.data); setUsers(u.data); setSettings(s.data); setFunnel(f.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => leads.filter(l => {
    if (filterSource && l.source !== filterSource) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(l.company?.toLowerCase().includes(s) || l.contact_name?.toLowerCase().includes(s) || l.contact_email?.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [leads, filterSource, filterStatus, q]);

  const nameOf = (id) => users.find(u => u.id === id)?.name || id;

  // Capacity warning
  const proposalCount = leads.filter(l => l.status === "proposal_sent" && l.status_month === new Date().toISOString().slice(0, 7)).length;
  const wonCount = leads.filter(l => (l.status === "won" || l.status === "onboarding") && l.status_month === new Date().toISOString().slice(0, 7)).length;
  const capReached = proposalCount >= settings.proposal_cap_monthly || wonCount >= settings.won_cap_monthly;

  return (
    <div className="space-y-6" data-testid="leads-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Business</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Leads</h1>
          <div className="text-sm text-slate-500 mt-1">Pipeline, dedup, nurture, onboarding — all in one place.</div>
        </div>
        <button onClick={() => setAddOpen(true)} data-testid="add-lead-btn" className="px-3 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold hover:bg-[#3651d0] flex items-center gap-1"><Plus size={14} /> Add lead</button>
      </div>

      {capReached && (
        <div className="rounded-md p-3 bg-amber-50 border border-amber-200 flex items-center gap-2 text-[13px] text-amber-800" data-testid="cap-warning">
          <AlertTriangle size={14} />
          <div>
            Monthly capacity reached ({proposalCount}/{settings.proposal_cap_monthly} Proposals · {wonCount}/{settings.won_cap_monthly} Wins). New deals may strain team capacity.
            {isManager && <button onClick={async () => { const n = window.prompt("New Proposal cap:", settings.proposal_cap_monthly); if (n) { await api.patch("/leads/settings", { proposal_cap_monthly: Number(n) }); load(); } }} className="ml-2 underline">Adjust caps</button>}
          </div>
        </div>
      )}

      {/* Filters + view toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white border border-[#E5E8F0] rounded-md h-9 px-3">
          <Search size={13} className="text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search company, contact, email…" data-testid="lead-search" className="flex-1 bg-transparent outline-none text-sm" />
        </div>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} data-testid="filter-source" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
          <option value="">All sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} data-testid="filter-status" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-1 border border-[#E5E8F0] rounded-md h-9 bg-white ml-auto">
          <button onClick={() => setView("table")} data-testid="view-table" className={`h-9 px-2 text-[12px] flex items-center gap-1 ${view === "table" ? "text-[#4361EE] bg-blue-50" : "text-slate-600"}`}><List size={13} /> Table</button>
          <button onClick={() => setView("board")} data-testid="view-board" className={`h-9 px-2 text-[12px] flex items-center gap-1 ${view === "board" ? "text-[#4361EE] bg-blue-50" : "text-slate-600"}`}><LayoutGrid size={13} /> Board</button>
          <button onClick={() => setView("funnel")} data-testid="view-funnel" className={`h-9 px-2 text-[12px] flex items-center gap-1 ${view === "funnel" ? "text-[#4361EE] bg-blue-50" : "text-slate-600"}`}><TrendingUp size={13} /> Funnel</button>
        </div>
      </div>

      {view === "table" && (
        <div className="card-surface overflow-hidden">
          <table className="w-full text-sm" data-testid="leads-table">
            <thead className="bg-slate-50 text-[10px] mono uppercase tracking-widest text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Company</th>
                <th className="text-left px-4 py-2">Contact</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Owner</th>
                <th className="text-right px-4 py-2">ICP</th>
                <th className="text-right px-4 py-2">Deal ₹</th>
                <th className="text-left px-4 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-slate-400">No leads {q ? "match your search" : "yet"}</td></tr>}
              {filtered.map(l => {
                const st = STATUSES.find(s => s.key === l.status) || STATUSES[0];
                return (
                  <tr key={l.id} onClick={() => setDetailId(l.id)} data-testid={`lead-row-${l.id}`} className="border-t border-[#E5E8F0] hover:bg-slate-50 cursor-pointer">
                    <td className="px-4 py-2 font-medium text-slate-900">{l.company}</td>
                    <td className="px-4 py-2 text-[12px] text-slate-600">{l.contact_name || "—"}<br /><span className="mono text-[10px] text-slate-400">{l.contact_email}</span></td>
                    <td className="px-4 py-2"><span className="chip">{l.source}</span> <span className="text-[10px] mono text-slate-400">{l.channel}</span></td>
                    <td className="px-4 py-2"><span className="chip" style={{ background: st.color + "1A", color: st.color }}>{st.label}</span></td>
                    <td className="px-4 py-2 text-[12px]">{nameOf(l.owner_id)}</td>
                    <td className="px-4 py-2 text-right"><span className={`mono font-semibold ${l.icp_tier === "qualified" ? "text-emerald-600" : "text-slate-500"}`}>{l.icp_score}</span></td>
                    <td className="px-4 py-2 text-right mono">{l.expected_deal_size ? `₹${(l.expected_deal_size / 1000).toFixed(0)}k` : "—"}</td>
                    <td className="px-4 py-2 mono text-[11px] text-slate-500">{new Date(l.last_activity_at).toLocaleDateString("en-IN")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === "board" && <BoardView leads={filtered} nameOf={nameOf} onOpen={setDetailId} onChange={load} />}

      {view === "funnel" && funnel && <FunnelView funnel={funnel} leads={leads} />}

      {addOpen && <AddLeadModal users={users} onClose={() => setAddOpen(false)} onCreated={load} />}
      {detailId && <LeadDetailModal leadId={detailId} users={users} isManager={isManager} onClose={() => setDetailId(null)} onChange={load} />}
    </div>
  );
}

// ---------- BOARD (kanban) ----------
function BoardView({ leads, nameOf, onOpen, onChange }) {
  const [drag, setDrag] = useState(null);
  const cols = STATUSES.filter(s => s.key !== "onboarding");

  const drop = async (statusKey) => {
    if (!drag) return;
    if (drag.status === statusKey) return;
    if (statusKey === "lost") {
      // Open detail so user can supply reason
      onOpen(drag.id);
      setDrag(null);
      return;
    }
    try {
      const { data } = await api.post(`/leads/${drag.id}/status`, { status: statusKey });
      if (data.warning) toast.warning(data.warning);
      else toast.success(`Moved → ${STATUSES.find(s => s.key === statusKey).label}`);
      onChange?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
    finally { setDrag(null); }
  };

  return (
    <div className="grid grid-flow-col auto-cols-[minmax(220px,1fr)] gap-3 overflow-x-auto pb-2" data-testid="leads-board">
      {cols.map(col => {
        const items = leads.filter(l => l.status === col.key);
        return (
          <div key={col.key} onDragOver={e => e.preventDefault()} onDrop={() => drop(col.key)} data-testid={`board-col-${col.key}`} className="bg-slate-50 rounded-lg p-2 min-h-[280px]">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="text-[11px] mono uppercase tracking-widest text-slate-600">{col.label}</span>
              <span className="ml-auto text-[10px] mono text-slate-400">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(l => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={() => setDrag(l)}
                  onClick={() => onOpen(l.id)}
                  data-testid={`board-card-${l.id}`}
                  className="bg-white rounded-md border border-[#E5E8F0] p-2.5 cursor-grab hover:border-[#4361EE] transition"
                >
                  <div className="text-[13px] font-medium text-slate-900">{l.company}</div>
                  <div className="text-[11px] mono text-slate-500 mt-0.5">{l.contact_name || "—"} · {l.channel}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`chip text-[9px] ${l.icp_tier === "qualified" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>ICP {l.icp_score}</span>
                    {l.expected_deal_size > 0 && <span className="text-[10px] mono text-slate-500">₹{(l.expected_deal_size / 1000).toFixed(0)}k</span>}
                    <span className="ml-auto text-[10px] mono text-slate-400">{nameOf(l.owner_id).split(" ")[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- FUNNEL ----------
function FunnelView({ funnel, leads }) {
  const stages = ["contacted", "qualified", "call_scheduled", "proposal_sent", "won"];
  const max = Math.max(...stages.map(s => funnel.counts[s] || 0), 1);
  return (
    <div className="space-y-4" data-testid="funnel-view">
      <div className="card-surface p-5">
        <div className="text-[11px] mono uppercase tracking-widest text-slate-500 mb-3">Pipeline funnel</div>
        <div className="space-y-2">
          {stages.map((s, i) => {
            const st = STATUSES.find(x => x.key === s);
            const count = funnel.counts[s] || 0;
            const value = funnel.value[s] || 0;
            const conv = funnel.conversion[s];
            const width = Math.max(6, (count / max) * 100);
            return (
              <div key={s} className="flex items-center gap-3" data-testid={`funnel-stage-${s}`}>
                <div className="w-28 text-[12px] font-medium text-slate-800">{st.label}</div>
                <div className="flex-1 h-9 bg-slate-100 rounded-md relative overflow-hidden">
                  <div className="h-full flex items-center justify-between px-3 text-white font-semibold" style={{ width: `${width}%`, background: st.color }}>
                    <span className="mono text-sm">{count}</span>
                    {value > 0 && <span className="mono text-[11px]">₹{(value / 1000).toFixed(0)}k</span>}
                  </div>
                </div>
                <div className="w-20 text-right">
                  {i > 0 && conv !== undefined && <span className="mono text-[11px] text-slate-500">{conv}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total pipeline" value={funnel.total} />
        <StatCard label="Won this period" value={funnel.counts.won || 0} />
        <StatCard label="Onboarding" value={funnel.counts.onboarding || 0} />
        <StatCard label="Lost" value={funnel.counts.lost || 0} />
      </div>
    </div>
  );
}
function StatCard({ label, value }) {
  return (
    <div className="card-surface p-4">
      <div className="text-[10px] mono uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 mono">{value}</div>
    </div>
  );
}

// ---------- ADD LEAD MODAL (with dedup preview) ----------
function AddLeadModal({ users, onClose, onCreated }) {
  const [form, setForm] = useState({ company: "", contact_name: "", contact_email: "", contact_phone: "", source: "manual", channel: "Other", status: "new", notes: "", expected_deal_size: 0, owner_id: "" });
  const [dupes, setDupes] = useState([]);
  const [busy, setBusy] = useState(false);

  // Live dedup preview
  useEffect(() => {
    if (!form.company && !form.contact_email) return setDupes([]);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/leads/dedup", { params: { company: form.company, email: form.contact_email } });
        setDupes(data.matches || []);
      } catch {
        setDupes([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [form.company, form.contact_email]);

  const submit = async (allowDup = false) => {
    if (!form.company) return toast.error("Company is required");
    setBusy(true);
    try {
      await api.post("/leads", { ...form, allow_duplicate: allowDup });
      toast.success("Lead added");
      onCreated?.(); onClose();
    } catch (e) {
      if (e?.response?.status === 409) {
        toast.error("Duplicate detected — review below");
      } else toast.error(e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} data-testid="add-lead-modal">
      <div className="bg-white rounded-[12px] w-full max-w-2xl p-6 max-h-[95vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] mono uppercase tracking-widest text-slate-500">Business</div>
            <div className="text-lg font-semibold text-slate-900">Add new lead</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Company *" value={form.company} onChange={v => setForm({ ...form, company: v })} testid="add-company" />
          <Input label="Contact name" value={form.contact_name} onChange={v => setForm({ ...form, contact_name: v })} testid="add-contact-name" />
          <Input label="Contact email" value={form.contact_email} onChange={v => setForm({ ...form, contact_email: v })} testid="add-contact-email" />
          <Input label="Phone" value={form.contact_phone} onChange={v => setForm({ ...form, contact_phone: v })} />
          <Select label="Source" value={form.source} onChange={v => setForm({ ...form, source: v })} options={SOURCES} testid="add-source" />
          <Select label="Channel" value={form.channel} onChange={v => setForm({ ...form, channel: v })} options={CHANNELS} />
          <Select label="Status" value={form.status} onChange={v => setForm({ ...form, status: v })} options={STATUSES.map(s => s.key)} labels={STATUSES.map(s => s.label)} testid="add-status" />
          <Input label="Expected deal size (₹)" type="number" value={form.expected_deal_size || ""} onChange={v => setForm({ ...form, expected_deal_size: Number(v) })} />
          <Select label="Owner" value={form.owner_id} onChange={v => setForm({ ...form, owner_id: v })} options={["", ...users.map(u => u.id)]} labels={["Default (Kritika)", ...users.map(u => u.name)]} />
        </div>

        <label className="block">
          <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">Notes</div>
          <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Description of company, why they fit our ICP, key signals..." className="w-full p-3 rounded-md border border-[#E5E8F0] text-sm" data-testid="add-notes" />
        </label>

        {dupes.length > 0 && (
          <div className="rounded-md p-3 bg-amber-50 border border-amber-200 space-y-2" data-testid="dedup-warning">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900"><AlertTriangle size={13} /> {dupes.length} possible duplicate{dupes.length > 1 ? "s" : ""}</div>
            {dupes.map(d => (
              <div key={d.id} className="text-[12px] flex items-center gap-2">
                <span className="mono text-[10px] text-slate-500">{d.id}</span>
                <span className="text-slate-800 font-medium">{d.company}</span>
                <span className="text-slate-500">·</span>
                <span className="mono text-slate-500">{d.contact_email || "—"}</span>
                <span className="ml-auto chip">{d.status}</span>
              </div>
            ))}
            <button onClick={() => submit(true)} className="text-[11px] mono uppercase tracking-widest text-amber-800 hover:text-amber-950 underline">Create anyway →</button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
          <button onClick={() => submit(false)} disabled={busy} data-testid="submit-lead" className="px-4 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-60">
            {busy && <Loader2 size={13} className="animate-spin" />} Add lead
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", testid }) {
  return (
    <label className="block">
      <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <input data-testid={testid} type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" />
    </label>
  );
}
function Select({ label, value, onChange, options, labels, testid }) {
  return (
    <label className="block">
      <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <select data-testid={testid} value={value} onChange={e => onChange(e.target.value)} className="w-full h-10 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
        {options.map((o, i) => <option key={o + i} value={o}>{labels?.[i] || o}</option>)}
      </select>
    </label>
  );
}

// ---------- LEAD DETAIL MODAL ----------
function LeadDetailModal({ leadId, users, isManager, onClose, onChange }) {
  const [lead, setLead] = useState(null);
  const [touches, setTouches] = useState([]);
  const [tab, setTab] = useState("overview");
  const [newTouch, setNewTouch] = useState({ kind: "note", text: "" });
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState(null);
  const [statusForm, setStatusForm] = useState({ next: "", lost_reason: "price", lost_reason_note: "", recycle_date: "", proposal_link: "" });

  const load = async () => {
    const [l, t] = await Promise.all([api.get(`/leads/${leadId}`), api.get(`/leads/${leadId}/touches`)]);
    setLead(l.data); setTouches(t.data);
  };
  useEffect(() => { load(); }, [leadId]);

  const nameOf = (id) => users.find(u => u.id === id)?.name || id;
  const st = lead ? (STATUSES.find(s => s.key === lead.status) || STATUSES[0]) : null;

  const changeStatus = async () => {
    if (!statusForm.next) return;
    try {
      const payload = { status: statusForm.next };
      if (statusForm.next === "lost") {
        payload.lost_reason = statusForm.lost_reason;
        payload.lost_reason_note = statusForm.lost_reason_note;
        payload.recycle_date = statusForm.recycle_date;
      }
      if (statusForm.next === "proposal_sent" && statusForm.proposal_link) payload.proposal_link = statusForm.proposal_link;
      const { data } = await api.post(`/leads/${leadId}/status`, payload);
      if (data.warning) toast.warning(data.warning);
      else toast.success("Status updated");
      setStatusForm({ next: "", lost_reason: "price", lost_reason_note: "", recycle_date: "", proposal_link: "" });
      load(); onChange?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const addTouch = async () => {
    if (!newTouch.text) return;
    await api.post(`/leads/${leadId}/touches`, newTouch);
    setNewTouch({ kind: "note", text: "" });
    load();
  };

  const generateDraft = async () => {
    setDrafting(true);
    try {
      const { data } = await api.post(`/leads/${leadId}/ai-draft`);
      setDraft(data);
    } catch (e) { toast.error("AI draft failed"); }
    finally { setDrafting(false); }
  };

  const scheduleBooking = async () => {
    const when = window.prompt("Meeting time (ISO / YYYY-MM-DDTHH:mm):");
    if (!when) return;
    await api.post(`/leads/${leadId}/booking`, { scheduled_at: when });
    toast.success("Booking captured — call scheduled");
    load(); onChange?.();
  };

  const updateOnboarding = async (key, value) => {
    const { data } = await api.post(`/leads/${leadId}/onboarding`, { [key]: value });
    setLead(data);
    if (data.onboarding?.complete) toast.success("Onboarding complete — client handoff fired 🎉");
    onChange?.();
  };

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-stretch justify-end" onClick={onClose} data-testid="lead-detail-modal">
      <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-3 border-b border-[#E5E8F0]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="chip" style={{ background: st.color + "1A", color: st.color }}>{st.label}</span>
                <span className="chip">{lead.source}</span>
                <span className="text-[10px] mono text-slate-400">{lead.channel}</span>
              </div>
              <div className="text-xl font-semibold text-slate-900 mt-1.5 truncate">{lead.company}</div>
              <div className="text-[12px] text-slate-600 mt-0.5">{lead.contact_name || "—"} · <span className="mono">{lead.contact_email || "—"}</span> · {lead.contact_phone || "—"}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 flex items-center justify-center"><X size={16} /></button>
          </div>
          <div className="flex gap-3 mt-3">
            <TabBtn onClick={() => setTab("overview")} active={tab === "overview"} testid="tab-overview">Overview</TabBtn>
            <TabBtn onClick={() => setTab("touches")} active={tab === "touches"} testid="tab-touches">Activity ({touches.length})</TabBtn>
            <TabBtn onClick={() => setTab("draft")} active={tab === "draft"} testid="tab-draft"><Sparkles size={12} /> AI intro</TabBtn>
            {(lead.status === "won" || lead.status === "onboarding") && <TabBtn onClick={() => setTab("onboarding")} active={tab === "onboarding"} testid="tab-onboarding">Onboarding</TabBtn>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Fact label="Owner" value={nameOf(lead.owner_id)} />
                <Fact label="First touch" value={new Date(lead.first_touch_at).toLocaleDateString("en-IN")} />
                <Fact label="Last activity" value={new Date(lead.last_activity_at).toLocaleDateString("en-IN")} />
                <Fact label="Expected deal size" value={lead.expected_deal_size ? `₹${(lead.expected_deal_size / 1000).toFixed(0)}k` : "—"} />
                <Fact label="ICP score / tier" value={`${lead.icp_score} · ${lead.icp_tier}`} />
                {lead.recycle_date && <Fact label="Recycle on" value={lead.recycle_date} />}
              </div>

              <div>
                <div className="text-[11px] mono uppercase tracking-widest text-slate-500 mb-2">ICP flags</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    ["family_run", "Family-run business"], ["startup", "Startup"], ["other_b2b", "Other B2B"],
                    ["gap_or_funding", "Marketing gap / recent funding"], ["responsive_48h", "Responsive within 48h"],
                  ].map(([k, l]) => (
                    <label key={k} className="text-[12px] flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!lead.icp_flags?.[k]}
                        disabled={!isManager && k === "responsive_48h"}
                        onChange={async (e) => {
                          const { data } = await api.patch(`/leads/${leadId}`, { icp_flags: { [k]: e.target.checked } });
                          setLead(data);
                        }}
                        data-testid={`icp-${k}`}
                      />
                      {l}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] mono uppercase tracking-widest text-slate-500 mb-2">Notes</div>
                <textarea rows={3} value={lead.notes || ""} onChange={async e => { setLead({ ...lead, notes: e.target.value }); }} onBlur={async e => { await api.patch(`/leads/${leadId}`, { notes: e.target.value }); }} className="w-full p-3 rounded-md border border-[#E5E8F0] text-sm" data-testid="lead-notes" />
              </div>

              <div className="rounded-md p-3 bg-slate-50 border border-[#E5E8F0] space-y-2">
                <div className="text-[11px] mono uppercase tracking-widest text-slate-500">Move to next stage</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={statusForm.next} onChange={e => setStatusForm({ ...statusForm, next: e.target.value })} data-testid="next-status" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
                    <option value="">Choose next status…</option>
                    {STATUSES.filter(s => s.key !== lead.status).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  {lead.status !== "call_scheduled" && <button onClick={scheduleBooking} className="h-9 px-2 text-[11px] rounded-md bg-amber-500 text-white font-semibold flex items-center gap-1"><Phone size={11} /> Schedule call</button>}
                </div>
                {statusForm.next === "lost" && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E5E8F0]">
                    <Select label="Reason" value={statusForm.lost_reason} onChange={v => setStatusForm({ ...statusForm, lost_reason: v })} options={LOST_REASONS.map(r => r.key)} labels={LOST_REASONS.map(r => r.label)} testid="lost-reason" />
                    <Input label="Recycle date" type="date" value={statusForm.recycle_date} onChange={v => setStatusForm({ ...statusForm, recycle_date: v })} testid="recycle-date" />
                    <div className="col-span-2"><Input label="Reason detail (optional)" value={statusForm.lost_reason_note} onChange={v => setStatusForm({ ...statusForm, lost_reason_note: v })} /></div>
                  </div>
                )}
                {statusForm.next === "proposal_sent" && (
                  <div><Input label="Proposal link (optional)" value={statusForm.proposal_link} onChange={v => setStatusForm({ ...statusForm, proposal_link: v })} testid="proposal-link" /></div>
                )}
                {statusForm.next && <button onClick={changeStatus} data-testid="confirm-status" className="h-9 px-3 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1 mt-1"><ArrowRight size={12} /> Confirm move</button>}
              </div>
            </>
          )}

          {tab === "touches" && (
            <>
              <div className="card-surface p-3 space-y-2" data-testid="add-touch">
                <div className="flex gap-2">
                  <select value={newTouch.kind} onChange={e => setNewTouch({ ...newTouch, kind: e.target.value })} className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
                    <option value="note">Note</option>
                    <option value="call">Call</option>
                    <option value="email">Email</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="meeting">Meeting</option>
                  </select>
                  <input value={newTouch.text} onChange={e => setNewTouch({ ...newTouch, text: e.target.value })} placeholder="What happened?" className="flex-1 h-9 px-3 rounded-md border border-[#E5E8F0] text-sm" data-testid="touch-text" />
                  <button onClick={addTouch} data-testid="add-touch-btn" className="h-9 px-3 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Log</button>
                </div>
              </div>
              <div className="space-y-2">
                {touches.length === 0 && <div className="text-sm text-slate-400 text-center py-4">No activity yet</div>}
                {touches.map(t => {
                  const iconMap = { call: Phone, email: Mail, linkedin: Linkedin, meeting: CheckCircle2, note: MessageSquare };
                  const Icon = iconMap[t.kind] || MessageSquare;
                  return (
                    <div key={t.id} className="flex items-start gap-2 p-3 rounded-md border border-[#E5E8F0]" data-testid={`touch-${t.id}`}>
                      <Icon size={14} className="text-slate-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-[10px] mono uppercase tracking-widest text-slate-500 flex items-center gap-2">
                          <span>{t.kind}</span>
                          <span>·</span>
                          <span>{new Date(t.timestamp).toLocaleString("en-IN")}</span>
                          <span>·</span>
                          <span>{nameOf(t.author_id)}</span>
                        </div>
                        <div className="text-[13px] text-slate-800 mt-0.5 whitespace-pre-wrap">{t.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "draft" && (
            <div className="space-y-3" data-testid="ai-draft-tab">
              <button onClick={generateDraft} disabled={drafting} className="px-3 h-9 rounded-md bg-purple-100 text-purple-800 text-[12px] font-semibold flex items-center gap-1 disabled:opacity-60" data-testid="gen-draft">
                {drafting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {drafting ? "Drafting…" : "Draft intro email with Claude"}
              </button>
              {draft && (
                <div className="card-surface p-4 space-y-3" data-testid="draft-output">
                  <div>
                    <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">Subject</div>
                    <div className="text-[14px] font-semibold text-slate-900">{draft.subject}</div>
                  </div>
                  <div>
                    <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-1">Body</div>
                    <div className="text-[13px] text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-md p-3">{draft.body}</div>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(`Subject: ${draft.subject}\n\n${draft.body}`); toast.success("Draft copied to clipboard"); }} className="text-[11px] mono uppercase tracking-widest text-[#4361EE] hover:underline">Copy to clipboard</button>
                </div>
              )}
            </div>
          )}

          {tab === "onboarding" && (
            <div className="space-y-3" data-testid="onboarding-tab">
              <div className="text-[12px] text-slate-600">Complete all 4 steps to trigger the client-servicing handoff and auto-create the client in the system.</div>
              {[
                ["contract_sent",         "Contract sent"],
                ["contract_signed",       "Contract signed"],
                ["payment_confirmed",     "Deposit / payment confirmed"],
                ["first_brief_scheduled", "First brief scheduled"],
              ].map(([k, l]) => (
                <label key={k} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${lead.onboarding?.[k] ? "border-emerald-300 bg-emerald-50/50" : "border-[#E5E8F0]"}`} data-testid={`onb-${k}`}>
                  <input type="checkbox" checked={!!lead.onboarding?.[k]} onChange={e => updateOnboarding(k, e.target.checked)} disabled={!isManager} />
                  <span className="text-[13px] text-slate-800">{l}</span>
                  {lead.onboarding?.[k] && <CheckCircle2 size={13} className="text-emerald-500 ml-auto" />}
                </label>
              ))}
              {lead.onboarding?.complete && (
                <div className="rounded-md p-3 bg-emerald-50 border border-emerald-200 text-[12px] text-emerald-800">
                  🎉 Onboarding complete — client auto-created and handoff notified.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ onClick, active, children, testid }) {
  return (
    <button onClick={onClick} data-testid={testid} className={`text-[12px] font-medium pb-2 border-b-2 -mb-px flex items-center gap-1 ${active ? "text-[#4361EE] border-[#4361EE]" : "text-slate-500 border-transparent"}`}>{children}</button>
  );
}
function Fact({ label, value }) {
  return (
    <div>
      <div className="text-[10px] mono uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-slate-800 text-[13px] mono">{value}</div>
    </div>
  );
}
