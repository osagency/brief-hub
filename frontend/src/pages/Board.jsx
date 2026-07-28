import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtDate, ROLE_EMOJI, ROLE_COLOR } from "../lib/constants";
import { Repeat } from "lucide-react";
import JobDetailModal from "../components/JobDetailModal";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "active", label: "In Progress" },
  { key: "review", label: "In Review" },
  { key: "done", label: "Done" },
  { key: "overdue", label: "Overdue" },
];

export default function Board() {
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [sel, setSel] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const load = async () => {
    const [j, c, u] = await Promise.all([api.get("/jobs"), api.get("/clients"), api.get("/users")]);
    setJobs(j.data); setClients(c.data); setUsers(u.data);
  };
  useEffect(() => { load(); }, []);

  const onDragStart = (job) => setDragged(job);
  const onDragEnd = () => { setDragged(null); setDropTarget(null); };
  const onDragOver = (colKey, e) => { e.preventDefault(); setDropTarget(colKey); };
  const onDrop = async (colKey, e) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragged || dragged.status === colKey) return;
    // optimistic
    setJobs(prev => prev.map(x => x.id === dragged.id ? { ...x, status: colKey } : x));
    try {
      await api.patch(`/jobs/${dragged.id}`, { status: colKey });
      toast.success(`Moved ${dragged.id} → ${COLUMNS.find(c => c.key === colKey)?.label}`);
    } catch (err) {
      toast.error("Failed to move — reverting");
      load();
    } finally {
      setDragged(null);
    }
  };

  return (
    <div className="space-y-5" data-testid="board-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Work</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Board</h1>
        <div className="text-sm text-slate-500 mt-1">Drag cards between columns to change status.</div>
      </div>

      <div className="grid grid-cols-5 gap-3 min-h-[70vh]">
        {COLUMNS.map(col => {
          const items = jobs.filter(j => j.status === col.key);
          const isTarget = dropTarget === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => onDragOver(col.key, e)}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => onDrop(col.key, e)}
              className={`rounded-[12px] p-3 min-w-[220px] flex flex-col transition ${isTarget ? "bg-[#4361EE]/10 ring-2 ring-[#4361EE]" : "bg-slate-100/70"}`}
              data-testid={`col-${col.key}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] uppercase mono tracking-widest text-slate-600">{col.label}</div>
                <div className="text-[11px] mono text-slate-400">{items.length}</div>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto">
                {items.map(j => {
                  const c = clients.find(x => x.id === j.client) || {};
                  const isDragging = dragged?.id === j.id;
                  return (
                    <div
                      key={j.id}
                      draggable
                      onDragStart={() => onDragStart(j)}
                      onDragEnd={onDragEnd}
                      onClick={() => setSel(j.id)}
                      data-testid={`card-${j.id}`}
                      className={`bg-white border border-[#E5E8F0] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-[#4361EE] transition shadow-sm ${isDragging ? "opacity-40 rotate-1" : ""}`}
                    >
                      <div className="text-[10px] mono text-slate-400 mb-1">{j.id}</div>
                      <div className="text-[13px] font-medium text-slate-900 leading-snug line-clamp-2">{j.title}</div>
                      <div className="flex items-center gap-1 mt-2">
                        {(j.team || []).map(r => <span key={r} className="chip" style={{ background: (ROLE_COLOR[r] || "#4361EE") + "1A", color: ROLE_COLOR[r] || "#4361EE" }}>{ROLE_EMOJI[r]}</span>)}
                        {j.recurring !== "none" && <span className="chip status-recurring"><Repeat size={10} /> {j.recurring}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[10px]" style={{ color: c.color }}>{c.name}</span>
                        <span className="text-[10px] mono text-slate-500">{fmtDate(j.due)}</span>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && <div className="text-[11px] text-slate-400 text-center py-6">Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>

      {sel && <JobDetailModal jobId={sel} onClose={() => setSel(null)} users={users} clients={clients} onUpdate={() => load()} />}
    </div>
  );
}
