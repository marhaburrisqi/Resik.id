'use client';

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatPct(n: number): string {
  return Math.round(n * 10) / 10 + '%';
}

export function StatsCard({
  value,
  label,
  accentColor = 'emerald',
  trend,
  loading,
}: {
  value: string | number;
  label: string;
  accentColor?: string;
  trend?: { value: number; label: string };
  loading?: boolean;
}) {
  if (loading) return <StatsCardSkeleton />;

  const display = typeof value === 'number' ? formatNumber(value) : value;
  const isPositive = trend && trend.value >= 0;
  const trendColor = trend
    ? isPositive ? 'text-emerald-400' : 'text-red-400'
    : '';

  return (
    <div
      className={`bg-slate-800 border-l-4 border-${accentColor}-500 p-4 rounded-r-lg transition-all duration-150 hover:shadow-lg hover:scale-[1.02]`}
    >
      <div className="text-white text-3xl font-bold">{display}</div>
      <div className="text-slate-400 text-xs uppercase tracking-wider mt-1">{label}</div>
      {trend && (
        <div className={`text-xs mt-1 ${trendColor} flex items-center gap-1`}>
          <span className="font-semibold">{isPositive ? '+' : ''}{formatPct(Math.abs(trend.value))}</span>
          <span className="text-slate-500">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

function StatsCardSkeleton() {
  return (
    <div className="bg-slate-800 border-l-4 border-slate-700 p-4 rounded-r-lg">
      <div className="shimmer h-8 w-20 rounded bg-slate-700" />
      <div className="shimmer h-3 w-24 rounded bg-slate-700 mt-2" />
    </div>
  );
}
