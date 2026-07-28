import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { ROLE_LABEL, ROLE_COLOR } from "../lib/constants";
import { Plus, ChevronDown, ChevronRight, Sparkles, Loader2 } from "lucide-react";

const ROLES = ["all","writer","designer","mktg","webdev","clientsvc","manager"];

export default function SOPs() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [gening, setGening] = useState(false);
  const [form, setForm] = useState({ title: "", role: "writer", time: "1 hr", stepsText: "" });
  const [isManager, setIsManager] = useState(false);

  const load = async () => {
    setItems((await api.get("/sops")).data);
    setIsManager(JSON.parse(localStorage.getItem("os_user") || "null")?.is_admin);
  };
  useEffect(() => { load(); }, []);

  const visible = filter === "all" ? items : items.filter(s => s.role === filter);

  const submit = async (e) => {
    e.preventDefault();
    const steps = form.stepsText.split("\n").map(s => s.trim()).filter(Boolean);
    await api.post("/sops", { title: form.title, role: form.role, time: form.time, steps });
    toast.success("SOP added.");
    setAddOpen(false); setForm({ title: "", role: "writer", time: "1 hr", stepsText: "" });
    load();
  };

  const generate = async (e) => {
    e.preventDefault();
    setGening(true);
    try {
      await api.post("/sops/generate", { topic: genPrompt });
      toast.success("AI generated SOP");
      setGenOpen(false); setGenPrompt("");
      load();
    } catch { toast.error("Generation failed"); }
    finally { setGening(false); }
  };

  return (
    <div className="space-y-5" data-testid="sop-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Team</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">SOP Library</h1>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <button onClick={() => setGenOpen(true)} data-testid="ai-sop" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1"><Sparkles size={14} /> Generate with AI</button>
            <button onClick={() => setAddOpen(true)} data-testid="add-sop" className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm flex items-center gap-1"><Plus size={14} /> Add SOP</button>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {ROLES.map(r => (
          <button key={r} onClick={() => setFilter(r)} data-testid={`sop-filter-${r}`} className={`px-3 py-1.5 rounded-full text-[12px] font-medium capitalize ${filter === r ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{r === "all" ? "All" : ROLE_LABEL[r]}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map(s => (
          <div key={s.id} className="card-surface p-5" data-testid={`sop-${s.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-slate-900">{s.title}</div>
                <div className="flex gap-2 mt-2 items-center">
                  <span className="chip" style={{ background: (ROLE_COLOR[s.role] || "#4361EE") + "1A", color: ROLE_COLOR[s.role] || "#4361EE" }}>{ROLE_LABEL[s.role] || s.role}</span>
                  <span className="text-[11px] mono text-slate-500">{s.time}</span>
                  <span className="text-[11px] mono text-slate-500">· {s.steps?.length || 0} steps</span>
                </div>
              </div>
              <button onClick={() => setOpenId(openId === s.id ? null : s.id)} data-testid={`sop-toggle-${s.id}`} className="p-2 rounded-md hover:bg-slate-100">
                {openId === s.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
            {openId === s.id && (
              <ol className="list-decimal ml-5 mt-3 space-y-1 text-sm text-slate-700">
                {(s.steps || []).map((st, i) => <li key={i}>{st}</li>)}
              </ol>
            )}
          </div>
        ))}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <form onSubmit={submit} className="bg-white rounded-[12px] w-full max-w-md p-6 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="add-sop-modal">
            <div className="text-[13px] font-semibold">New SOP</div>
            <input required placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
              {ROLES.slice(1).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <input required placeholder="Estimated time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" />
            <textarea rows={6} required placeholder="Steps, one per line" value={form.stepsText} onChange={e => setForm({ ...form, stepsText: e.target.value })} className="w-full p-3 border border-[#E5E8F0] rounded-md text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              <button type="submit" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Add</button>
            </div>
          </form>
        </div>
      )}

      {genOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setGenOpen(false)}>
          <form onSubmit={generate} className="bg-white rounded-[12px] w-full max-w-md p-6 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="gen-sop-modal">
            <div className="text-[13px] font-semibold flex items-center gap-1"><Sparkles size={14} className="text-[#4361EE]" /> AI-generate an SOP</div>
            <input required placeholder="What process? e.g. 'Launch a new client'" value={genPrompt} onChange={e => setGenPrompt(e.target.value)} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="sop-topic" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setGenOpen(false)} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              <button type="submit" disabled={gening} className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1">
                {gening ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
