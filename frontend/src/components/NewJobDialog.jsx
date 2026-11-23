import React, { useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";

const EMPTY = { title: "", client: "", priority: "medium", due: "", desc: "", assignees: [] };
const field = "w-full border border-[#E5E8F0] rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-[#4361EE]";

function AssigneePicker({ users, value, lockedId, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {users.map(u => {
        const on = value.includes(u.id) || u.id === lockedId;
        return (
          <button key={u.id} type="button" disabled={u.id === lockedId} onClick={() => toggle(u.id)}
            data-testid={`new-job-assignee-${u.id}`}
            className={`px-2.5 py-1 rounded-full text-[12px] transition-colors ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"} ${u.id === lockedId ? "opacity-80 cursor-not-allowed" : ""}`}>
            {u.name}
          </button>
        );
      })}
    </div>
  );
}

export function NewJobDialog({ open, onOpenChange, clients, users, onCreated }) {
  const { user } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const lockedId = user?.is_admin ? null : user?.id;
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));

  const submit = async () => {
    if (!f.title.trim() || !f.client) { toast.error("Title and client are required"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/jobs", { ...f, due: f.due || null });
      toast.success(`Job ${data.id} created`);
      setF(EMPTY); onOpenChange(false); onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not create job");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="new-job-dialog">
        <DialogHeader><DialogTitle>New Job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input className={field} placeholder="Job title" value={f.title} onChange={set("title")} data-testid="new-job-title" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select className={field} value={f.client} onChange={set("client")} data-testid="new-job-client">
              <option value="">Client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={field} value={f.priority} onChange={set("priority")} data-testid="new-job-priority">
              <option value="low">Low</option><option value="medium">Medium</option>
              <option value="high">High</option><option value="urgent">Urgent</option>
            </select>
            <input type="date" className={field} value={f.due} onChange={set("due")} data-testid="new-job-due" />
          </div>
          <textarea className={`${field} min-h-[80px]`} placeholder="Description / brief" value={f.desc} onChange={set("desc")} data-testid="new-job-desc" />
          <div>
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-1.5">Assign to</div>
            <AssigneePicker users={users} value={f.assignees} lockedId={lockedId} onChange={(a) => setF(s => ({ ...s, assignees: a }))} />
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-[13px] text-slate-600" data-testid="new-job-cancel">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-md bg-[#4361EE] text-white text-[13px] font-medium disabled:opacity-60" data-testid="new-job-submit">
            {saving ? "Creating…" : "Create job"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
