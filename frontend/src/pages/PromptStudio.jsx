import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Save, Wand2, Copy, Loader2 } from "lucide-react";
import { ROLE_LABEL } from "../lib/constants";

const ROLE_KEYS = ["writer","designer","mktg","webdev","clientsvc","manager"];

export default function PromptStudio() {
  const [tab, setTab] = useState("global");
  const [settings, setSettings] = useState({ global_prompt: "", ai_rules: [] });
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [newRule, setNewRule] = useState("");
  const [voiceDrafts, setVoiceDrafts] = useState({});
  const [tplForm, setTplForm] = useState(null);

  const load = async () => {
    const [s, c, t, u] = await Promise.all([
      api.get("/settings/prompts"),
      api.get("/clients"),
      api.get("/templates"),
      api.get("/users"),
    ]);
    setSettings(s.data); setClients(c.data); setTemplates(t.data); setUsers(u.data);
    const drafts = {};
    c.data.forEach(x => { drafts[x.id] = x.voice || ""; });
    setVoiceDrafts(drafts);
  };
  useEffect(() => { load(); }, []);

  const saveGlobal = async () => {
    setSavingGlobal(true);
    try {
      await api.patch("/settings/prompts", { global_prompt: settings.global_prompt, ai_rules: settings.ai_rules });
      toast.success("Prompt saved. Every AI call now uses the new prompt.");
    } finally { setSavingGlobal(false); }
  };

  const addRule = () => {
    if (!newRule.trim()) return;
    setSettings(s => ({ ...s, ai_rules: [...(s.ai_rules || []), newRule.trim()] }));
    setNewRule("");
  };
  const removeRule = (idx) => setSettings(s => ({ ...s, ai_rules: s.ai_rules.filter((_,i) => i !== idx) }));

  const saveVoice = async (clientId) => {
    await api.patch(`/clients/${clientId}`, { voice: voiceDrafts[clientId] });
    toast.success("Voice guide saved.");
    load();
  };

  const emptyTpl = { name: "", title_template: "", client: null, priority: "medium", recurring: "none", team: [], assignees: [], desc: "", deliverables: [], default_days: 7, deliverablesText: "" };

  const openTpl = (t = null) => setTplForm(t ? { ...t, deliverablesText: (t.deliverables || []).join("\n") } : { ...emptyTpl });
  const submitTpl = async (e) => {
    e.preventDefault();
    const payload = { ...tplForm, deliverables: tplForm.deliverablesText.split("\n").map(x => x.trim()).filter(Boolean) };
    delete payload.deliverablesText;
    delete payload.id;
    delete payload.created_at;
    if (tplForm.id) {
      await api.patch(`/templates/${tplForm.id}`, payload);
      toast.success("Template updated");
    } else {
      await api.post("/templates", payload);
      toast.success("Template created");
    }
    setTplForm(null); load();
  };
  const delTpl = async (id) => {
    if (!window.confirm("Delete template?")) return;
    await api.delete(`/templates/${id}`);
    load();
  };

  return (
    <div className="space-y-5" data-testid="prompts-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Intelligence</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1 flex items-center gap-2"><Sparkles size={20} className="text-[#4361EE]" /> Prompt Studio</h1>
        <div className="text-sm text-slate-500 mt-1">Everything the AI uses to think — global brain, rules, per-client voice, and reusable job templates.</div>
      </div>

      <div className="flex gap-2 border-b border-[#E5E8F0]">
        {[
          { key: "global", label: "Global brain" },
          { key: "rules", label: "AI rules" },
          { key: "voice", label: "Client voice" },
          { key: "templates", label: "Job templates" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} data-testid={`tab-${t.key}`} className={`px-4 py-2 text-[13px] font-medium border-b-2 transition ${tab === t.key ? "border-[#4361EE] text-[#4361EE]" : "border-transparent text-slate-600 hover:text-slate-900"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "global" && (
        <div className="card-surface p-5" data-testid="tab-global-panel">
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Global system prompt</div>
          <div className="text-[11px] mono text-slate-500 mb-3">Every AI feature — brief parser, reply drafter, coaching, reports, chat — starts here.</div>
          <textarea rows={18} value={settings.global_prompt || ""} onChange={e => setSettings(s => ({ ...s, global_prompt: e.target.value }))} className="w-full p-3 border border-[#E5E8F0] rounded-md text-[13px] mono leading-relaxed" data-testid="global-prompt" />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={saveGlobal} disabled={savingGlobal} data-testid="save-global" className="px-4 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
              {savingGlobal ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </button>
          </div>
        </div>
      )}

      {tab === "rules" && (
        <div className="card-surface p-5" data-testid="tab-rules-panel">
          <div className="text-[13px] font-semibold text-slate-900 mb-1">AI rules</div>
          <div className="text-[11px] mono text-slate-500 mb-3">Appended to every AI call as "ADDITIONAL RULES". Great for do's/don'ts.</div>
          <div className="space-y-2">
            {(settings.ai_rules || []).map((r, i) => (
              <div key={i} className="flex items-center gap-2 border border-[#E5E8F0] rounded-md p-2" data-testid={`rule-${i}`}>
                <span className="mono text-[10px] text-slate-400 w-5">{i+1}</span>
                <div className="flex-1 text-sm text-slate-800">{r}</div>
                <button onClick={() => removeRule(i)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input value={newRule} onChange={e => setNewRule(e.target.value)} placeholder="e.g. Never propose deadlines shorter than 2 business days for Priya" className="flex-1 h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="new-rule-input" />
            <button onClick={addRule} className="px-3 h-10 rounded-md bg-slate-900 text-white text-sm font-semibold flex items-center gap-1"><Plus size={14} /> Add</button>
            <button onClick={saveGlobal} disabled={savingGlobal} className="px-3 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1" data-testid="save-rules">{savingGlobal ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save</button>
          </div>
        </div>
      )}

      {tab === "voice" && (
        <div className="space-y-3" data-testid="tab-voice-panel">
          <div className="text-[11px] mono text-slate-500">Each client's voice guide feeds directly into brief parsing and reply drafting. Update these and every future AI output for that client instantly changes.</div>
          {clients.map(c => (
            <div key={c.id} className="card-surface p-5" data-testid={`voice-${c.id}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs mono" style={{ background: c.color }}>{c.short}</div>
                <div>
                  <div className="text-[14px] font-semibold text-slate-900">{c.name}</div>
                  <div className="text-[11px] mono text-slate-500">{c.email}</div>
                </div>
              </div>
              <textarea rows={3} value={voiceDrafts[c.id] || ""} onChange={e => setVoiceDrafts(v => ({ ...v, [c.id]: e.target.value }))} placeholder="e.g. Cold chain logistics, Gaurav Sethi's personal voice, always first person" className="w-full p-3 border border-[#E5E8F0] rounded-md text-sm" data-testid={`voice-input-${c.id}`} />
              <div className="flex justify-end mt-2">
                <button onClick={() => saveVoice(c.id)} data-testid={`save-voice-${c.id}`} className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1"><Save size={13} /> Save</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-3" data-testid="tab-templates-panel">
          <div className="flex items-center justify-between">
            <div className="text-[11px] mono text-slate-500">Reusable job blueprints. Perfect for recurring work (monthly reports, weekly posts).</div>
            <button onClick={() => openTpl()} data-testid="new-template" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1"><Plus size={14} /> New template</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => (
              <div key={t.id} className="card-surface p-5 group relative" data-testid={`template-${t.id}`}>
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openTpl(t)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800"><Copy size={13} /></button>
                  <button onClick={() => delTpl(t.id)} className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
                <div className="text-[14px] font-semibold text-slate-900">{t.name}</div>
                <div className="text-[11px] mono text-slate-500 mt-1">{t.title_template || t.desc?.slice(0, 60) || "—"}</div>
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  {t.client && <span className="chip status-active">{clients.find(c => c.id === t.client)?.name || t.client}</span>}
                  <span className={`chip priority-${t.priority}`}>{t.priority}</span>
                  {t.recurring !== "none" && <span className="chip status-recurring">{t.recurring}</span>}
                  <span className="mono text-[10px] text-slate-500 ml-auto">+{t.default_days}d</span>
                </div>
                {(t.deliverables || []).length > 0 && (
                  <ul className="mt-3 text-[12px] text-slate-600 list-disc ml-5 space-y-0.5">
                    {t.deliverables.slice(0,3).map((d,i) => <li key={i}>{d}</li>)}
                  </ul>
                )}
              </div>
            ))}
            {templates.length === 0 && <div className="text-center text-slate-400 py-8 text-sm">No templates yet. Create one for the work you do every week or month.</div>}
          </div>
        </div>
      )}

      {tplForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setTplForm(null)}>
          <form onSubmit={submitTpl} className="bg-white rounded-[12px] w-full max-w-lg p-6 space-y-3 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="template-modal">
            <div className="text-[13px] font-semibold">{tplForm.id ? "Edit template" : "New job template"}</div>
            <input required placeholder="Name (e.g. Monthly SEO Report)" value={tplForm.name} onChange={e => setTplForm({ ...tplForm, name: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="tpl-name" />
            <input placeholder="Title template (e.g. {client} SEO Report — {month})" value={tplForm.title_template} onChange={e => setTplForm({ ...tplForm, title_template: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm mono" data-testid="tpl-title-template" />
            <div className="flex gap-2">
              <select value={tplForm.client || ""} onChange={e => setTplForm({ ...tplForm, client: e.target.value || null })} className="flex-1 h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
                <option value="">Any client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={tplForm.priority} onChange={e => setTplForm({ ...tplForm, priority: e.target.value })} className="h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
                <option>low</option><option>medium</option><option>high</option>
              </select>
              <select value={tplForm.recurring} onChange={e => setTplForm({ ...tplForm, recurring: e.target.value })} className="h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
                <option>none</option><option>weekly</option><option>monthly</option><option>quarterly</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] uppercase mono tracking-widest text-slate-500 mb-1">Default team roles</div>
              <div className="flex gap-1 flex-wrap">
                {ROLE_KEYS.map(rk => (
                  <button key={rk} type="button" onClick={() => setTplForm(f => ({ ...f, team: f.team.includes(rk) ? f.team.filter(x => x !== rk) : [...f.team, rk] }))} className={`px-2 py-1 rounded-full text-[11px] font-medium ${tplForm.team.includes(rk) ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>{ROLE_LABEL[rk]}</button>
                ))}
              </div>
            </div>
            <textarea rows={2} placeholder="Description" value={tplForm.desc} onChange={e => setTplForm({ ...tplForm, desc: e.target.value })} className="w-full p-2 border border-[#E5E8F0] rounded-md text-sm" />
            <textarea rows={4} placeholder="Deliverables (one per line)" value={tplForm.deliverablesText} onChange={e => setTplForm({ ...tplForm, deliverablesText: e.target.value })} className="w-full p-2 border border-[#E5E8F0] rounded-md text-sm" data-testid="tpl-deliverables" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] mono text-slate-500">Default deadline: today +</span>
              <input type="number" min={1} value={tplForm.default_days} onChange={e => setTplForm({ ...tplForm, default_days: Number(e.target.value) })} className="w-20 h-9 px-2 border border-[#E5E8F0] rounded-md text-sm mono" />
              <span className="text-[11px] mono text-slate-500">days</span>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTplForm(null)} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              <button type="submit" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold" data-testid="tpl-save">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
