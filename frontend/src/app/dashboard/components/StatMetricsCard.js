import React from "react";

export default function StatMetricsCard({ label, value, subtext, icon, accentColor }) {
  // Accent colors mapping
  const borderColors = {
    green: "border-l-emerald-500 hover:border-emerald-500/50",
    rose: "border-l-rose-500 hover:border-rose-500/50",
    amber: "border-l-amber-500 hover:border-amber-500/50",
    blue: "border-l-blue-500 hover:border-blue-500/50",
    slate: "border-l-slate-400 hover:border-slate-400/50"
  };

  const selectedBorder = borderColors[accentColor] || borderColors.slate;

  return (
    <div className={`bg-card-bg/60 border border-card-border/60 border-l-4 ${selectedBorder} p-6 rounded-xl hover:shadow-lg transition-all duration-300 backdrop-blur-md flex items-center justify-between group`}>
      <div className="flex-1">
        <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">
          {label}
        </span>
        <span className="text-3xl font-bold tracking-tight block mt-2 text-foreground transition-all group-hover:scale-[1.02] origin-left">
          {value}
        </span>
        {subtext && (
          <span className="text-xs text-muted-text/80 mt-1.5 block font-light">
            {subtext}
          </span>
        )}
      </div>
      {icon && (
        <div className="w-10 h-10 rounded-full bg-sec-bg flex items-center justify-center text-muted-text/80 group-hover:bg-brand-green/10 group-hover:text-brand-green transition-all duration-350">
          {icon}
        </div>
      )}
    </div>
  );
}
