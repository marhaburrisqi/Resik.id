'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRealtimeDashboardData } from '@/hooks/use-realtime-dashboard';
import { StatsGrid } from './StatsGrid';
import { WasteMap } from './WasteMap';
import { DateFilter } from './DateFilter';
import { RegionFilter } from './RegionFilter';
import { ActivityLog } from './ActivityLog';
import { InsightsPanel } from './InsightsPanel';
import { CriticalAlert } from './CriticalAlert';
import { SystemHealth } from './SystemHealth';
import { OfflineIndicator } from './OfflineIndicator';
import { ReportList } from './ReportList';
import type { Report, Pickup, DashboardStats, Insight } from '@/types/dashboard';
import type { AppError } from '@/lib/errors';
import { useOffline, type OfflineStatus } from '@/hooks/use-offline';

function extractRegion(address: string | null): string {
  if (!address) return 'Unknown';
  const parts = address.split(',').map(s => s.trim());
  return parts[parts.length - 1] || 'Unknown';
}

function computeHealth(reports: Report[]): { status: 'Healthy' | 'Warning' | 'Critical'; reason?: string } {
  const total = reports.length;
  if (total === 0) return { status: 'Healthy', reason: 'No reports to analyze' };

  const completed = reports.filter(r => r.status === 'completed').length;
  const pct = (completed / total) * 100;
  const now = Date.now();
  const stuck = reports.filter(r => r.status === 'processing' && (now - new Date(r.created_at).getTime()) > 7 * 86400000).length;
  const pending = reports.filter(r => r.status === 'pending').length;

  if (stuck > 10 || pending > 100) return { status: 'Critical', reason: `${stuck} stuck reports, ${pending} pending` };
  if (pct < 50 || pending > 50) return { status: 'Warning', reason: `Completion rate ${pct.toFixed(0)}%, ${pending} pending` };
  return { status: 'Healthy', reason: `${pct.toFixed(0)}% completion rate` };
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}s ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}m ago`;
  return `${Math.floor(seconds / 86400)}h ago`;
}

export function DashboardPage({
  initialStats,
  initialReports,
  initialPickups,
}: {
  initialStats: DashboardStats;
  initialReports: Report[];
  initialPickups: Pickup[];
}) {
  const {
    reports,
    pickups,
    stats,
    insights,
    loading,
    error,
    realtimeStatus,
    lastUpdated,
    refetch,
  } = useRealtimeDashboardData(initialStats, initialReports, initialPickups);

  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [region, setRegion] = useState('');
  const offlineStatus: OfflineStatus = useOffline();

  const health = useMemo(() => computeHealth(reports), [reports]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    reports.forEach(r => set.add(extractRegion(r.address)));
    return Array.from(set).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    let r = reports;
    if (dateRange.from) r = r.filter(x => x.created_at >= dateRange.from);
    if (dateRange.to) r = r.filter(x => x.created_at <= dateRange.to + 'T23:59:59');
    if (region) r = r.filter(x => extractRegion(x.address) === region);
    return r;
  }, [reports, dateRange, region]);

  const handleFilterChange = useCallback(async (newRange?: { from: string; to: string }, newRegion?: string) => {
    const from = newRange?.from ?? dateRange.from;
    const to = newRange?.to ?? dateRange.to;
    const reg = newRegion ?? region;
    refetch(from, to);
  }, [dateRange, region, refetch]);

  const handleRetry = () => {
    refetch(dateRange.from, dateRange.to);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      <header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">RESIK</h1>
            <p className="text-slate-400 text-sm">Government Waste Management Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-emerald-500' : realtimeStatus === 'fallback' ? 'bg-yellow-500' : 'bg-red-500'}`} title={`Realtime: ${realtimeStatus}`} />
            {lastUpdated && (
              <span className="text-xs text-slate-500">
                {timeAgo(lastUpdated)}
              </span>
            )}
            <OfflineIndicator status={offlineStatus} />
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-950/50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-center justify-between">
          <div>
            <p className="text-red-400 font-semibold">Unable to load data</p>
            <p className="text-red-300 text-sm">{error.message}</p>
          </div>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-red-500/20 text-red-300 text-sm rounded hover:bg-red-500/30 transition-colors duration-150"
          >
            Retry
          </button>
        </div>
      )}

      <CriticalAlert insights={insights} />

      <StatsGrid stats={stats} loading={loading} error={error} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SystemHealth health={health} />
        <div className="flex items-center gap-2 flex-wrap">
          <DateFilter onChange={r => { setDateRange(r); handleFilterChange(r); }} />
          <RegionFilter regions={regions} selected={region} onChange={reg => { setRegion(reg); handleFilterChange(undefined, reg); }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><WasteMap reports={filteredReports} loading={loading} error={error} /></div>
        <div><InsightsPanel insights={insights} error={error} /></div>
      </div>

      <ReportList reports={filteredReports} pickups={pickups} onAction={() => refetch(dateRange.from, dateRange.to)} />

      <ActivityLog reports={filteredReports.slice(0, 20)} pickups={pickups} loading={loading} error={error} />
    </div>
  );
}
