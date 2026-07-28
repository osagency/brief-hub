import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast, Toaster } from "sonner";
import { CheckCircle2, RotateCcw, Send, FileText, Image as ImageIcon, File as FileIcon, Loader2, MessageSquare, ExternalLink } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/public`;

function fmt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function PublicApproval() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [author, setAuthor] = useState("");
  const [feedback, setFeedback] = useState("");
  const [comment, setComment] = useState("");
  const [action, setAction] = useState(null); // null | 'approve' | 'revise'
  const [submitting, setSubmitting] = useState(false);
  const [previewAtt, setPreviewAtt] = useState(null);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await axios.get(`${API}/approvals/${token}`);
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.detail || "This link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const submit = async () => {
    if (!action) return;
    if (action === "revise" && !feedback.trim()) {
      toast.error("Please share what needs revising.");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/approvals/${token}/decide`, { action, feedback, author: author || "Client" });
      toast.success(action === "approve" ? "Thanks — the team has been notified." : "Revision request sent to the team.");
      setFeedback(""); setAction(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    try {
      await axios.post(`${API}/approvals/${token}/comments`, { text: comment, author: author || "Client" });
      setComment("");
      load();
    } catch { toast.error("Could not post comment."); }
  };

  if (loading) return <FullScreen><Loader2 className="animate-spin text-[#4361EE]" size={22} /></FullScreen>;
  if (error) return <FullScreen><div className="text-center max-w-md"><div className="text-3xl mb-2">🔒</div><div className="text-lg font-semibold text-slate-900">Link not available</div><div className="text-sm text-slate-500 mt-1">{error}</div></div></FullScreen>;
  if (!data) return null;

  const attachments = (data.job?.attachments || []).filter(a => !a.is_deleted);
  const attUrl = (att) => `${API}/approvals/${token}/attachments/${att.id}`;
  const statusTone = { pending: { bg: "#FEF3C7", fg: "#B45309", label: "Awaiting your review" }, approved: { bg: "#D1FAE5", fg: "#047857", label: "Approved ✅" }, rejected: { bg: "#FEE2E2", fg: "#B91C1C", label: "Revision requested 🔄" } }[data.status];

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Toaster position="top-right" richColors />
      {/* Top brand strip */}
      <div className="bg-white border-b border-[#E5E8F0]">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#4361EE] flex items-center justify-center text-white font-bold text-xs">OS</div>
          <div>
            <div className="text-[13px] font-semibold text-slate-900 leading-tight">Openspace Agency</div>
            <div className="text-[10px] mono text-slate-500 leading-tight">Client review portal</div>
          </div>
          <div className="ml-auto text-[11px] mono text-slate-400">Secured link · no login needed</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-5" data-testid="public-approval-page">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase mono tracking-widest" style={{ color: data.clientData?.color || "#4361EE" }}>{data.clientData?.name}</div>
            <h1 className="text-3xl font-semibold text-slate-900 mt-1 tracking-tight" data-testid="approval-title">{data.title}</h1>
            <div className="text-[12px] mono text-slate-500 mt-1">{data.jobId} · sent {fmt(data.sent)}</div>
          </div>
          <span className="chip" style={{ background: statusTone.bg, color: statusTone.fg }} data-testid="approval-status">{statusTone.label}</span>
        </div>

        {/* Deliverable preview */}
        <div className="card-surface p-6">
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2">Deliverable</div>
          <div className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">{data.preview}</div>
          {data.job?.desc && <div className="mt-3 text-[13px] text-slate-600 leading-relaxed border-t border-[#E5E8F0] pt-3">{data.job.desc}</div>}
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="card-surface p-5">
            <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3">Files ({attachments.length})</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {attachments.map(att => {
                const isImg = (att.content_type || "").startsWith("image/");
                const isPdf = (att.content_type || "").includes("pdf");
                const Icon = isImg ? ImageIcon : isPdf ? FileText : FileIcon;
                return (
                  <button key={att.id} onClick={() => setPreviewAtt(att)} data-testid={`public-att-${att.id}`} className="flex items-center gap-2 p-2 rounded-md border border-[#E5E8F0] bg-white hover:border-[#4361EE] transition text-left">
                    <div className="w-9 h-9 rounded-md flex items-center justify-center bg-slate-100 text-slate-600"><Icon size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-slate-900 truncate">{att.filename}</div>
                      <div className="text-[10px] mono text-slate-500">{(att.size/1024).toFixed(1)} KB</div>
                    </div>
                    <ExternalLink size={14} className="text-slate-400" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Decision panel */}
        {data.status === "pending" ? (
          <div className="card-surface p-6" data-testid="decision-panel">
            <div className="text-[13px] font-semibold text-slate-900 mb-3">Your feedback</div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Your name (optional)" className="h-10 px-3 border border-[#E5E8F0] rounded-md text-sm flex-1 min-w-[200px]" data-testid="public-author" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAction("approve")} data-testid="btn-approve" className={`flex-1 h-12 rounded-lg border-2 font-semibold text-[14px] transition flex items-center justify-center gap-2 ${action === "approve" ? "border-emerald-500 bg-emerald-500 text-white" : "border-[#E5E8F0] text-slate-700 hover:border-emerald-500 hover:text-emerald-700"}`}>
                <CheckCircle2 size={16} /> Approve
              </button>
              <button onClick={() => setAction("revise")} data-testid="btn-revise" className={`flex-1 h-12 rounded-lg border-2 font-semibold text-[14px] transition flex items-center justify-center gap-2 ${action === "revise" ? "border-amber-500 bg-amber-500 text-white" : "border-[#E5E8F0] text-slate-700 hover:border-amber-500 hover:text-amber-700"}`}>
                <RotateCcw size={16} /> Request revision
              </button>
            </div>
            {action === "revise" && (
              <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} placeholder="What needs changing? Be as specific as helpful." className="w-full mt-4 p-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="public-feedback" />
            )}
            {action && (
              <div className="flex justify-end mt-4">
                <button onClick={submit} disabled={submitting} data-testid="btn-submit" className="px-4 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card-surface p-6" data-testid="decision-done">
            <div className="text-[13px] font-semibold text-slate-900">Thank you!</div>
            <div className="text-sm text-slate-600 mt-1">Your response was recorded {data.decided_at ? `on ${fmt(data.decided_at)}` : ""}{data.decided_by_client ? ` by ${data.decided_by_client}` : ""}. The team has been notified.</div>
            {data.feedback && <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 text-[13px]"><div className="text-[10px] uppercase mono tracking-widest mb-0.5">Your feedback</div>{data.feedback}</div>}
          </div>
        )}

        {/* Comment thread */}
        <div className="card-surface p-5">
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-3 flex items-center gap-1"><MessageSquare size={11} /> Discussion</div>
          <div className="space-y-3 mb-3" data-testid="public-comments">
            {(data.comments || []).length === 0 && <div className="text-[12px] text-slate-400 italic">No messages yet. Add a note if you have questions.</div>}
            {(data.comments || []).map(c => (
              <div key={c.id} className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-semibold text-slate-700">{c.author?.[0]}</div>
                <div className="flex-1">
                  <div className="text-[11px]"><span className="font-semibold text-slate-900">{c.author}</span> <span className="text-slate-400 mono ml-1">{fmt(c.at)}</span></div>
                  <div className="text-[13px] text-slate-700">{c.text}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === "Enter" && postComment()} placeholder="Ask a question or leave a note…" className="flex-1 h-10 px-3 border border-[#E5E8F0] rounded-md text-sm" data-testid="public-comment-input" />
            <button onClick={postComment} className="px-3 h-10 rounded-md bg-slate-900 text-white text-sm font-semibold flex items-center gap-1"><Send size={12} /> Post</button>
          </div>
        </div>
      </div>

      {previewAtt && (
        <AttachmentPreview att={previewAtt} url={attUrl(previewAtt)} onClose={() => setPreviewAtt(null)} />
      )}
    </div>
  );
}

function FullScreen({ children }) {
  return <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9] p-6">{children}</div>;
}

export function AttachmentPreview({ att, url, onClose }) {
  const isImg = (att.content_type || "").startsWith("image/");
  const isPdf = (att.content_type || "").includes("pdf");
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} data-testid="attachment-preview">
      <div className="bg-white rounded-[12px] w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[#E5E8F0] flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold text-slate-900">{att.filename}</div>
            <div className="text-[10px] mono text-slate-500">{(att.size/1024).toFixed(1)} KB · {att.content_type}</div>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="px-3 h-8 rounded-md border border-[#E5E8F0] text-[12px] hover:bg-slate-50 flex items-center gap-1"><ExternalLink size={12} /> Open</a>
            <button onClick={onClose} className="px-3 h-8 rounded-md bg-slate-900 text-white text-[12px]">Close</button>
          </div>
        </div>
        <div className="p-4 bg-slate-50 flex items-center justify-center min-h-[400px] max-h-[75vh] overflow-auto">
          {isImg && <img src={url} alt={att.filename} className="max-w-full max-h-[70vh] rounded-md" />}
          {isPdf && <iframe src={url} title={att.filename} className="w-full h-[70vh] rounded-md border border-[#E5E8F0]" />}
          {!isImg && !isPdf && (
            <div className="text-center py-10 text-slate-500">
              <div className="text-2xl mb-2">📄</div>
              <div className="text-sm">Preview not available for this file type.</div>
              <a href={url} target="_blank" rel="noreferrer" className="inline-block mt-3 px-3 h-9 rounded-md bg-[#4361EE] text-white text-[13px] font-medium">Open in new tab</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
