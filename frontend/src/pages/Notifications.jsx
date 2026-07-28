import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtDate } from "../lib/constants";
import { Bell, Mail, RotateCw, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";

const ICONS = {
  overdue: { icon: AlertTriangle, bg: "#FEE2E2", fg: "#EF4444" },
  email: { icon: Mail, bg: "#DBEAFE", fg: "#4361EE" },
  revision: { icon: RotateCw, bg: "#FEF3C7", fg: "#F59E0B" },
  approval: { icon: CheckCircle2, bg: "#D1FAE5", fg: "#10B981" },
  kpi: { icon: TrendingUp, bg: "#EDE9FE", fg: "#8B5CF6" },
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const load = async () => setItems((await api.get("/notifications")).data);
  useEffect(() => { load(); }, []);

  const markAll = async () => { await api.post("/notifications/mark-all-read"); toast.success("All read"); load(); };

  return (
    <div className="space-y-5" data-testid="notifications-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Command</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1 flex items-center gap-2"><Bell size={20} /> Notifications</h1>
        </div>
        <button onClick={markAll} data-testid="mark-all-read" className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm hover:bg-slate-50">Mark all read</button>
      </div>

      <div className="card-surface divide-y divide-[#E5E8F0]">
        {items.map(n => {
          const conf = ICONS[n.type] || ICONS.email;
          const Icon = conf.icon;
          return (
            <div key={n.id} data-testid={`notif-${n.id}`} className={`p-4 flex items-start gap-3 ${!n.read ? "border-l-4 border-l-[#4361EE]" : ""}`}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: conf.bg, color: conf.fg }}><Icon size={16} /></div>
              <div className="flex-1">
                <div className="text-[13px] font-medium text-slate-900">{n.title}</div>
                <div className="text-[12px] text-slate-500 mt-0.5">{n.subtitle}</div>
              </div>
              <div className="text-[11px] mono text-slate-400">{fmtDate(n.time)}</div>
            </div>
          );
        })}
        {items.length === 0 && <div className="text-center text-slate-400 py-8 text-sm">Nothing here.</div>}
      </div>
    </div>
  );
}
