'use client';

export function OperationalSummary({
  pending,
  processing,
  completed,
  total,
  loading,
}: {
  pending: number;
  processing: number;
  completed: number;
  total: number;
  loading?: boolean;
}) {
  if (loading) return <OperationalSummarySkeleton />;

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <div className="bg-slate-800 rounded-lg p-4 transition-all duration-150 hover:shadow-lg">
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Operational Summary</h3>
      <div className="space-y-2">
        {(
          [
            { label: 'Completed', count: completed, pct: pct(completed), color: 'emerald' },
            { label: 'Processing', count: processing, pct: pct(processing), color: 'yellow' },
            { label: 'Pending', count: pending, pct: pct(pending), color: 'red' },
          ] as const
        ).map(({ label, count, pct, color }) => (
          <div key={label} className="flex items-center gap-3 transition-all duration-150 hover:scale-[1.01]">
            <div className="w-20 text-sm text-slate-300">{label}</div>
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full bg-${color}-500 rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
            </div>
            <div className="w-16 text-right text-sm text-slate-300">{count} <span className="text-slate-500">({pct}%)</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationalSummarySkeleton() {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="shimmer h-3 w-32 rounded bg-slate-700 mb-3" />
      {[1,2,3].map(i => (
        <div key={i} className="flex items-center gap-3 mb-2">
          <div className="shimmer h-3 w-20 rounded bg-slate-700" />
          <div className="flex-1 h-2 rounded bg-slate-700" />
          <div className="shimmer h-3 w-16 rounded bg-slate-700" />
        </div>
      ))}
    </div>
  );
}
