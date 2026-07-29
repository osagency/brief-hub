import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { X, Plus, Trash2, Pencil, Save } from "lucide-react";

export const FEST_COLOR = {
  festival: "#F59E0B",
  holiday:  "#EF4444",
  brand:    "#8B5CF6",
  other:    "#06B6D4",
};

export const FEST_LABEL = {
  festival: "Festival",
  holiday:  "Holiday",
  brand:    "Brand day",
  other:    "Other",
};

const EMPTY = { name: "", date: "", type: "festival", description: "" };

export default function ManageFestivalsModal({ open, onClose, canManage, onChanged }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/festivals");
      setList(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) { load(); setForm(EMPTY); setEditId(null); } }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    try {
      if (editId) {
        await api.patch(`/festivals/${editId}`, form);
        toast.success("Updated");
      } else {
        await api.post("/festivals", form);
        toast.success("Added");
      }
      setForm(EMPTY); setEditId(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    }
  };

  const edit = (f) => { setEditId(f.id); setForm({ name: f.name, date: f.date, type: f.type, description: f.description || "" }); };
  const cancel = () => { setEditId(null); setForm(EMPTY); };
  const remove = async (f) => {
    if (!window.confirm(`Delete "${f.name}"?`)) return;
    await api.delete(`/festivals/${f.id}`);
    toast.success("Deleted");
    await load();
    onChanged?.();
  };

  // Group by month for display
  const groups = {};
  list.forEach((f) => {
    const key = f.date.slice(0, 7);
    (groups[key] = groups[key] || []).push(f);
  });
  const groupKeys = Object.keys(groups).sort();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-stretch justify-end" onClick={onClose} data-testid="festivals-modal">
      <div className="bg-white w-full max-w-xl h-full flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="h-[54px] px-5 border-b border-[#E5E8F0] flex items-center justify-between">
          <div>
            <div className="text-[11px] mono uppercase tracking-widest text-slate-500">Calendar</div>
            <div className="text-[15px] font-semibold text-slate-900">Manage important dates</div>
          </div>
          <button onClick={onClose} data-testid="festivals-modal-close" className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-500 flex items-center justify-center"><X size={16} /></button>
        </div>

        {canManage && (
          <form onSubmit={submit} className="p-4 border-b border-[#E5E8F0] bg-slate-50/40 space-y-2" data-testid="festival-form">
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <input
                required maxLength={80}
                placeholder="Festival or day name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="fest-name"
                className="h-10 px-3 rounded-md border border-[#E5E8F0] text-sm"
              />
              <input
                required type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                data-testid="fest-date"
                className="h-10 px-3 rounded-md border border-[#E5E8F0] text-sm"
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                data-testid="fest-type"
                className="h-10 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white"
              >
                {Object.entries(FEST_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input
                maxLength={200}
                placeholder="Short description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-testid="fest-desc"
                className="h-10 px-3 rounded-md border border-[#E5E8F0] text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {editId && (
                <button type="button" onClick={cancel} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              )}
              <button type="submit" data-testid="fest-save" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold hover:bg-[#3651d0] flex items-center gap-1">
                {editId ? <><Save size={13} /> Update</> : <><Plus size={13} /> Add</>}
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && <div className="text-sm text-slate-400">Loading…</div>}
          {!loading && list.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-10">No important dates yet — add one above.</div>
          )}
          {groupKeys.map((mk) => {
            const [y, m] = mk.split("-");
            const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
            return (
              <div key={mk}>
                <div className="text-[10px] mono uppercase tracking-widest text-slate-500 mb-2">{label}</div>
                <div className="space-y-1.5">
                  {groups[mk].map((f) => (
                    <div key={f.id} className="flex items-center gap-2 p-2.5 rounded-md border border-[#E5E8F0] bg-white" data-testid={`festival-${f.id}`}>
                      <div className="w-1 self-stretch rounded" style={{ background: FEST_COLOR[f.type] }} />
                      <div className="w-14 mono text-[11px] text-slate-500 tabular-nums">{f.date.slice(8, 10)} {new Date(f.date).toLocaleDateString("en-IN", { month: "short" })}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-slate-900 truncate">{f.name}</div>
                        {f.description && <div className="text-[11px] text-slate-500 truncate">{f.description}</div>}
                      </div>
                      <span className="chip" style={{ background: FEST_COLOR[f.type] + "1A", color: FEST_COLOR[f.type] }}>{FEST_LABEL[f.type]}</span>
                      {canManage && (
                        <>
                          <button onClick={() => edit(f)} data-testid={`fest-edit-${f.id}`} className="w-7 h-7 rounded-md hover:bg-slate-100 text-slate-500 flex items-center justify-center"><Pencil size={12} /></button>
                          <button onClick={() => remove(f)} data-testid={`fest-delete-${f.id}`} className="w-7 h-7 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center"><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
