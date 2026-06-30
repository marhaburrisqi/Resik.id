import { useState, useEffect, useCallback, useRef } from 'react';
import { TrashReport } from '../types/citizen';
import { CreateReportPayload } from '../types/offline';
import { citizenApi } from '../lib/supabase/citizen';
import { supabase } from '../lib/supabase/client';
import { offlineQueue } from '../utils/offline-queue';
import { logger } from '../utils/logger';

const PAGE_SIZE = 20;

export function useRealtimeReports() {
  const [reports, setReports] = useState<TrashReport[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const userRef = useRef<string | null>(null);

  // Helper: Fetch points balance
  const fetchBalance = useCallback(async () => {
    try {
      const points = await citizenApi.getWalletBalance();
      setBalance(points);
    } catch (err) {
      logger.error('Failed to refresh points balance in hook', err);
    }
  }, []);

  // Merge server reports with offline queue items
  const mergeOfflineReports = useCallback(async (serverReports: TrashReport[]): Promise<TrashReport[]> => {
    const user = userRef.current;
    if (!user) return serverReports;

    const queueTasks = await offlineQueue.getTasks();
    const serverIds = new Set(serverReports.map(r => r.idempotency_key));

    // Map offline tasks to TrashReport shape, but only if not yet synced to server
    const offlineReports: TrashReport[] = queueTasks
      .filter(
        (t) =>
          t.type === 'CREATE_REPORT' &&
          t.sync_status !== 'synced' &&
          !serverIds.has(t.local_uuid)
      )
      .map((t) => {
        const p = t.payload as CreateReportPayload;
        return {
          id: t.id,
          idempotency_key: t.local_uuid,
          citizen_id: user,
          trash_type: p.trash_type,
          estimated_weight: p.estimated_weight,
          location_lat: p.location_lat,
          location_lng: p.location_lng,
          accuracy: p.accuracy,
          loc_timestamp: p.loc_timestamp,
          address: p.address || 'Alamat akan dilengkapi saat internet tersedia',
          photo_url: p.photo_url,
          status: 'pending' as const,
          created_at: t.created_at,
          updated_at: t.created_at,
          report_type: p.report_type ?? 'trash',
          description: p.description,
          pendingSync: t.sync_status !== 'synced',
        };
      });

    // Offline drafts appear first (newest); followed by server reports
    return [...offlineReports, ...serverReports];
  }, []);

  // Fetch initial data page and merge with offline queue tasks
  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authErr } = await supabase.auth.getUser();
      if (authErr || !data?.user) {
        setLoading(false);
        return;
      }
      const user = data.user;
      userRef.current = user.id;

      // 1. Fetch server reports (page 1)
      const serverReports = await citizenApi.getReports(1, PAGE_SIZE);

      // 2. Merge with offline queue
      const combined = await mergeOfflineReports(serverReports);

      setReports(combined);
      setPage(1);
      setHasMore(serverReports.length === PAGE_SIZE);

      // 3. Fetch balance
      await fetchBalance();
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data dari server');
      logger.error('Fetch reports failed in useRealtimeReports', err);
    } finally {
      setLoading(false);
    }
  }, [fetchBalance, mergeOfflineReports]);

  // Load more paginated reports
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    const nextPage = page + 1;
    try {
      const moreReports = await citizenApi.getReports(nextPage, PAGE_SIZE);

      setReports(prev => {
        // Prevent duplicate appending
        const existingIds = new Set(prev.map(r => r.id));
        const filtered = moreReports.filter(r => !existingIds.has(r.id));
        return [...prev, ...filtered];
      });

      setPage(nextPage);
      setHasMore(moreReports.length === PAGE_SIZE);
    } catch (err: any) {
      logger.error(`Load more reports page ${nextPage} failed`, err);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);

  // Active report insertion wrapper (for online submits)
  const submitReport = useCallback(async (report: CreateReportPayload) => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await citizenApi.createReport(report);

      // Prepend to local state, replacing any offline draft with matching idempotency key
      setReports(prev => [
        data,
        ...prev.filter(r => r.idempotency_key !== data.idempotency_key && r.id !== data.id),
      ]);
      logger.info('Live report created successfully and prepended to state', { reportId: data.id });
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim laporan');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  // Set up real-time table subscription and offline queue event listener
  useEffect(() => {
    let isMounted = true;
    fetchInitial();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      try {
        const { data, error: authErr } = await supabase.auth.getUser();
        if (!isMounted || authErr || !data?.user) return;
        const user = data.user;

        const channelName = `reports_channel_${user.id}_${Math.random().toString(36).substring(7)}`;
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'reports',
              filter: `citizen_id=eq.${user.id}`,
            },
            (payload) => {
              if (!isMounted) return;
              logger.info('Realtime postgres_changes event received', { eventType: payload.eventType });

              if (payload.eventType === 'INSERT') {
                const newReport = payload.new as TrashReport;
                setReports(prev => {
                  // If it matches an offline draft (by idempotency_key), replace it
                  const exists = prev.some(
                    r => r.id === newReport.id || r.idempotency_key === newReport.idempotency_key
                  );
                  if (exists) {
                    return prev.map(r =>
                      (r.id === newReport.id || r.idempotency_key === newReport.idempotency_key)
                        ? { ...newReport, pendingSync: false }
                        : r
                    );
                  }
                  return [newReport, ...prev];
                });
              } else if (payload.eventType === 'UPDATE') {
                const updatedReport = payload.new as TrashReport;
                setReports(prev =>
                  prev.map(r =>
                    (r.id === updatedReport.id || r.idempotency_key === updatedReport.idempotency_key)
                      ? { ...updatedReport, pendingSync: false }
                      : r
                  )
                );
                if (updatedReport.status === 'completed') {
                  fetchBalance();
                }
              } else if (payload.eventType === 'DELETE') {
                const deletedReport = payload.old as { id: string };
                setReports(prev => prev.filter(r => r.id !== deletedReport.id));
              }
            }
          )
          .subscribe((status) => {
            if (!isMounted) return;
            logger.info(`Realtime reports channel status: ${status}`);
          });
      } catch (err) {
        logger.error('Failed to setup realtime reports subscription', err);
      }
    };

    // Subscribe to offline queue SYNC_SUCCESS events to:
    // - Remove the offline draft card from the list
    // - The realtime INSERT event will add the server version
    const unsubscribeQueue = offlineQueue.subscribe(event => {
      if (!isMounted) return;
      if (event.type === 'SYNC_SUCCESS') {
        // Remove draft card — realtime will add the real server row
        setReports(prev => prev.filter(r => r.id !== event.taskId));
        fetchBalance();
      }
      if (event.type === 'TASK_QUEUED') {
        // A new offline task was added — refresh to show it in list
        fetchInitial();
      }
    });

    setupSubscription();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel).then(() => {
          logger.info('Realtime reports channel subscription cleaned up');
        });
      }
      unsubscribeQueue();
    };
  }, [fetchInitial, fetchBalance]);

  return {
    reports,
    balance,
    loading,
    submitting,
    error,
    hasMore,
    refreshData: fetchInitial,
    loadMore,
    submitReport,
  };
}