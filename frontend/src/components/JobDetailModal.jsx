import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { ROLE_EMOJI, ROLE_COLOR, fmtDate, STATUS_LABEL } from "../lib/constants";
import { X, Send, Mail, ListChecks, MessageSquare, Bell } from "lucide-react";

const STAGES = ["Brief", "Create", "Review", "Approve", "Deliver"];
const STATUS_TO_STAGE = { todo: 0, active: 1, review: 2, done: 4, overdue: 1 };

export default function JobDetailModal({ jobId, onClose, onUpdate, users, clients }) {
  const [job, setJob] = useState(null);
  const [comment, setComment] = useState("");
  const [aiKind, setAiKind] = useState(null);
  const [aiReply, setAiReply] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    api.get(`/jobs/${jobId}`).then(({ data }) => setJob(data));
  }, [jobId]);

  if (!jobId) return null;
  if (!job) return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center" data-testid="job-modal-loading">
      <div className="text-white text-sm">Loading…</div>
    </div>
  );

  const client = clients.find((c) => c.id === job.client) || {};
  const stageIdx = STATUS_TO_STAGE[job.status] ?? 0;

  const patch = async (updates) => {
    const { data } = await api.patch(`/jobs/${job.id}`, updates);
    setJob(data);
    onUpdate?.(data);
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    await api.post(`/jobs/${job.id}/comments`, { text: comment });
    setComment("");
    const { data } = await api.get(`/jobs/${job.id}`);
    setJob(data);
  };

  const runAI = async (kind) => {
    setAiKind(kind); setAiLoading(true); setAiReply("");
    try {
      const { data } = await api.post("/ai/job-help", { jobId: job.id, kind });
      setAiReply(data.reply);
    } catch (e) {
      setAiReply("AI request failed: " + (e?.response?.data?.detail || e.message));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} data-testid="job-modal">
      <div className="bg-white rounded-[12px] w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-[1fr_320px]" onClick={(e) => e.stopPropagation()}>
        {/* Left */}
        <div className="p-6 overflow-y-auto max-h-[92vh]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="mono text-[11px] text-slate-400">{job.id}</span>
                {job.scopeAdded > 0 && <Bell size={14} className="text-amber-500" title="Scope creep flagged" data-testid="scope-creep-flag" />}
              </div>
              <h2 className="text-xl font-semibold text-slate-900">{job.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="chip" style={{ background: (client.color || "#94A3B8") + "1A", color: client.color }}>{client.name}</span>
                <span className={`chip status-${job.status}`}>{STATUS_LABEL[job.status]}</span>
                <span className={`chip priority-${job.priority}`}>{job.priority}</span>
              </div>
            </div>
            <button onClick={onClose} data-testid="job-modal-close" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
          </div>

          <div className="text-sm text-slate-600 leading-relaxed mb-6">{job.desc}</div>

          {/* Workflow */}
          <div className="mb-6">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Workflow</div>
            <div className="flex items-center gap-2">
              {STAGES.map((s, i) => {
                const active = i === stageIdx;
                const done = i < stageIdx || job.status === "done";
                const bg = active ? "#4361EE" : done ? "#10B981" : "#E5E8F0";
                const fg = active || done ? "#fff" : "#64748B";
                return (
                  <React.Fragment key={s}>
                    <div className="flex-1 h-10 rounded-lg flex items-center justify-center text-[12px] font-medium" style={{ background: bg, color: fg }} data-testid={`workflow-stage-${s.toLowerCase()}`}>
                      {s}
                    </div>
                    {i < STAGES.length - 1 && <div className="w-3 h-[2px]" style={{ background: done ? "#10B981" : "#E5E8F0" }} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Activity */}
          <div className="mb-4">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Activity</div>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2" data-testid="job-comments">
              {(job.comments || []).length === 0 && <div className="text-xs text-slate-400">No activity yet.</div>}
              {(job.comments || []).map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-semibold text-slate-700">{c.author?.[0]}</div>
                  <div className="flex-1">
                    <div className="text-[12px]"><span className="font-semibold text-slate-900">{c.author}</span> <span className="text-slate-400 mono ml-1">{fmtDate(c.at)}</span></div>
                    <div className="text-sm text-slate-600 leading-relaxed">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" data-testid="comment-input" className="flex-1 h-9 px-3 rounded-md border border-[#E5E8F0] text-sm focus:border-[#4361EE]" />
              <button onClick={postComment} data-testid="post-comment-btn" className="px-3 h-9 rounded-md bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-700 transition flex items-center gap-1"><Send size={12} />Post</button>
            </div>
          </div>

          {/* AI help */}
          <div className="mt-6 border-t border-[#E5E8F0] pt-4">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">AI help</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => runAI("email")} data-testid="ai-help-email" className="chip status-active hover:opacity-80"><Mail size={12} /> Email update</button>
              <button onClick={() => runAI("next")} data-testid="ai-help-next" className="chip status-review hover:opacity-80"><ListChecks size={12} /> Next steps</button>
              <button onClick={() => runAI("standup")} data-testid="ai-help-standup" className="chip status-recurring hover:opacity-80"><MessageSquare size={12} /> Standup</button>
            </div>
            {(aiKind || aiLoading) && (
              <div className="mt-3 bg-white border border-[#E5E8F0] rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap min-h-[80px]" data-testid="ai-help-output">
                {aiLoading ? "Thinking…" : aiReply}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="border-l border-[#E5E8F0] bg-[#FAFBFD] p-5 overflow-y-auto max-h-[92vh]">
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3">Details</div>
          <dl className="space-y-3 text-[13px]">
            <Row k="Due" v={<span className="mono">{fmtDate(job.due)}</span>} />
            <Row k="Progress" v={<span className="mono">{job.progress}%</span>} />
            <Row k="Hours" v={<span className="mono">{job.hours}</span>} />
            <Row k="Revisions" v={<span className="mono">{job.revisions}</span>} />
            <Row k="Recurring" v={<span className="mono capitalize">{job.recurring}</span>} />
          </dl>

          <div className="mt-5">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Team</div>
            <div className="flex flex-wrap gap-2">
              {(job.team || []).map((r) => (
                <span key={r} className="chip" style={{ background: (ROLE_COLOR[r] || "#4361EE") + "1A", color: ROLE_COLOR[r] || "#4361EE" }}>{ROLE_EMOJI[r]} {r}</span>
              ))}
            </div>
            <div className="mt-2 flex -space-x-2">
              {(job.assignees || []).map((uid) => {
                const u = users.find((x) => x.id === uid);
                if (!u) return null;
                return <img key={uid} title={u.name} src={`https://ui-avatars.com/api/?name=${u.name}&background=4361EE&color=fff`} className="w-7 h-7 rounded-full border-2 border-white" alt={u.name} />;
              })}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Status</div>
            <select value={job.status} onChange={(e) => patch({ status: e.target.value })} data-testid="status-select" className="w-full h-9 px-2 rounded-md border border-[#E5E8F0] text-sm bg-white">
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="mt-5">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Progress</div>
            <input type="range" min={0} max={100} value={job.progress} onChange={(e) => patch({ progress: Number(e.target.value) })} data-testid="progress-slider" className="w-full" />
            <div className="text-[11px] mono text-slate-500 mt-1">{job.progress}%</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 text-[12px] uppercase mono tracking-widest">{k}</dt>
      <dd className="text-slate-900">{v}</dd>
    </div>
  );
}
