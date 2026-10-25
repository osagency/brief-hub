import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";
import api from "../lib/api";
import { TAB_LABELS, useTabs } from "../lib/tabs";

function Toggle({ on, disabled, onClick, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      title={on ? "Visible" : "Hidden"}
      className={`w-9 h-5 rounded-full relative transition-colors ${on ? "bg-[#4361EE]" : "bg-slate-300"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

function UserRow({ u, tabs, onToggle, onAll }) {
  return (
    <tr className="border-t border-[#E5E8F0]" data-testid={`tab-row-${u.id}`}>
      <td className="sticky left-0 bg-white px-3 py-2 min-w-[180px]">
        <div className="text-[13px] font-medium text-slate-900 flex items-center gap-1">
          {u.name} {u.locked && <Lock size={11} className="text-slate-400" />}
        </div>
        <div className="text-[10px] mono text-slate-500">{u.email}</div>
        {!u.locked && (
          <div className="flex gap-2 mt-1">
            <button onClick={() => onAll(u, true)} data-testid={`tab-show-all-${u.id}`} className="text-[10px] text-[#4361EE] hover:underline flex items-center gap-0.5"><Eye size={10} />All</button>
            <button onClick={() => onAll(u, false)} data-testid={`tab-hide-all-${u.id}`} className="text-[10px] text-slate-500 hover:underline flex items-center gap-0.5"><EyeOff size={10} />None</button>
          </div>
        )}
      </td>
      {tabs.map(t => (
        <td key={t} className="px-2 py-2 text-center">
          <Toggle on={u.visible[t]} disabled={u.locked} onClick={() => onToggle(u, t)} testid={`tab-toggle-${u.id}-${t}`} />
        </td>
      ))}
    </tr>
  );
}

export default function TabManager() {
  const [data, setData] = useState({ tabs: [], users: [] });
  const { reload } = useTabs();

  useEffect(() => { api.get("/settings/tabs").then(r => setData(r.data)).catch(() => toast.error("Could not load tab settings")); }, []);

  const save = async (u, visible) => {
    const prev = data;
    setData(d => ({ ...d, users: d.users.map(x => x.id === u.id ? { ...x, visible } : x) }));
    try {
      await api.put("/settings/tabs", { user_id: u.id, visible });
      reload();
    } catch (e) {
      setData(prev);
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const onToggle = (u, t) => save(u, { ...u.visible, [t]: !u.visible[t] });
  const onAll = (u, on) => save(u, Object.fromEntries(data.tabs.map(t => [t, on])));

  return (
    <div className="space-y-5" data-testid="tab-manager-page">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Tab Visibility</h1>
        <p className="text-[13px] text-slate-500 mt-1">Choose which side-panel tabs each team member can see. Changes save instantly; hidden pages can't be opened by link either.</p>
      </div>
      <div className="bg-white border border-[#E5E8F0] rounded-[12px] overflow-x-auto">
        <table className="w-full text-left" data-testid="tab-manager-table">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-2 text-[10px] uppercase mono tracking-widest text-slate-500">Member</th>
              {data.tabs.map(t => (
                <th key={t} className="px-2 py-2 text-[10px] uppercase mono tracking-wider text-slate-500 text-center whitespace-nowrap">{TAB_LABELS[t] || t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.users.map(u => <UserRow key={u.id} u={u} tabs={data.tabs} onToggle={onToggle} onAll={onAll} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
