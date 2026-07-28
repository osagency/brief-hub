import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { AlertTriangle, Plus, Pencil, Trash2, X } from "lucide-react";

const COLORS = ["#4361EE", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4", "#EF4444", "#EC4899", "#0EA5E9", "#84CC16", "#F97316"];
const EMPTY = { id: "", name: "", short: "", email: "", voice: "", color: "#4361EE" };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isManager, setIsManager] = useState(false);
  const [modal, setModal] = useState({ open: false, mode: "new", form: EMPTY });

  const load = async () => {
    const [c, j, l] = await Promise.all([api.get("/clients"), api.get("/jobs"), api.get("/timelogs")]);
    setClients(c.data); setJobs(j.data); setLogs(l.data);
    setIsManager(JSON.parse(localStorage.getItem("os_user") || "null")?.is_admin);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => setModal({ open: true, mode: "new", form: { ...EMPTY, color: COLORS[Math.floor(Math.random() * COLORS.length)] } });
  const openEdit = (c) => setModal({ open: true, mode: "edit", form: { ...c } });

  const submit = async (e) => {
    e.preventDefault();
    const { form, mode } = modal;
    const payload = { name: form.name, short: form.short, email: form.email, voice: form.voice, color: form.color };
    try {
      if (mode === "new") {
        await api.post("/clients", { ...payload, id: form.id || undefined });
        toast.success(`Client "${form.name}" added.`);
      } else {
        await api.patch(`/clients/${form.id}`, payload);
        toast.success("Client updated.");
      }
      setModal({ open: false, mode: "new", form: EMPTY });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save");
    }
  };

  const del = async (c) => {
    if (!window.confirm(`Delete client "${c.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/clients/${c.id}`);
      toast.success(`Removed "${c.name}"`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Cannot delete");
    }
  };

  const now = new Date();
  const cur = { m: now.getMonth(), y: now.getFullYear() };

  return (
    <div className="space-y-5" data-testid="clients-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Clients</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Client Directory</h1>
        </div>
        {isManager && (
          <button onClick={openNew} data-testid="new-client-btn" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1 hover:bg-[#3651d0]">
            <Plus size={14} /> New client
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {clients.map(c => {
          const cJobs = jobs.filter(j => j.client === c.id);
          const active = cJobs.filter(j => ["active","todo","review","overdue"].includes(j.status)).length;
          const done = cJobs.filter(j => j.status === "done").length;
          const anyOverdue = cJobs.some(j => j.status === "overdue");
          const monthHours = logs
            .filter(l => cJobs.some(j => j.id === l.jobId))
            .filter(l => { const d = new Date(l.date); return d.getMonth() === cur.m && d.getFullYear() === cur.y; })
            .reduce((s,l)=>s+l.hours,0);
          return (
            <div key={c.id} className="card-surface p-5 relative group" data-testid={`client-${c.id}`}>
              <div className="absolute top-3 right-3 flex items-center gap-1">
                {anyOverdue && <span className="chip status-overdue"><AlertTriangle size={10} /> Overdue</span>}
                {isManager && (
                  <>
                    <button onClick={() => openEdit(c)} data-testid={`edit-client-${c.id}`} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 opacity-0 group-hover:opacity-100 transition"><Pencil size={13} /></button>
                    <button onClick={() => del(c)} data-testid={`delete-client-${c.id}`} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-sm mono" style={{ background: c.color }}>{c.short}</div>
                <div>
                  <div className="text-[14px] font-semibold text-slate-900">{c.name}</div>
                  <div className="text-[11px] mono text-slate-500">{c.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <div>
                  <div className="text-[10px] uppercase mono tracking-widest text-slate-500">Active</div>
                  <div className="mono text-lg font-semibold" style={{ color: c.color }}>{active}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase mono tracking-widest text-slate-500">Done</div>
                  <div className="mono text-lg font-semibold text-slate-900">{done}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase mono tracking-widest text-slate-500">Hours (mo)</div>
                  <div className="mono text-lg text-slate-900">{monthHours}</div>
                </div>
              </div>

              {c.voice && <div className="text-[11px] text-slate-500 mt-3 italic">"{c.voice}"</div>}
            </div>
          );
        })}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModal({ ...modal, open: false })}>
          <form onSubmit={submit} className="bg-white rounded-[12px] w-full max-w-md p-6 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="client-modal">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] font-semibold text-slate-900">{modal.mode === "new" ? "New client" : "Edit client"}</div>
              <button type="button" onClick={() => setModal({ ...modal, open: false })} className="p-1.5 rounded-md hover:bg-slate-100"><X size={14} /></button>
            </div>
            <input required placeholder="Client name" value={modal.form.name} onChange={e => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="client-name" />
            {modal.mode === "new" && (
              <input placeholder="Slug (auto-generated if empty)" value={modal.form.id} onChange={e => setModal({ ...modal, form: { ...modal.form, id: e.target.value.toLowerCase().replace(/\s+/g,"-") } })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm mono" />
            )}
            <div className="flex gap-2">
              <input required maxLength={3} placeholder="Short (2-3 chars)" value={modal.form.short} onChange={e => setModal({ ...modal, form: { ...modal.form, short: e.target.value.toUpperCase() } })} className="w-24 h-10 px-3 border border-[#E5E8F0] rounded-md text-sm mono uppercase" data-testid="client-short" />
              <input required type="email" placeholder="Contact email" value={modal.form.email} onChange={e => setModal({ ...modal, form: { ...modal.form, email: e.target.value } })} className="flex-1 h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="client-email" />
            </div>
            <textarea rows={2} placeholder="Voice / tone note" value={modal.form.voice} onChange={e => setModal({ ...modal, form: { ...modal.form, voice: e.target.value } })} className="w-full p-2 border border-[#E5E8F0] rounded-md text-sm" />
            <div>
              <div className="text-[10px] uppercase mono tracking-widest text-slate-500 mb-1">Brand colour</div>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(col => (
                  <button key={col} type="button" onClick={() => setModal({ ...modal, form: { ...modal.form, color: col } })} className={`w-7 h-7 rounded-full transition ${modal.form.color === col ? "ring-2 ring-offset-2 ring-slate-900" : ""}`} style={{ background: col }} />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal({ ...modal, open: false })} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              <button type="submit" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold" data-testid="client-save">{modal.mode === "new" ? "Create" : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
