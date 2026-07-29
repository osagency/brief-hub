import React from "react";

// Simple, cheerful empty state — used across pages that can have zero data.
export default function EmptyState({ icon: Icon, title, subtitle, action, testid = "empty-state" }) {
  return (
    <div className="card-surface p-10 text-center" data-testid={testid}>
      {Icon && (
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#4361EE]/10 to-[#EC4899]/10 flex items-center justify-center mb-3">
          <Icon size={26} className="text-[#4361EE]" />
        </div>
      )}
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      {subtitle && <div className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{subtitle}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
