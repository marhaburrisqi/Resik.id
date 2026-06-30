'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Report, Pickup, DashboardStats, Insight } from '@/types/dashboard';
import { normalizeError } from '@/lib/errors';

const DAY = 86400000;

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map(i => [i.id, i] as [string, T]));
  incoming.forEach(i => map.set(i.id, i));
  return Array.from(map.values()).sort(
    (a: any, b: any) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    }
  );
}

function computeStats(reports: Report[]): DashboardStats {
  const statusCounts = { pending: 0, processing: 0, completed: 0 };
  reports.forEach(r => {
    if (r.status in statusCounts) statusCounts[r.status as keyof typeof statusCounts]++;
  });
  return {
    totalReports: reports.length,
    totalWasteKg: reports.reduce((s, r) => s + (r.estimated_weight || 0), 0),
    activeUsers: new Set(reports.filter(r => r.user_id).map(r => r.user_id)).size,
    statusCounts,
  };
}

function computeInsights(reports: Report[], pickups: Pickup[]): Insight[] {
  const insights: Insight[] = [];
  const now = Date.now();

  const stuck = reports.filter(r => r.status === 'processing' && (now - new Date(r.created_at).getTime()) > 7 * DAY);
  if (stuck.length > 0) insights.push({ severity: 'HIGH', message: `${stuck.length} reports stuck in processing`, action: 'Follow up with collectors assigned to these reports' });

  const sevenDaysAgo = new Date(now - 7 * DAY);
  const recentPending = reports.filter(r => r.status === 'pending' && new Date(r.created_at) > sevenDaysAgo);
  if (recentPending.length > 100) insights.push({ severity: 'HIGH', message: `High pending backlog — ${recentPending.length} reports awaiting processing`, action: 'Dispatch additional collectors to clear the backlog' });

  const completed = reports.filter(r => r.status === 'completed').length;
  const pct = reports.length > 0 ? (completed / reports.length) * 100 : 0;
  if (pct < 50 && reports.length > 0) insights.push({ severity: 'MEDIUM', message: `Low completion rate (${pct.toFixed(0)}%)`, action: 'Review collector assignments and dispatch more collectors to pending areas' });

  const totalWaste = reports.reduce((s, r) => s + (r.estimated_weight || 0), 0);
  if (totalWaste > 5000) insights.push({ severity: 'MEDIUM', message: `High waste volume period (${totalWaste.toFixed(0)}kg)`, action: 'Consider scaling pickup capacity for this period' });

  const threeDaysAgo = new Date(now - 3 * DAY);
  const recent = reports.filter(r => new Date(r.created_at) > threeDaysAgo);
  if (recent.length === 0 && reports.length > 0) insights.push({ severity: 'MEDIUM', message: 'No recent reports in 3 days', action: 'Check if citizen reporting is disrupted' });

  const missingLoc = reports.filter(r => r.location_lat == null).length;
  if (missingLoc > 0) insights.push({ severity: 'LOW', message: `${missingLoc} reports missing location data`, action: 'Remind citizens to enable location services when reporting' });

  return insights;
}

export function useRealtimeDashboardData(initialStats: DashboardStats, initialReports: Report[], initialPickups: Pickup[]) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [pickups, setPickups] = useState<Pickup[]>(initialPickups);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ReturnType<typeof normalizeError> | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'fallback'>('disconnected');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const fallbackRef = useRef<any>(null);

  const insights = useMemo(() => computeInsights(reports, pickups), [reports, pickups]);

  const fetchData = useCallback(async (from = '', to = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch reports');
      const { reports: r, pickups: p, stats: s } = await res.json();

      setReports(r);
      setPickups(p);
      setStats(s);
      setLastUpdated(new Date());
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const startFallback = useCallback(() => {
    if (fallbackRef.current) return;
    setRealtimeStatus('fallback');
    fallbackRef.current = setInterval(() => fetchData(), 30000);
  }, [fetchData]);

  const stopFallback = useCallback(() => {
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
        const newReport = payload.new as Report;
        setReports(prev => {
          const updated = mergeById(prev, [newReport]);
          setStats(computeStats(updated));
          return updated;
        });
        setLastUpdated(new Date());
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, (payload) => {
        const updated = payload.new as Report;
        setReports(prev => {
          const merged = mergeById(prev, [updated]);
          setStats(computeStats(merged));
          return merged;
        });
        setLastUpdated(new Date());
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pickups' }, (payload) => {
        const newPickup = payload.new as Pickup;
        setPickups(prev => [newPickup, ...prev]);
        setLastUpdated(new Date());
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pickups' }, (payload) => {
        const updated = payload.new as Pickup;
        setPickups(prev => mergeById(prev, [updated]));
        setLastUpdated(new Date());
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          stopFallback();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('disconnected');
          startFallback();
        }
      });

    // Network reconnection: refetch once, then rely on realtime
    const handleOnline = () => {
      if (realtimeStatus !== 'connected') {
        setRealtimeStatus('connected');
        stopFallback();
        fetchData();
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      supabase.removeChannel(channel);
      stopFallback();
    };
  }, [fetchData, startFallback, stopFallback]);

  return {
    reports,
    pickups,
    stats,
    insights,
    loading,
    error,
    realtimeStatus,
    lastUpdated,
    refetch: fetchData,
  };
}
