'use client';

const statusConfig = {
  Healthy:   { color: 'emerald', bg: 'bg-emerald-950/50', border: 'border-emerald-500', text: 'text-emerald-400', label: 'text-emerald-300' },
  Warning:    { color: 'yellow',  bg: 'bg-yellow-950/50',  border: 'border-yellow-500',  text: 'text-yellow-400',  label: 'text-yellow-300' },
  Critical:   { color: 'red',    bg: 'bg-red-950/50',     border: 'border-red-500',     text: 'text-red-400',     label: 'text-red-300' },
} as const;

export function SystemHealth({ health }: { health: { status: 'Healthy' | 'Warning' | 'Critical'; reason?: string } }) {
  const cfg = statusConfig[health.status];

  return (
    <div className={`${cfg.bg} border-l-4 ${cfg.border} p-3 rounded-r-lg transition-all duration-150 hover:shadow-lg`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full bg-${cfg.color}-500`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>{health.status}</span>
      </div>
      {health.reason && <p className={`text-sm mt-1 ${cfg.label}`}>{health.reason}</p>}
    </div>
  );
}
