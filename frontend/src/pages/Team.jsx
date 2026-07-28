import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { ROLE_LABEL, ROLE_COLOR, ROLE_EMOJI, avatarFor } from "../lib/constants";
import { Plus, Pencil, Trash2, Key, X, Shield } from "lucide-react";

const ROLES = [
  { key: "writer", label: "Writer" },
  { key: "designer", label: "Designer" },
  { key: "mktg", label: "Digital Marketing" },
  { key: "webdev", label: "Web Developer" },
  { key: "clientsvc", label: "Client Servicing" },
  { key: "manager", label: "Manager" },
];

const EMPTY = { id: "", name: "", email: "", password: "", role_key: "writer", role_label: "Writer", is_admin: false };

export default function Team() {
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [me, setMe] = useState(null);
  const [modal, setModal] = useState({ open: false, mode: "new", form: EMPTY });
  const [pwModal, setPwModal] = useState({ open: false, user: null, pw: "" });

  const load = async () => {
    const [u, j] = await Promise.all([api.get("/users"), api.get("/jobs")]);
    setUsers(u.data); setJobs(j.data);
    setMe(JSON.parse(localStorage.getItem("os_user") || "null"));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => setModal({ open: true, mode: "new", form: { ...EMPTY } });
  const openEdit = (u) => setModal({ open: true, mode: "edit", form: { ...u, password: "" } });

  const onRoleChange = (role_key) => {
    const r = ROLES.find(x => x.key === role_key);
    setModal(m => ({ ...m, form: { ...m.form, role_key, role_label: r?.label || role_key, is_admin: role_key === "manager" || m.form.is_admin } }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const { form, mode } = modal;
    try {
      if (mode === "new") {
        await api.post("/users", { name: form.name, email: form.email, password: form.password, role_key: form.role_key, role_label: form.role_label, is_admin: form.is_admin });
        toast.success(`${form.name} added.`);
      } else {
        await api.patch(`/users/${form.id}`, { name: form.name, email: form.email, role_key: form.role_key, role_label: form.role_label, is_admin: form.is_admin });
        toast.success("Team member updated.");
      }
      setModal({ open: false, mode: "new", form: EMPTY });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    }
  };

  const del = async (u) => {
    if (!window.confirm(`Remove ${u.name}? Any active jobs must be reassigned first.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success(`Removed ${u.name}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Cannot delete");
    }
  };

  const doReset = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/users/${pwModal.user.id}/reset-password`, { new_password: pwModal.pw });
      toast.success(`Password reset for ${pwModal.user.name}`);
      setPwModal({ open: false, user: null, pw: "" });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Reset failed");
    }
  };

  return (
    <div className="space-y-5" data-testid="team-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Team</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Manage Team</h1>
        </div>
        <button onClick={openNew} data-testid="new-member-btn" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1 hover:bg-[#3651d0]">
          <Plus size={14} /> Add member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {users.map(u => {
          const active = jobs.filter(j => (j.assignees || []).includes(u.id) && ["active","todo","review","overdue"].includes(j.status)).length;
          const isSelf = me?.id === u.id;
          return (
            <div key={u.id} className="card-surface p-5 relative group" data-testid={`team-${u.id}`}>
              <div className="absolute top-3 right-3 flex items-center gap-1">
                <button onClick={() => setPwModal({ open: true, user: u, pw: "" })} data-testid={`reset-pw-${u.id}`} title="Reset password" className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 opacity-0 group-hover:opacity-100 transition"><Key size={13} /></button>
                <button onClick={() => openEdit(u)} data-testid={`edit-member-${u.id}`} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 opacity-0 group-hover:opacity-100 transition"><Pencil size={13} /></button>
                {!isSelf && <button onClick={() => del(u)} data-testid={`delete-member-${u.id}`} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"><Trash2 size={13} /></button>}
              </div>
              <div className="flex items-center gap-3">
                <img src={avatarFor(u)} alt={u.name} className="w-12 h-12 rounded-full" />
                <div>
                  <div className="text-[14px] font-semibold text-slate-900 flex items-center gap-1">
                    {u.name}
                    {u.is_admin && <Shield size={12} className="text-[#4361EE]" title="Admin" />}
                  </div>
                  <div className="text-[11px] mono text-slate-500">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <span className="chip" style={{ background: (ROLE_COLOR[u.role_key] || "#4361EE") + "1A", color: ROLE_COLOR[u.role_key] || "#4361EE" }}>{ROLE_EMOJI[u.role_key]} {u.role_label}</span>
                <span className="text-[11px] mono text-slate-500 ml-auto">{active} active</span>
              </div>
            </div>
          );
        })}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModal({ ...modal, open: false })}>
          <form onSubmit={submit} className="bg-white rounded-[12px] w-full max-w-md p-6 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="member-modal">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] font-semibold text-slate-900">{modal.mode === "new" ? "Add team member" : `Edit ${modal.form.name}`}</div>
              <button type="button" onClick={() => setModal({ ...modal, open: false })} className="p-1.5 rounded-md hover:bg-slate-100"><X size={14} /></button>
            </div>
            <input required placeholder="Full name" value={modal.form.name} onChange={e => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="member-name" />
            <input required type="email" placeholder="Email" value={modal.form.email} onChange={e => setModal({ ...modal, form: { ...modal.form, email: e.target.value } })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="member-email" />
            {modal.mode === "new" && (
              <input required type="text" placeholder="Initial password (min 6)" value={modal.form.password} onChange={e => setModal({ ...modal, form: { ...modal.form, password: e.target.value } })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm mono" data-testid="member-password" />
            )}
            <select value={modal.form.role_key} onChange={e => onRoleChange(e.target.value)} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="member-role">
              {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={modal.form.is_admin} onChange={e => setModal({ ...modal, form: { ...modal.form, is_admin: e.target.checked } })} data-testid="member-admin" />
              Make admin (full access to invoices-free ops, everything)
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal({ ...modal, open: false })} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              <button type="submit" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold" data-testid="member-save">{modal.mode === "new" ? "Create" : "Save"}</button>
            </div>
          </form>
        </div>
      )}

      {pwModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPwModal({ open: false, user: null, pw: "" })}>
          <form onSubmit={doReset} className="bg-white rounded-[12px] w-full max-w-sm p-6 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="pw-modal">
            <div className="text-[13px] font-semibold text-slate-900">Reset password · {pwModal.user?.name}</div>
            <input required minLength={6} type="text" placeholder="New password (min 6)" value={pwModal.pw} onChange={e => setPwModal({ ...pwModal, pw: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm mono" data-testid="pw-input" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPwModal({ open: false, user: null, pw: "" })} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              <button type="submit" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold" data-testid="pw-save">Reset</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
