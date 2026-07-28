import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Sparkles, Mail, Send, X, AlertTriangle, Users, Loader2 } from "lucide-react";

const STATUS_TONE = { complete: "bg-emerald-500", partial: "bg-amber-500", insufficient: "bg-red-500" };

function BriefModal({ email, onClose, clients, refresh }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [editedEmail, setEditedEmail] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: d } = await api.post("/inbox/parse-brief", { emailId: email.id });
        setData(d);
        setEditedEmail(d?.gapQuestionEmail?.body || "");
      } catch (e) {
        toast.error("AI parse failed: " + (e?.response?.data?.detail || e.message));
        onClose();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [email.id]);

  const client = clients.find(c => c.id === email.clientId) || {};

  const createJob = async (status = "todo") => {
    setCreating(true);
    try {
      const { data: job } = await api.post("/inbox/create-job", {
        emailId: email.id,
        brief: data.briefSummary,
        delegation: data.internalDelegation,
        status,
      });
      toast.success(`Job ${job.id} created and delegated.`);
      onClose();
      refresh?.();
    } catch (e) {
      toast.error("Failed to create job: " + (e?.response?.data?.detail || e.message));
    } finally {
      setCreating(false);
    }
  };

  const sendGapEmail = () => {
    toast.success("Gap-questions email sent to client (simulated).");
    createJob("onhold");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} data-testid="brief-modal">
      <div className="bg-white rounded-[12px] w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-[#E5E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#4361EE]" />
            <div className="text-[13px] font-semibold text-slate-900">AI Brief · {client.name}</div>
          </div>
          <button onClick={onClose} data-testid="brief-close" className="p-1.5 hover:bg-slate-100 rounded-md"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="p-14 flex flex-col items-center gap-3 text-slate-500">
            <Loader2 size={24} className="animate-spin text-[#4361EE]" />
            <div className="text-sm">Claude is reading the email…</div>
          </div>
        ) : data ? (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{data.briefSummary?.jobTitle || "Untitled"}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="chip" style={{ background: (client.color || "#94A3B8") + "1A", color: client.color }}>{client.name}</span>
                  <span className={`chip priority-${data.briefSummary?.priority || "medium"}`}>{data.briefSummary?.priority}</span>
                  <span className="chip status-active mono">{data.briefSummary?.deadline || "no deadline"}</span>
                </div>
              </div>
              <span data-testid="brief-status" className={`text-[10px] font-semibold uppercase tracking-widest text-white px-3 py-1 rounded-full ${STATUS_TONE[data.briefStatus] || "bg-slate-500"}`}>
                {data.briefStatus}
              </span>
            </div>

            {/* Primary team */}
            <div>
              <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Primary team</div>
              <div className="flex gap-2 flex-wrap">
                <span className="chip status-active">Owner: {data.internalDelegation?.primaryOwner}</span>
                {(data.briefSummary?.deliverables || []).slice(0,3).map((d,i) => <span key={i} className="chip priority-medium">{d.slice(0,40)}</span>)}
              </div>
            </div>

            {/* Brief */}
            <div>
              <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Project brief</div>
              <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-md p-3">{data.briefSummary?.brief}</div>
            </div>

            {/* Deliverables */}
            {data.briefSummary?.deliverables?.length > 0 && (
              <div>
                <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Deliverables</div>
                <ol className="list-decimal ml-5 text-sm space-y-1 text-slate-700">
                  {data.briefSummary.deliverables.map((d,i) => <li key={i}>{d}</li>)}
                </ol>
              </div>
            )}

            {/* Workload warning */}
            {data.workloadWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2 text-[13px] text-amber-800" data-testid="workload-warning">
                <AlertTriangle size={14} className="mt-0.5" />
                <div>{data.workloadWarning}</div>
              </div>
            )}

            {/* Delegation */}
            {data.internalDelegation?.suggestedWorkflow?.length > 0 && (
              <div>
                <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Delegation plan</div>
                <table className="w-full text-sm border border-[#E5E8F0] rounded-md overflow-hidden">
                  <thead className="bg-slate-50 text-[10px] uppercase mono tracking-widest text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">Stage</th>
                      <th className="text-left px-3 py-2">Person</th>
                      <th className="text-left px-3 py-2">Task</th>
                      <th className="text-left px-3 py-2">In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.internalDelegation.suggestedWorkflow.map((s,i) => (
                      <tr key={i} className="border-t border-[#E5E8F0]">
                        <td className="px-3 py-2 text-slate-900 font-medium">{s.stage}</td>
                        <td className="px-3 py-2 text-slate-600">{s.person}</td>
                        <td className="px-3 py-2 text-slate-600">{s.task}</td>
                        <td className="px-3 py-2 mono text-slate-500">+{s.daysFromNow}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Missing info */}
            {(data.missingInfo?.length > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4" data-testid="missing-info">
                <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2 text-sm"><AlertTriangle size={14} /> Missing information detected</div>
                <ul className="space-y-2 text-[13px] text-amber-900">
                  {data.missingInfo.map((m,i) => (
                    <li key={i}>
                      <span className="font-semibold">{m.field}</span>
                      <span className={`ml-2 chip priority-${m.impact}`}>{m.impact}</span>
                      <div className="text-amber-800/80 text-xs mt-0.5">{m.why}</div>
                    </li>
                  ))}
                </ul>

                {data.gapQuestionEmail && (
                  <div className="mt-4">
                    <div className="text-[11px] uppercase mono tracking-widest text-amber-800 mb-1">Draft follow-up email</div>
                    <div className="text-[11px] mono text-amber-800/70 mb-1">To: {data.gapQuestionEmail.to} · {data.gapQuestionEmail.subject}</div>
                    <textarea data-testid="gap-email-body" value={editedEmail} onChange={e => setEditedEmail(e.target.value)} rows={8} className="w-full text-sm p-3 rounded-md border border-amber-200 bg-white font-mono" />
                  </div>
                )}
              </div>
            )}

            {/* Red flags */}
            {data.redFlags?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-[13px] text-red-800">
                <div className="font-semibold flex items-center gap-1"><AlertTriangle size={14} /> Red flags</div>
                <ul className="list-disc ml-5 mt-1">{data.redFlags.map((f,i)=><li key={i}>{f}</li>)}</ul>
              </div>
            )}

            <div className="flex items-center gap-3 justify-end pt-2 border-t border-[#E5E8F0]">
              <button onClick={onClose} className="px-4 h-10 rounded-md border border-[#E5E8F0] text-sm text-slate-700 hover:bg-slate-50" data-testid="brief-discard">Discard</button>
              {data.missingInfo?.length > 0 && (
                <button onClick={sendGapEmail} data-testid="send-gap-email" className="px-4 h-10 rounded-md bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 flex items-center gap-2">
                  <Send size={14} /> Send gap email
                </button>
              )}
              <button
                disabled={data.briefStatus === "insufficient" || creating}
                onClick={() => createJob("todo")}
                data-testid="create-job-btn"
                className="px-4 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold hover:bg-[#3651d0] disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Create job & delegate
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReplyPanel({ email, clients, onClose }) {
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  useEffect(() => {
    api.post("/inbox/draft-reply", { emailId: email.id }).then(({ data }) => setReply(data.reply)).finally(() => setLoading(false));
  }, [email.id]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" data-testid="reply-modal">
      <div className="bg-white rounded-[12px] w-full max-w-2xl shadow-2xl">
        <div className="p-5 border-b border-[#E5E8F0] flex items-center justify-between">
          <div className="text-[13px] font-semibold text-slate-900 flex items-center gap-2"><Sparkles size={14} className="text-[#4361EE]" /> AI-drafted reply</div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-md"><X size={16} /></button>
        </div>
        <div className="p-5">
          {loading ? <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 size={14} className="animate-spin" /> Drafting…</div> : (
            <textarea value={reply} onChange={e => setReply(e.target.value)} rows={10} className="w-full text-sm p-3 rounded-md border border-[#E5E8F0] font-mono" data-testid="reply-textarea" />
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { navigator.clipboard.writeText(reply); toast.success("Copied"); }} className="px-4 h-9 rounded-md border border-[#E5E8F0] text-sm">Copy</button>
            <button onClick={() => { toast.success("Reply sent (simulated)"); onClose(); }} className="px-4 h-9 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-2"><Send size={12} /> Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Inbox() {
  const [emails, setEmails] = useState([]);
  const [clients, setClients] = useState([]);
  const [sel, setSel] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const load = async () => {
    const [e, c] = await Promise.all([api.get("/inbox"), api.get("/clients")]);
    setEmails(e.data); setClients(c.data);
    if (!sel && e.data.length) setSel(e.data[0]);
  };
  useEffect(() => { load(); }, []);

  const openEmail = async (e) => {
    setSel(e);
    if (!e.read) { await api.post(`/inbox/${e.id}/read`); load(); }
  };

  return (
    <div className="space-y-5" data-testid="inbox-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Command</div>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Smart Inbox</h1>
        </div>
        <button onClick={() => setConnectOpen(true)} data-testid="connect-gmail" className="px-3 h-9 rounded-md border border-[#E5E8F0] text-sm hover:bg-slate-50 flex items-center gap-2">
          <Mail size={14} /> Connect Gmail
        </button>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-4 h-[70vh]">
        {/* Email list */}
        <div className="card-surface overflow-y-auto" data-testid="inbox-list">
          {emails.map(e => {
            const c = clients.find(x => x.id === e.clientId) || {};
            return (
              <button
                key={e.id}
                onClick={() => openEmail(e)}
                data-testid={`inbox-item-${e.id}`}
                className={`w-full text-left px-4 py-3 border-b border-[#E5E8F0] transition ${sel?.id === e.id ? "bg-slate-50" : ""} ${!e.read ? "bg-[#4361EE]/5" : ""} ${e.jobCreated ? "border-l-4 border-l-emerald-500" : ""}`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="mono" style={{ color: c.color }}>{c.name}</span>
                  <span className="text-slate-400 mono">{e.time}</span>
                </div>
                <div className={`text-[13px] mt-1 truncate ${!e.read ? "font-semibold text-slate-900" : "text-slate-700"}`}>{e.subject}</div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{e.preview}</div>
                <div className="mt-1.5">
                  {e.jobCreated ? <span className="chip status-done">Job created ✅</span> : <span className="chip priority-medium">Action needed</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Email detail */}
        {sel ? (
          <div className="card-surface p-6 overflow-y-auto flex flex-col" data-testid="inbox-detail">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] mono text-slate-500">From {sel.senderName} · {sel.from}</div>
                  <h2 className="text-lg font-semibold text-slate-900 mt-1">{sel.subject}</h2>
                </div>
                <span className="chip" style={{ background: ((clients.find(c => c.id === sel.clientId) || {}).color || "#94A3B8") + "1A", color: (clients.find(c => c.id === sel.clientId) || {}).color }}>
                  {(clients.find(c => c.id === sel.clientId) || {}).name}
                </span>
              </div>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[220px] overflow-y-auto bg-slate-50 rounded-md p-3">{sel.body}</div>
            </div>

            <div className="mt-6 border-t border-[#E5E8F0] pt-4">
              <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3">AI Actions</div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setBriefOpen(true)}
                  data-testid="ai-create-brief"
                  className="px-4 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold hover:bg-[#3651d0] flex items-center gap-2"
                >
                  <Sparkles size={14} /> Create brief & delegate
                </button>
                <button
                  onClick={() => setReplyOpen(true)}
                  data-testid="ai-draft-reply"
                  className="px-4 h-10 rounded-md border border-[#E5E8F0] text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
                >
                  <Mail size={14} /> Draft reply
                </button>
              </div>
            </div>
          </div>
        ) : <div className="card-surface flex items-center justify-center text-slate-400">Select an email</div>}
      </div>

      {briefOpen && sel && <BriefModal email={sel} clients={clients} onClose={() => setBriefOpen(false)} refresh={load} />}
      {replyOpen && sel && <ReplyPanel email={sel} clients={clients} onClose={() => setReplyOpen(false)} />}

      {connectOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConnectOpen(false)}>
          <div className="bg-white rounded-[12px] w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()} data-testid="gmail-connect-modal">
            <div className="text-[13px] font-semibold text-slate-900 mb-2">Connect your Gmail</div>
            <p className="text-sm text-slate-600 leading-relaxed">
              To pipe real client emails in, we&apos;ll set up Gmail OAuth (Client ID + Secret + Refresh Token from your Google Cloud project). This preview ships with a curated set of representative client emails so you can test the AI brief parser instantly.
            </p>
            <div className="flex justify-end mt-4">
              <button onClick={() => setConnectOpen(false)} className="px-4 h-9 rounded-md bg-slate-900 text-white text-sm">Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
