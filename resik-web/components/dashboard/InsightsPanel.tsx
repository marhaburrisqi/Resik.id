'use client';

import { memo } from 'react';
import { Insight } from '@/types/dashboard';
import type { AppError } from '@/lib/errors';

const severityConfig = {
  HIGH:   { border: 'border-red-500',     bg: 'bg-red-950/30',     text: 'text-red-400',     badge: 'bg-red-500/20 text-red-300' },
  MEDIUM: { border: 'border-yellow-500',  bg: 'bg-yellow-950/30',  text: 'text-yellow-400',  badge: 'bg-yellow-500/20 text-yellow-300' },
  LOW:    { border: 'border-emerald-500',  bg: 'bg-emerald-950/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
} as const;

function InsightsPanelInner({ insights, error }: { insights: Insight[]; error?: AppError | null }) {
  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Insights & Recommendations</h3>
        <p className="text-slate-500 text-sm">Unable to analyze data. Please try again.</p>
      </div>
    );
  }

  const sorted = [...insights].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

  if (sorted.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Insights & Recommendations</h3>
        <p className="text-emerald-400 text-sm">System operating normally</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Insights & Recommendations</h3>
      <div className="space-y-2">
        {sorted.map((insight, i) => {
          const cfg = severityConfig[insight.severity];
          return (
            <div key={i} className={`border-l-4 ${cfg.border} ${cfg.bg} p-3 rounded-r transition-all duration-150 hover:shadow-md`}>
              <div className="flex items-start gap-2">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${cfg.badge} shrink-0 mt-0.5`}>{insight.severity}</span>
                <div>
                  <p className={`text-sm font-semibold ${cfg.text} leading-snug`}>{insight.message}</p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-snug">Action: {insight.action}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const InsightsPanel = memo(InsightsPanelInner);
