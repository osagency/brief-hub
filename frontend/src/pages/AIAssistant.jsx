import React, { useState } from "react";
import api from "../lib/api";
import { Sparkles, Send, Loader2 } from "lucide-react";

const QUICK = [
  { icon: "🏢", label: "Brand health check", prompt: "Give me a brand health check across all 6 clients. Who's on track and who's neglected?" },
  { icon: "⚖️", label: "Rebalance workload", prompt: "Which team member is overloaded? Suggest a workload rebalance for the next 2 weeks." },
  { icon: "✉️", label: "Delay email", prompt: "Draft an email to a client explaining a 2-day delay while keeping the tone confident." },
  { icon: "🚨", label: "Risk assessment", prompt: "What are the top 3 risks across our current job pipeline?" },
  { icon: "💡", label: "Upsell ideas", prompt: "Suggest 3 realistic upsell ideas for each retainer client this quarter." },
  { icon: "📋", label: "Monthly summary", prompt: "Draft a 5-bullet internal summary of this month for the team." },
  { icon: "📝", label: "Brief template", prompt: "Give me a compact 6-field brief template we can use for any new job." },
  { icon: "📚", label: "SOP ideas", prompt: "Which 5 SOPs should Openspace document next? Prioritise by impact." },
];

export default function AIAssistant() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async (p) => {
    const prompt = p || input;
    if (!prompt.trim()) return;
    setLoading(true); setReply("");
    try {
      const { data } = await api.post("/ai/assistant", { prompt });
      setReply(data.reply);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5" data-testid="ai-page">
      <div>
        <div className="text-[11px] uppercase mono tracking-widest text-slate-500">Intelligence</div>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1 flex items-center gap-2"><Sparkles className="text-[#4361EE]" size={20} /> AI Assistant</h1>
        <div className="text-sm text-slate-500 mt-1">Claude Sonnet 4.5 · knows all 6 clients, 5 team members, current workload.</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK.map(q => (
          <button key={q.label} onClick={() => { setInput(q.prompt); ask(q.prompt); }} data-testid={`quick-${q.label.replace(/\s+/g,'-').toLowerCase()}`} className="px-3 py-1.5 rounded-full bg-white border border-[#E5E8F0] text-[12px] hover:border-[#4361EE] hover:text-[#4361EE] transition flex items-center gap-1">
            <span>{q.icon}</span> {q.label}
          </button>
        ))}
      </div>

      <div className="card-surface p-5" data-testid="ai-input-card">
        <textarea rows={3} placeholder="Ask anything about the agency…" value={input} onChange={e => setInput(e.target.value)} className="w-full p-3 border border-[#E5E8F0] rounded-md text-sm resize-none" data-testid="ai-input" />
        <div className="flex justify-end mt-2">
          <button onClick={() => ask()} disabled={loading || !input.trim()} data-testid="ai-send" className="px-4 h-10 rounded-md bg-[#4361EE] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
          </button>
        </div>
      </div>

      {(reply || loading) && (
        <div className="card-surface p-5 min-h-[120px] fade-in-up" data-testid="ai-output">
          <div className="text-[11px] uppercase mono tracking-widest text-slate-500 mb-2 flex items-center gap-1"><Sparkles size={12} className="text-[#4361EE]" /> Claude</div>
          <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
            {loading ? <div className="flex items-center gap-2 text-slate-500"><Loader2 size={14} className="animate-spin" /> Thinking…</div> : reply}
          </div>
        </div>
      )}
    </div>
  );
}
