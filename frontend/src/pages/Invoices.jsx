import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtDate, fmtINR } from "../lib/constants";
import { Plus, Receipt } from "lucide-react";

export default function Invoices() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client: "galalite", amount: 0, desc: "", due: "" });

  const load = async () => {
    const [i, c] = await Promise.all([api.get("/invoices"), api.get("/clients")]);
    setItems(i.data); setClients(c.data);
  };
  useEffect(() => { load(); }, []);

  const total = items.reduce((s,i) => s + i.amount, 0);
  const collected = items.filter(i => i.status === "paid").reduce((s,i) => s + i.amount, 0);
  const pending = items.filter(i => i.status === "unpaid").reduce((s,i) => s + i.amount, 0);
  const overdue = items.filter(i => i.status === "overdue").reduce((s,i) => s + i.amount, 0);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/invoices", form);
    toast.success("Invoice created.");
    setOpen(false);
    setForm({ client: "galalite", amount: 0, desc: "", due: "" });
    load();
  };

  const markPaid = async (id) => {
    await api.post(`/invoices/${id}/paid`);
    toast.success("Marked paid.");
    load();
  };

  const Stat = ({ label, value, color }) => (
    <div className="card-surface p-5">
      <div className="text-[11px] uppercase mono tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold mono" style={{ color }}>{fmtINR(value)}</div>
    </div>
  );

  return (
    <div className="space-y-5" data-testid="invoices-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Finance</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Invoices</h1>
        </div>
        <button onClick={() => setOpen(true)} data-testid="new-invoice" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-1"><Plus size={14} /> New invoice</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label="Total invoiced" value={total} color="#0F172A" />
        <Stat label="Collected" value={collected} color="#10B981" />
        <Stat label="Pending" value={pending} color="#F59E0B" />
        <Stat label="Overdue" value={overdue} color="#EF4444" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(i => {
          const c = clients.find(x => x.id === i.client) || {};
          const badge = { paid: "status-done", unpaid: "priority-medium", overdue: "status-overdue" }[i.status];
          const badgeText = { paid: "Paid ✓", unpaid: "Pending", overdue: "Overdue 🚨" }[i.status];
          return (
            <div key={i.id} className="card-surface p-5" data-testid={`invoice-${i.id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] mono text-slate-400">{i.id}</div>
                  <div className="text-[14px] font-semibold text-slate-900 mt-0.5" style={{ color: c.color }}>{c.name}</div>
                </div>
                <span className={`chip ${badge}`}>{badgeText}</span>
              </div>
              <div className="mt-3 mono text-3xl font-semibold text-slate-900">{fmtINR(i.amount)}</div>
              <div className="text-sm text-slate-600 mt-1">{i.desc}</div>
              <div className="flex items-center justify-between mt-3 text-[11px] mono text-slate-500">
                <span>Issued {fmtDate(i.issued)}</span>
                <span>Due {fmtDate(i.due)}</span>
              </div>
              {i.status !== "paid" && (
                <button onClick={() => markPaid(i.id)} data-testid={`pay-${i.id}`} className="mt-4 px-3 h-9 rounded-md bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 flex items-center gap-1"><Receipt size={12} /> Mark as paid</button>
              )}
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form onSubmit={submit} className="bg-white rounded-[12px] w-full max-w-md p-6 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="new-invoice-modal">
            <div className="text-[13px] font-semibold text-slate-900">New invoice</div>
            <select value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm">
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input required type="number" placeholder="Amount ₹" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="inv-amount" />
            <input required type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="inv-due" />
            <input required placeholder="Description" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} className="w-full h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="inv-desc" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm">Cancel</button>
              <button type="submit" className="px-3 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
