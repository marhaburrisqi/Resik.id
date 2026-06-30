'use client';

import { memo } from 'react';
import { Report, Pickup } from '@/types/dashboard';
import type { AppError } from '@/lib/errors';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ActivityLogInner({
  reports,
  pickups,
  loading,
  error,
}: {
  reports: Report[];
  pickups: Pickup[];
  loading?: boolean;
  error?: AppError | null;
}) {
  if (error) return (
    <div>
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Activity Log</h3>
      <p className="text-slate-500 text-sm py-4">Unable to load activity. Please try again.</p>
    </div>
  );

  if (loading) return <ActivityLogSkeleton />;

  const items = [
    ...reports.map(r => ({
      key: `r-${r.id}`,
      time: r.created_at,
      label: `${r.waste_type}`,
      detail: `${Number(r.estimated_weight).toLocaleString('en-US')}kg — ${r.address || 'No address'}`,
      status: r.status,
    })),
    ...pickups.map(p => ({
      key: `p-${p.id}`,
      time: p.created_at,
      label: `Pickup`,
      detail: p.actual_weight ? `${Number(p.actual_weight).toLocaleString('en-US')}kg collected` : 'In progress',
      status: p.status,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
   .slice(0, 20);

  if (items.length === 0) return <p className="text-slate-500 text-sm py-4">No activity yet.</p>;

  return (
    <div>
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Activity Log</h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-3 text-sm py-2 border-b border-slate-800 transition-all duration-150 hover:scale-[1.005] hover:bg-slate-800/50 px-1 rounded">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              item.status === 'completed' ? 'bg-emerald-500' :
              item.status === 'processing' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span className="text-slate-300 truncate font-medium">{item.label}</span>
            <span className="text-slate-500 text-xs truncate">{item.detail}</span>
            <span className="text-slate-600 text-xs ml-auto shrink-0 tabular-nums">{relativeTime(item.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ActivityLog = memo(ActivityLogInner);

function ActivityLogSkeleton() {
  return (
    <div>
      <div className="shimmer h-3 w-24 rounded bg-slate-700 mb-2" />
      {[1,2,3,4,5].map(i => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-800">
          <div className="shimmer w-2 h-2 rounded-full bg-slate-700" />
          <div className="shimmer h-3 w-24 rounded bg-slate-700" />
          <div className="shimmer h-3 w-32 rounded bg-slate-700" />
          <div className="shimmer h-3 w-16 rounded bg-slate-700 ml-auto" />
        </div>
      ))}
    </div>
  );
}
