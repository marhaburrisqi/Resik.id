'use client';

import { StatsCard } from './StatsCard';
import { OperationalSummary } from './OperationalSummary';
import { DashboardStats } from '@/types/dashboard';
import type { AppError } from '@/lib/errors';

export function StatsGrid({ stats, loading, error }: { stats: DashboardStats; loading?: boolean; error?: AppError | null }) {
  if (error) return <StatsGridError />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatsCard
          loading={loading}
          value={stats.totalReports}
          label="Total Reports"
          accentColor="emerald"
          trend={stats.trends?.totalReports}
        />
        <StatsCard
          loading={loading}
          value={`${Number(stats.totalWasteKg).toLocaleString('en-US')}kg`}
          label="Total Waste"
          accentColor="emerald"
          trend={stats.trends?.totalWasteKg}
        />
        <StatsCard
          loading={loading}
          value={stats.activeUsers}
          label="Active Users"
          accentColor="emerald"
          trend={stats.trends?.activeUsers}
        />
      </div>
      <OperationalSummary
        loading={loading}
        pending={stats.statusCounts.pending}
        processing={stats.statusCounts.processing}
        completed={stats.statusCounts.completed}
        total={stats.totalReports}
      />
    </div>
  );
}

function StatsGridError() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-slate-800 border-l-4 border-red-500/50 p-4 rounded-r-lg">
            <div className="text-slate-500 text-3xl font-bold">—</div>
            <div className="text-slate-600 text-xs uppercase tracking-wider mt-1">Unavailable</div>
          </div>
        ))}
      </div>
      <div className="bg-slate-800 border-l-4 border-red-500/50 p-4 rounded-r-lg">
        <div className="text-slate-500 text-xs uppercase tracking-wider mb-1">Operational Summary</div>
        <div className="text-slate-600 text-sm">Data unavailable</div>
      </div>
    </div>
  );
}
