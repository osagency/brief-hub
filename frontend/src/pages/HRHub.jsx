import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import {
  Cake, Sparkles, Megaphone, BookOpen, Users as UsersIcon, Utensils,
  MessagesSquare, HeartPulse, Wallet, Lock, Plus, Trash2, X, Loader2, Save, Check
} from "lucide-react";

const TABS = [
  { key: "people",    label: "People",         icon: UsersIcon },
  { key: "culture",   label: "Culture",        icon: Utensils },
  { key: "announce",  label: "Announcements",  icon: Megaphone },
  { key: "feedback",  label: "1:1 & Wellness", icon: HeartPulse, managerOnly: true },
  { key: "policies",  label: "Policies",       icon: BookOpen },
  { key: "reimb",     label: "Reimbursements", icon: Wallet },
  { key: "vault",     label: "Salary Vault",   icon: Lock, managerOnly: true },
];

export default function HRHub() {
  const { user, isManager } = useAuth();
  const [tab, setTab] = useState("people");

  const visibleTabs = TABS.filter(t => !t.managerOnly || isManager);

  return (
    <div className="space-y-6" data-testid="hr-hub">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">People & Culture</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">HR</h1>
        <div className="text-sm text-slate-500 mt-1">Everything about the team — profiles, policies, engagement, and more.</div>
      </div>

      <div className="flex gap-1.5 flex-wrap border-b border-[#E5E8F0]">
        {visibleTabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`hr-tab-${t.key}`}
              className={`px-3 h-10 text-sm font-medium flex items-center gap-1.5 border-b-2 -mb-px transition ${tab === t.key ? "text-[#4361EE] border-[#4361EE]" : "text-slate-500 border-transparent hover:text-slate-800"}`}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "people" && <PeopleTab isManager={isManager} />}
        {tab === "culture" && <CultureTab isManager={isManager} />}
        {tab === "announce" && <AnnouncementsTab isManager={isManager} user={user} />}
        {tab === "feedback" && isManager && <FeedbackTab />}
        {tab === "policies" && <PoliciesTab isManager={isManager} />}
        {tab === "reimb" && <ReimbursementsTab isManager={isManager} />}
        {tab === "vault" && isManager && <VaultTab />}
      </div>
    </div>
  );
}

// ---------- PEOPLE ----------
function PeopleTab({ isManager }) {
  const [users, setUsers] = useState([]);
  const [dash, setDash] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const [u, d] = await Promise.all([api.get("/users"), isManager ? api.get("/hr/dashboard") : Promise.resolve({ data: null })]);
    setUsers(u.data); setDash(d.data);
  };
  useEffect(() => { load(); }, [isManager]);

  return (
    <div className="space-y-6" data-testid="tab-people">
      {isManager && dash && (dash.upcoming_birthdays.length > 0 || dash.upcoming_anniversaries.length > 0 || dash.on_notice.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MiniPanel title="🎂 Upcoming birthdays" testid="upcoming-birthdays">
            {dash.upcoming_birthdays.length === 0 && <div className="text-[12px] text-slate-400">None in the next 30 days</div>}
            {dash.upcoming_birthdays.map(b => (
              <div key={b.user.id} className="text-[13px] flex items-center gap-2 py-1">
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(b.user.name)}&background=EC4899&color=fff&size=32`} className="w-6 h-6 rounded-full" alt="" />
                <span className="text-slate-800 font-medium">{b.user.name}</span>
                <span className="text-slate-500">·</span>
                <span className="mono text-slate-500">{b.days_away === 0 ? "TODAY 🎉" : `in ${b.days_away}d`}</span>
              </div>
            ))}
          </MiniPanel>
          <MiniPanel title="🎉 Work anniversaries" testid="upcoming-anniversaries">
            {dash.upcoming_anniversaries.length === 0 && <div className="text-[12px] text-slate-400">None in the next 30 days</div>}
            {dash.upcoming_anniversaries.map(a => (
              <div key={a.user.id} className="text-[13px] flex items-center gap-2 py-1">
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(a.user.name)}&background=F59E0B&color=fff&size=32`} className="w-6 h-6 rounded-full" alt="" />
                <span className="text-slate-800 font-medium">{a.user.name}</span>
                <span className="text-slate-500">·</span>
                <span className="mono text-slate-500">{a.years}yr · in {a.days_away}d</span>
              </div>
            ))}
          </MiniPanel>
          <MiniPanel title="🚪 On notice period" testid="on-notice">
            {dash.on_notice.length === 0 && <div className="text-[12px] text-slate-400">Nobody</div>}
            {dash.on_notice.map(u => (
              <div key={u.id} className="text-[13px] flex items-center gap-2 py-1">
                <span className="text-slate-800 font-medium">{u.name}</span>
                <span className="text-slate-500">·</span>
                <span className="mono text-slate-500">since {u.notice_start?.slice(0, 10)}</span>
              </div>
            ))}
          </MiniPanel>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {users.map(u => (
          <PersonCard key={u.id} u={u} isManager={isManager} editing={editingId === u.id} onEdit={() => setEditingId(u.id)} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); load(); }} />
        ))}
      </div>
    </div>
  );
}

function PersonCard({ u, isManager, editing, onEdit, onCancel, onSaved }) {
  const [form, setForm] = useState(u);
  useEffect(() => { setForm(u); }, [u]);

  const save = async () => {
    try {
      await api.patch(`/hr/profile/${u.id}`, {
        birthday: form.birthday || null,
        joining_date: form.joining_date || null,
        blood_group: form.blood_group || "",
        emergency_contact_name: form.emergency_contact_name || "",
        emergency_contact_phone: form.emergency_contact_phone || "",
      });
      toast.success("Saved");
      onSaved?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const toggleNotice = async () => {
    try {
      await api.patch(`/hr/profile/${u.id}`, { in_notice_period: !u.in_notice_period, notice_start: !u.in_notice_period ? new Date().toISOString() : null });
      toast.success(!u.in_notice_period ? "Notice period ON" : "Notice period OFF");
      onSaved?.();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const genHandover = async () => {
    try {
      const { data } = await api.post(`/hr/handover/${u.id}/generate`);
      toast.success(`Handover generated (${data.active_jobs.length} active jobs)`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="card-surface p-4" data-testid={`person-card-${u.id}`}>
      <div className="flex items-start gap-3">
        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=4361EE&color=fff&size=64`} className="w-12 h-12 rounded-full" alt="" />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-slate-900">{u.name}</div>
          <div className="text-[11px] mono text-slate-500">{u.role_label} · {u.email}</div>
          {u.in_notice_period && <span className="chip bg-amber-100 text-amber-800 mt-1 inline-block">On notice</span>}
        </div>
        {isManager && !editing && (
          <div className="flex gap-1">
            <button onClick={onEdit} data-testid={`edit-person-${u.id}`} className="px-2 h-7 rounded-md hover:bg-slate-100 text-[11px] mono text-slate-600">Edit</button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
          <Fact label="🎂 Birthday" value={u.birthday || "—"} />
          <Fact label="🎉 Joined" value={u.joining_date || "—"} />
          <Fact label="🩸 Blood group" value={u.blood_group || "—"} />
          <Fact label="📞 Emergency" value={u.emergency_contact_name ? `${u.emergency_contact_name} · ${u.emergency_contact_phone || ""}` : "—"} />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput label="Birthday" type="date" value={form.birthday || ""} onChange={v => setForm({ ...form, birthday: v })} testid={`f-birthday-${u.id}`} />
            <LabeledInput label="Joining" type="date" value={form.joining_date || ""} onChange={v => setForm({ ...form, joining_date: v })} testid={`f-joining-${u.id}`} />
            <LabeledInput label="Blood" value={form.blood_group || ""} onChange={v => setForm({ ...form, blood_group: v })} testid={`f-blood-${u.id}`} />
            <LabeledInput label="Emergency name" value={form.emergency_contact_name || ""} onChange={v => setForm({ ...form, emergency_contact_name: v })} testid={`f-emerg-name-${u.id}`} />
            <LabeledInput label="Emergency phone" value={form.emergency_contact_phone || ""} onChange={v => setForm({ ...form, emergency_contact_phone: v })} testid={`f-emerg-phone-${u.id}`} />
          </div>
          <div className="flex items-center justify-between pt-2">
            {isManager && !u.is_admin && (
              <div className="flex gap-2">
                <button onClick={toggleNotice} data-testid={`toggle-notice-${u.id}`} className={`px-2 h-8 rounded-md text-[11px] font-semibold ${u.in_notice_period ? "bg-amber-100 text-amber-800" : "border border-[#E5E8F0] text-slate-600"}`}>{u.in_notice_period ? "Notice ON" : "Set notice period"}</button>
                {u.in_notice_period && <button onClick={genHandover} data-testid={`gen-handover-${u.id}`} className="px-2 h-8 rounded-md text-[11px] font-semibold bg-slate-900 text-white">Generate handover</button>}
              </div>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={onCancel} className="px-2 h-8 rounded-md border border-[#E5E8F0] text-[11px]">Cancel</button>
              <button onClick={save} data-testid={`save-person-${u.id}`} className="px-2 h-8 rounded-md bg-[#4361EE] text-white text-[11px] font-semibold flex items-center gap-1"><Save size={11} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- CULTURE (activities + outings) ----------
function CultureTab({ isManager }) {
  const [activities, setActivities] = useState([]);
  const [outings, setOutings] = useState([]);
  const [users, setUsers] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [newAct, setNewAct] = useState({ title: "", kind: "activity", date: "", description: "", attendees: [] });
  const [newOut, setNewOut] = useState({ title: "", kind: "monthly", date: "", venue: "", budget: 0, attendees: [], notes: "", checklist: [] });

  const load = async () => {
    const [a, o, u] = await Promise.all([api.get("/hr/activities"), api.get("/hr/outings"), api.get("/users")]);
    setActivities(a.data); setOutings(o.data); setUsers(u.data);
  };
  useEffect(() => { load(); }, []);

  const suggest = async () => {
    setSuggesting(true);
    try {
      const { data } = await api.post("/hr/activities/ai-suggest");
      setNewAct({ title: data.title, kind: data.kind || "activity", date: "", description: data.description, attendees: users.filter(u => !u.is_admin).map(u => u.id) });
      toast.success("AI idea loaded — pick a date and add");
    } catch (e) { toast.error("Failed to suggest"); }
    finally { setSuggesting(false); }
  };

  const addActivity = async () => {
    if (!newAct.title || !newAct.date) return toast.error("Title and date required");
    await api.post("/hr/activities", newAct);
    setNewAct({ title: "", kind: "activity", date: "", description: "", attendees: [] });
    load();
    toast.success("Activity added");
  };

  const addOuting = async () => {
    if (!newOut.title || !newOut.date) return toast.error("Title and date required");
    await api.post("/hr/outings", newOut);
    setNewOut({ title: "", kind: "monthly", date: "", venue: "", budget: 0, attendees: [], notes: "", checklist: [] });
    load();
    toast.success("Outing added");
  };

  const nameOf = (id) => users.find(u => u.id === id)?.name || id;

  return (
    <div className="space-y-6" data-testid="tab-culture">
      {/* ACTIVITIES */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Team activities & 1-hour trainings</h2>
          {isManager && (
            <button onClick={suggest} disabled={suggesting} data-testid="ai-suggest-activity" className="h-9 px-3 rounded-md bg-purple-100 text-purple-800 text-[12px] font-semibold flex items-center gap-1"><Sparkles size={12} />{suggesting ? "Thinking…" : "AI suggest idea"}</button>
          )}
        </div>
        {isManager && (
          <div className="card-surface p-3 mb-3 grid grid-cols-1 md:grid-cols-[2fr_140px_130px_auto] gap-2" data-testid="add-activity-row">
            <input placeholder="Title" value={newAct.title} onChange={e => setNewAct({ ...newAct, title: e.target.value })} data-testid="act-title" className="h-9 px-3 rounded-md border border-[#E5E8F0] text-sm" />
            <select value={newAct.kind} onChange={e => setNewAct({ ...newAct, kind: e.target.value })} className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white"><option value="activity">Activity</option><option value="training">Training</option></select>
            <input type="date" value={newAct.date} onChange={e => setNewAct({ ...newAct, date: e.target.value })} data-testid="act-date" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm" />
            <button onClick={addActivity} data-testid="act-add" className="h-9 px-3 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1"><Plus size={12} /> Add</button>
            {newAct.description && <div className="md:col-span-4 text-[11px] text-slate-500">{newAct.description}</div>}
          </div>
        )}
        <div className="space-y-2">
          {activities.length === 0 && <div className="text-sm text-slate-400 text-center py-4">No activities yet</div>}
          {activities.map(a => (
            <div key={a.id} className="card-surface p-3 flex items-center gap-3" data-testid={`activity-${a.id}`}>
              <div className="w-1 self-stretch rounded" style={{ background: a.kind === "training" ? "#8B5CF6" : "#10B981" }} />
              <div className="flex-1">
                <div className="text-[13px] font-medium text-slate-900">{a.title}</div>
                <div className="text-[11px] mono text-slate-500">{a.date} · {a.kind} · {a.attendees?.length || 0} attendees</div>
                {a.description && <div className="text-[12px] text-slate-600 mt-1">{a.description}</div>}
              </div>
              {isManager && <button onClick={async () => { await api.delete(`/hr/activities/${a.id}`); load(); }} className="text-slate-400 hover:text-red-600" data-testid={`del-act-${a.id}`}><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      </section>

      {/* OUTINGS */}
      <section>
        <h2 className="text-[15px] font-semibold text-slate-900 mb-3">Monthly & quarterly outings</h2>
        {isManager && (
          <div className="card-surface p-3 mb-3 grid grid-cols-1 md:grid-cols-[2fr_120px_130px_100px_100px_auto] gap-2" data-testid="add-outing-row">
            <input placeholder="Title" value={newOut.title} onChange={e => setNewOut({ ...newOut, title: e.target.value })} data-testid="out-title" className="h-9 px-3 rounded-md border border-[#E5E8F0] text-sm" />
            <select value={newOut.kind} onChange={e => setNewOut({ ...newOut, kind: e.target.value })} className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select>
            <input type="date" value={newOut.date} onChange={e => setNewOut({ ...newOut, date: e.target.value })} data-testid="out-date" className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm" />
            <input placeholder="Venue" value={newOut.venue} onChange={e => setNewOut({ ...newOut, venue: e.target.value })} className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm" />
            <input type="number" placeholder="₹" value={newOut.budget} onChange={e => setNewOut({ ...newOut, budget: Number(e.target.value) })} className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm" />
            <button onClick={addOuting} data-testid="out-add" className="h-9 px-3 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
        )}
        <div className="space-y-2">
          {outings.map(o => <OutingCard key={o.id} o={o} isManager={isManager} nameOf={nameOf} onChange={load} />)}
        </div>
      </section>
    </div>
  );
}

function OutingCard({ o, isManager, nameOf, onChange }) {
  const toggleItem = async (i) => {
    if (!isManager) return;
    const cl = o.checklist.map((c, idx) => idx === i ? { ...c, done: !c.done } : c);
    await api.patch(`/hr/outings/${o.id}`, { checklist: cl });
    onChange?.();
  };
  const del = async () => { if (!window.confirm("Delete?")) return; await api.delete(`/hr/outings/${o.id}`); onChange?.(); };
  return (
    <div className="card-surface p-4" data-testid={`outing-${o.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-semibold text-slate-900">{o.title}</div>
          <div className="text-[11px] mono text-slate-500">{o.kind} · {o.date} · {o.venue || "TBD"} · ₹{o.budget?.toLocaleString?.() || 0}</div>
          {o.notes && <div className="text-[12px] text-slate-600 mt-1">{o.notes}</div>}
        </div>
        {isManager && <button onClick={del} className="text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>}
      </div>
      {o.checklist?.length > 0 && (
        <div className="mt-3 space-y-1">
          {o.checklist.map((c, i) => (
            <label key={i} className={`flex items-center gap-2 text-[12px] ${isManager ? "cursor-pointer" : ""}`} data-testid={`out-check-${o.id}-${i}`}>
              <input type="checkbox" checked={!!c.done} onChange={() => toggleItem(i)} disabled={!isManager} />
              <span className={c.done ? "text-slate-400 line-through" : "text-slate-700"}>{c.item}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- ANNOUNCEMENTS ----------
function AnnouncementsTab({ isManager, user }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", expires_at: "" });

  const load = async () => setList((await api.get("/hr/announcements")).data);
  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!form.title || !form.body) return toast.error("Title and body required");
    await api.post("/hr/announcements", form);
    setForm({ title: "", body: "", expires_at: "" });
    toast.success("Posted");
    load();
  };

  const del = async (id) => { await api.delete(`/hr/announcements/${id}`); load(); };

  return (
    <div className="space-y-4" data-testid="tab-announce">
      {isManager && (
        <div className="card-surface p-4 space-y-2" data-testid="new-announcement">
          <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" data-testid="ann-title" />
          <textarea placeholder="Body — supports plain text with line breaks" rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="w-full p-3 rounded-md border border-[#E5E8F0] text-sm" data-testid="ann-body" />
          <div className="flex items-center justify-between">
            <input type="date" value={form.expires_at?.slice(0, 10) || ""} onChange={e => setForm({ ...form, expires_at: e.target.value })} className="h-9 px-2 rounded-md border border-[#E5E8F0] text-sm" />
            <button onClick={post} data-testid="post-announcement" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Post to team</button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {list.length === 0 && <div className="text-sm text-slate-400 text-center py-6">No announcements yet</div>}
        {list.map(a => (
          <div key={a.id} className="card-surface p-4" data-testid={`ann-${a.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-slate-900">{a.title}</div>
                <div className="text-[11px] mono text-slate-500 mt-0.5">{new Date(a.posted_at).toLocaleString("en-IN")}</div>
              </div>
              {isManager && <button onClick={() => del(a.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>}
            </div>
            <div className="text-[13px] text-slate-700 mt-2 whitespace-pre-wrap leading-relaxed">{a.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 1:1 & WELLNESS (manager) ----------
function FeedbackTab() {
  const [users, setUsers] = useState([]);
  const [selUser, setSelUser] = useState(null);
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ date: "", agenda: "", notes: "", action_items: [] });
  const [wellness, setWellness] = useState({ trend: [] });

  useEffect(() => {
    api.get("/users").then(({ data }) => setUsers(data.filter(u => !u.is_admin)));
    api.get("/hr/wellness/team").then(({ data }) => setWellness(data));
  }, []);

  const loadNotes = async (userId) => {
    setSelUser(userId);
    const { data } = await api.get(`/hr/one-on-ones/${userId}`);
    setList(data);
    setForm({ date: "", agenda: "", notes: "", action_items: [] });
  };

  const save = async () => {
    if (!selUser || !form.date) return toast.error("Pick a person and date");
    await api.post("/hr/one-on-ones", { member_id: selUser, ...form });
    toast.success("Saved");
    loadNotes(selUser);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="tab-feedback">
      <div className="lg:col-span-1 space-y-2">
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Team members</div>
        {users.map(u => (
          <button key={u.id} onClick={() => loadNotes(u.id)} data-testid={`select-member-${u.id}`} className={`w-full flex items-center gap-2 p-2.5 rounded-md border ${selUser === u.id ? "border-[#4361EE] bg-blue-50" : "border-[#E5E8F0]"}`}>
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=4361EE&color=fff&size=40`} className="w-8 h-8 rounded-full" alt="" />
            <div className="text-left flex-1">
              <div className="text-[13px] font-medium text-slate-900">{u.name}</div>
              <div className="text-[10px] mono text-slate-500">{u.role_label}</div>
            </div>
          </button>
        ))}
        {wellness?.trend?.length > 0 && (
          <div className="card-surface p-3 mt-4" data-testid="wellness-trend">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Wellness pulse · avg</div>
            <div className="flex items-end gap-1 h-16">
              {wellness.trend.slice(-8).map((w, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-emerald-400 to-emerald-200 rounded-t" style={{ height: `${(w.avg / 5) * 100}%` }} title={`${w.week}: ${w.avg}`} />
              ))}
            </div>
            <div className="text-[10px] mono text-slate-500 mt-1">last 8 weeks · {wellness.trend[wellness.trend.length - 1]?.avg?.toFixed(1) || "—"} / 5.0</div>
          </div>
        )}
      </div>
      <div className="lg:col-span-2 space-y-3">
        {selUser ? (
          <>
            <div className="card-surface p-4 space-y-2" data-testid="new-oto">
              <div className="text-[11px] uppercase mono tracking-widest text-slate-500">New 1:1 note (private to you)</div>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" />
              <input placeholder="Agenda / topic" value={form.agenda} onChange={e => setForm({ ...form, agenda: e.target.value })} className="w-full h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" />
              <textarea placeholder="Notes, blockers, sentiment…" rows={5} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full p-3 rounded-md border border-[#E5E8F0] text-sm" data-testid="oto-notes" />
              <div className="flex justify-end"><button onClick={save} data-testid="save-oto" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Save note</button></div>
            </div>
            {list.map(o => (
              <div key={o.id} className="card-surface p-4" data-testid={`oto-${o.id}`}>
                <div className="text-[11px] mono text-slate-500">{o.date}</div>
                {o.agenda && <div className="text-[13px] font-medium text-slate-900 mt-0.5">{o.agenda}</div>}
                {o.notes && <div className="text-[12px] text-slate-600 mt-1 whitespace-pre-wrap">{o.notes}</div>}
              </div>
            ))}
          </>
        ) : (
          <div className="card-surface p-10 text-center text-slate-400">Pick a team member to see 1:1 history</div>
        )}
      </div>
    </div>
  );
}

// ---------- POLICIES ----------
function PoliciesTab({ isManager }) {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null); // id or 'new'
  const [form, setForm] = useState({ section: "", title: "", body: "" });

  const load = async () => setList((await api.get("/hr/policies")).data);
  useEffect(() => { load(); }, []);

  const start = (p) => { setEditing(p?.id || "new"); setForm(p || { section: "", title: "", body: "" }); };
  const save = async () => {
    try {
      if (editing === "new") await api.post("/hr/policies", form);
      else await api.patch(`/hr/policies/${editing}`, form);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };
  const del = async (id) => { if (window.confirm("Delete this policy?")) { await api.delete(`/hr/policies/${id}`); load(); } };

  return (
    <div className="space-y-4" data-testid="tab-policies">
      {isManager && !editing && (
        <button onClick={() => start(null)} data-testid="add-policy" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1"><Plus size={13} /> New policy</button>
      )}
      {editing && (
        <div className="card-surface p-4 space-y-2" data-testid="policy-editor">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Section (e.g. Leave, Work, Culture)" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className="h-9 px-3 rounded-md border border-[#E5E8F0] text-sm" />
            <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="h-9 px-3 rounded-md border border-[#E5E8F0] text-sm" />
          </div>
          <textarea placeholder="Body (markdown-lite: **bold**, bullet points, etc)" rows={8} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="w-full p-3 rounded-md border border-[#E5E8F0] text-sm font-mono" data-testid="policy-body" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
            <button onClick={save} data-testid="save-policy" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Save</button>
          </div>
        </div>
      )}
      {Object.entries(list.reduce((acc, p) => { (acc[p.section] = acc[p.section] || []).push(p); return acc; }, {})).map(([sec, items]) => (
        <div key={sec}>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">{sec}</div>
          <div className="space-y-2">
            {items.map(p => (
              <div key={p.id} className="card-surface p-4" data-testid={`policy-${p.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[14px] font-semibold text-slate-900">{p.title}</div>
                  {isManager && (
                    <div className="flex gap-1">
                      <button onClick={() => start(p)} className="text-[11px] mono text-slate-600 hover:text-[#4361EE]">Edit</button>
                      <button onClick={() => del(p.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                <div className="text-[13px] text-slate-700 mt-2 whitespace-pre-wrap leading-relaxed">{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- REIMBURSEMENTS ----------
function ReimbursementsTab({ isManager }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ amount: 0, category: "travel", date: "", description: "" });
  const [users, setUsers] = useState([]);

  const load = async () => { setList((await api.get("/hr/reimbursements")).data); setUsers((await api.get("/users")).data); };
  useEffect(() => { load(); }, []);

  const nameOf = (id) => users.find(u => u.id === id)?.name || id;

  const submit = async () => {
    if (!form.amount || !form.date || !form.description) return toast.error("Fill amount, date, description");
    await api.post("/hr/reimbursements", form);
    setForm({ amount: 0, category: "travel", date: "", description: "" });
    toast.success("Submitted");
    load();
  };
  const decide = async (id, decision) => {
    await api.post(`/hr/reimbursements/${id}/decide`, { decision, note: "" });
    load();
  };

  return (
    <div className="space-y-4" data-testid="tab-reimb">
      <div className="card-surface p-4 grid grid-cols-2 md:grid-cols-5 gap-2" data-testid="new-reimb">
        <input type="number" placeholder="Amount ₹" value={form.amount || ""} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" />
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="h-10 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
          <option value="travel">Travel</option><option value="food">Food</option><option value="office">Office</option><option value="client">Client</option><option value="other">Other</option>
        </select>
        <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-10 px-2 rounded-md border border-[#E5E8F0] text-sm" />
        <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-10 px-3 rounded-md border border-[#E5E8F0] text-sm md:col-span-1" />
        <button onClick={submit} data-testid="submit-reimb" className="h-10 px-3 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Submit claim</button>
      </div>
      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm" data-testid="reimb-table">
          <thead className="bg-slate-50 text-[10px] uppercase mono tracking-widest text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Person</th>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-left px-4 py-2">Amount</th>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-left px-4 py-2">Status</th>
              {isManager && <th className="text-right px-4 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate-400">No claims yet</td></tr>}
            {list.map(r => (
              <tr key={r.id} className="border-t border-[#E5E8F0]" data-testid={`reimb-${r.id}`}>
                <td className="px-4 py-2">{nameOf(r.user_id)}</td>
                <td className="px-4 py-2 mono text-[12px]">{r.date}</td>
                <td className="px-4 py-2 capitalize">{r.category}</td>
                <td className="px-4 py-2 mono">₹{r.amount?.toLocaleString?.() || 0}</td>
                <td className="px-4 py-2 text-slate-600 text-[12px]">{r.description}</td>
                <td className="px-4 py-2"><span className={`chip ${r.status === "pending" ? "bg-amber-100 text-amber-800" : r.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{r.status}</span></td>
                {isManager && (
                  <td className="px-4 py-2 text-right">
                    {r.status === "pending" ? (
                      <div className="inline-flex gap-1">
                        <button onClick={() => decide(r.id, "approved")} className="px-2 h-7 rounded-md bg-emerald-500 text-white text-[11px]" data-testid={`reimb-approve-${r.id}`}>Approve</button>
                        <button onClick={() => decide(r.id, "rejected")} className="px-2 h-7 rounded-md bg-red-500 text-white text-[11px]" data-testid={`reimb-reject-${r.id}`}>Reject</button>
                      </div>
                    ) : <span className="text-[11px] mono text-slate-400">{r.decision_note || "—"}</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- SALARY VAULT (Yusuf only, PIN protected) ----------
function VaultTab() {
  const [status, setStatus] = useState({ is_set: false });
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(null);
  const [setupMode, setSetupMode] = useState(false);
  const [setupForm, setSetupForm] = useState({ current: "", newPin: "", confirm: "" });
  const [salaryForm, setSalaryForm] = useState({ user_id: "", amount: 0, currency: "INR", effective_from: "", note: "" });

  useEffect(() => { api.get("/hr/vault/status").then(({ data }) => setStatus(data)); }, []);

  const setupPin = async () => {
    if (setupForm.newPin !== setupForm.confirm) return toast.error("PINs don't match");
    if (setupForm.newPin.length < 4) return toast.error("PIN must be 4+ chars");
    try {
      await api.post("/hr/vault/set-pin", { current_pin: setupForm.current || null, new_pin: setupForm.newPin });
      toast.success("Vault PIN saved");
      setStatus({ is_set: true }); setSetupMode(false); setSetupForm({ current: "", newPin: "", confirm: "" });
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };
  const unlock = async () => {
    try {
      const { data } = await api.post("/hr/vault/list", { pin });
      setUnlocked(data);
      toast.success("Vault unlocked");
    } catch (e) { toast.error("Wrong PIN"); }
  };
  const setSalary = async () => {
    if (!salaryForm.user_id || !salaryForm.amount) return toast.error("Pick person and amount");
    try {
      await api.post("/hr/vault/salary", { ...salaryForm, pin });
      toast.success("Saved");
      unlock();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  if (!status.is_set && !setupMode) {
    return (
      <div className="card-surface p-6 text-center" data-testid="vault-setup-prompt">
        <Lock size={28} className="mx-auto text-slate-400 mb-2" />
        <div className="text-lg font-semibold text-slate-900">Set a vault PIN first</div>
        <div className="text-sm text-slate-500 mt-1">Salary data is locked behind a private PIN only you know.</div>
        <button onClick={() => setSetupMode(true)} data-testid="vault-setup-start" className="mt-4 px-3 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Set PIN now</button>
      </div>
    );
  }

  if (setupMode) {
    return (
      <div className="card-surface p-6 space-y-3 max-w-md" data-testid="vault-setup-form">
        <div className="text-lg font-semibold text-slate-900">{status.is_set ? "Change vault PIN" : "Set vault PIN"}</div>
        {status.is_set && (
          <input type="password" placeholder="Current PIN" value={setupForm.current} onChange={e => setSetupForm({ ...setupForm, current: e.target.value })} className="w-full h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" />
        )}
        <input type="password" placeholder="New PIN (min 4 chars)" value={setupForm.newPin} onChange={e => setSetupForm({ ...setupForm, newPin: e.target.value })} className="w-full h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" data-testid="vault-new-pin" />
        <input type="password" placeholder="Confirm new PIN" value={setupForm.confirm} onChange={e => setSetupForm({ ...setupForm, confirm: e.target.value })} className="w-full h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" data-testid="vault-confirm-pin" />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setSetupMode(false)} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
          <button onClick={setupPin} data-testid="vault-save-pin" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Save PIN</button>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="card-surface p-6 space-y-3 max-w-md" data-testid="vault-unlock">
        <Lock size={22} className="text-slate-400" />
        <div className="text-lg font-semibold text-slate-900">Unlock salary vault</div>
        <input type="password" placeholder="Vault PIN" value={pin} onChange={e => setPin(e.target.value)} className="w-full h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" data-testid="vault-pin-input" />
        <div className="flex gap-2 justify-between">
          <button onClick={() => setSetupMode(true)} className="text-[12px] text-slate-500 hover:text-slate-900">Change PIN</button>
          <button onClick={unlock} data-testid="vault-unlock-btn" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Unlock</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="vault-unlocked">
      <div className="flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2"><Check size={13} /> Vault unlocked — this data is private to you.</div>
      <div className="card-surface p-4 space-y-2" data-testid="vault-set-salary">
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Set / update salary</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select value={salaryForm.user_id} onChange={e => setSalaryForm({ ...salaryForm, user_id: e.target.value })} className="h-10 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
            <option value="">Employee</option>
            {unlocked.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input type="number" placeholder="₹ / month" value={salaryForm.amount || ""} onChange={e => setSalaryForm({ ...salaryForm, amount: Number(e.target.value) })} className="h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" />
          <input type="date" value={salaryForm.effective_from} onChange={e => setSalaryForm({ ...salaryForm, effective_from: e.target.value })} className="h-10 px-2 rounded-md border border-[#E5E8F0] text-sm" />
          <input placeholder="Note (e.g. hike, revision)" value={salaryForm.note} onChange={e => setSalaryForm({ ...salaryForm, note: e.target.value })} className="h-10 px-3 rounded-md border border-[#E5E8F0] text-sm" />
          <button onClick={setSalary} data-testid="save-salary" className="h-10 px-3 rounded-md bg-slate-900 text-white text-sm font-semibold">Save</button>
        </div>
      </div>
      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase mono tracking-widest text-slate-500">
            <tr><th className="text-left px-4 py-2">Employee</th><th className="text-left px-4 py-2">Role</th><th className="text-right px-4 py-2">Current salary</th><th className="text-left px-4 py-2">Since</th></tr>
          </thead>
          <tbody>
            {unlocked.users.map(u => (
              <tr key={u.id} className="border-t border-[#E5E8F0]" data-testid={`salary-row-${u.id}`}>
                <td className="px-4 py-2 font-medium text-slate-900">{u.name}</td>
                <td className="px-4 py-2 text-slate-600">{u.role_label}</td>
                <td className="px-4 py-2 text-right mono">{u._latest_salary ? `₹${u._latest_salary.amount?.toLocaleString?.()}` : "—"}</td>
                <td className="px-4 py-2 mono text-slate-500 text-[12px]">{u._latest_salary?.effective_from || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Small shared bits ----------
function MiniPanel({ title, children, testid }) {
  return (
    <div className="card-surface p-4" data-testid={testid}>
      <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">{title}</div>
      {children}
    </div>
  );
}
function Fact({ label, value }) {
  return (
    <div>
      <div className="text-[10px] mono uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-slate-700 mono text-[12px]">{value}</div>
    </div>
  );
}
function LabeledInput({ label, value, onChange, type = "text", testid }) {
  return (
    <label className="block">
      <div className="text-[10px] mono uppercase tracking-widest text-slate-400 mb-0.5">{label}</div>
      <input data-testid={testid} type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full h-9 px-2 rounded-md border border-[#E5E8F0] text-sm" />
    </label>
  );
}
