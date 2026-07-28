import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

const HINTS = [
  { role: "Manager", email: "yusuf@osagency.in", pw: "manager123" },
  { role: "Writer", email: "arjun@osagency.in", pw: "team123" },
  { role: "Designer", email: "priya@osagency.in", pw: "team123" },
];

export default function LoginPage() {
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("yusuf@osagency.in");
  const [password, setPassword] = useState("manager123");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      nav("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-stretch bg-[#F4F6F9]">
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[#0F172A] text-white p-14 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#4361EE] flex items-center justify-center text-white font-bold">OS</div>
          <div>
            <div className="text-sm font-semibold">Openspace</div>
            <div className="text-[11px] text-slate-400 mono">osagency.in</div>
          </div>
        </div>
        <div className="relative z-10">
          <div className="text-[11px] uppercase tracking-widest text-[#4361EE] mono mb-3">Internal · Agency OS</div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Six clients. Five people.<br /> One command centre.
          </h1>
          <p className="text-slate-400 mt-4 max-w-md text-sm leading-relaxed">
            AI reads client emails, drafts briefs, delegates the work and keeps every brand on-track. Made for Yusuf and the team at Openspace.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-slate-500 mono">
          <Sparkles size={14} className="text-[#4361EE]" />
          Claude Sonnet 4.5 · Multi-brand aware
        </div>
        <div className="absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full" style={{background: "radial-gradient(circle, rgba(67,97,238,0.25), transparent 70%)"}} />
      </div>

      <div className="flex-1 flex flex-col items-stretch justify-center p-8 md:p-16 max-w-xl mx-auto">
        <div className="w-full">
          <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1">Use your Openspace agency account.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-slate-500 mono">Email</label>
              <input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-lg border border-[#E5E8F0] bg-white text-slate-900 text-sm focus:border-[#4361EE] transition"
                required
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-slate-500 mono">Password</label>
              <input
                data-testid="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-lg border border-[#E5E8F0] bg-white text-slate-900 text-sm focus:border-[#4361EE] transition"
                required
              />
            </div>
            {error && <div className="text-sm text-red-600" data-testid="login-error">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="w-full h-11 rounded-lg bg-[#4361EE] text-white text-sm font-semibold hover:bg-[#3651d0] active:scale-[0.99] transition disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          <div className="mt-8 border-t border-[#E5E8F0] pt-6">
            <div className="text-[11px] uppercase tracking-widest text-slate-400 mono mb-3">Demo accounts</div>
            <div className="space-y-2">
              {HINTS.map((h) => (
                <button
                  key={h.email}
                  type="button"
                  onClick={() => { setEmail(h.email); setPassword(h.pw); }}
                  data-testid={`demo-${h.role.toLowerCase()}`}
                  className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg border border-[#E5E8F0] hover:border-[#4361EE] transition bg-white"
                >
                  <div>
                    <div className="text-[13px] font-medium text-slate-900">{h.role}</div>
                    <div className="text-[11px] text-slate-500 mono">{h.email}</div>
                  </div>
                  <div className="text-[10px] mono text-slate-400">click to fill</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
