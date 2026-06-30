import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { offlineQueue } from '../utils/offline-queue';
import { SyncTask, SyncEvent, SyncQueueStats } from '../types/offline';
import { logger } from '../utils/logger';


export type SyncFeedbackMessage =
  | null
  | 'Laporan tersimpan di HP'
  | 'Laporan sedang dikirim...'
  | 'Laporan berhasil tersinkron! ✓'
  | 'Akan dicoba lagi sebentar...';

export interface OfflineSyncState {
  /** All tasks currently in the queue */
  pendingTasks: SyncTask[];
  /** True while the engine is actively uploading */
  isSyncing: boolean;
  /** Current network connectivity */
  isConnected: boolean | null;
  /** Number of tasks waiting to be synced (waiting + failed) */
  count: number;
  /** Number of failed tasks only */
  failedCount: number;
  /** Number of successfully synced tasks (from 24h log) */
  syncedCount: number;
  /** Human-readable status message for the citizen */
  feedbackMessage: SyncFeedbackMessage;
  /** Aggregated queue statistics for the Sync Center */
  stats: SyncQueueStats;
  /** Manually trigger a sync attempt */
  syncNow: () => void;
  /** Reset all failed tasks to waiting and retry — for Sync Center CTA */
  retryFailed: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const [pendingTasks, setPendingTasks] = useState<SyncTask[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<SyncFeedbackMessage>(null);
  const [stats, setStats] = useState<SyncQueueStats>({
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    total: 0,
  });

  // Refs to avoid stale closure issues
  const isConnectedRef = useRef<boolean | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Feedback helpers ────────────────────────────────────────────────────────

  const showFeedback = useCallback((msg: SyncFeedbackMessage, durationMs = 4000) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedbackMessage(msg);
    if (msg !== null) {
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackMessage(null);
      }, durationMs);
    }
  }, []);

  // ── Queue refresh ───────────────────────────────────────────────────────────

  const refreshTasks = useCallback(async () => {
    try {
      const [tasks, freshStats] = await Promise.all([
        offlineQueue.getTasks(),
        offlineQueue.getStats(),
      ]);
      setPendingTasks(tasks);
      setStats(freshStats);
      setIsSyncing(tasks.some((t) => t.sync_status === 'syncing'));
    } catch (err) {
      logger.error('Failed to refresh queue task list', err);
    }
  }, []);

  // ── Sync triggers ───────────────────────────────────────────────────────────

  const syncNow = useCallback(() => {
    offlineQueue.processQueue().catch((err) =>
      logger.error('Manual syncNow failed', err)
    );
  }, []);

  const retryFailed = useCallback(async () => {
    await offlineQueue.retryFailed();
    await refreshTasks();
  }, [refreshTasks]);

  // ── Main effect ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // 1. Subscribe to typed queue events for feedback messages
    const unsubscribeEvents = offlineQueue.subscribe((event: SyncEvent) => {
      switch (event.type) {
        case 'TASK_QUEUED':
          showFeedback('Laporan tersimpan di HP', 5000);
          refreshTasks();
          break;
        case 'SYNC_STARTED':
          setIsSyncing(true);
          showFeedback('Laporan sedang dikirim...', 10_000);
          break;
        case 'SYNC_SUCCESS':
          refreshTasks();
          showFeedback('Laporan berhasil tersinkron! ✓', 4000);
          break;
        case 'SYNC_FAILED':
          refreshTasks();
          showFeedback('Akan dicoba lagi sebentar...', 5000);
          break;
        case 'TASK_DROPPED':
          refreshTasks();
          break;
        case 'QUEUE_EMPTY':
          setIsSyncing(false);
          refreshTasks();
          break;
      }
    });

    // 2. Listen for network changes — auto-sync on reconnect
    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = isConnectedRef.current;
      const nowConnected = state.isConnected;
      isConnectedRef.current = nowConnected;
      setIsConnected(nowConnected);

      if (nowConnected && wasConnected === false) {
        logger.info('Network restored → triggering sync');
        syncNow();
      }
    });

    // 3. Listen for app foregrounding — sync + refresh
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active' && prevState !== 'active') {
        logger.info('App foregrounded → refreshing + triggering sync');
        refreshTasks();
        if (isConnectedRef.current) syncNow();
      }
    });

    // 4. Initial load
    refreshTasks();
    NetInfo.fetch().then((state) => {
      isConnectedRef.current = state.isConnected;
      setIsConnected(state.isConnected);
    });

    // 5. Low-frequency polling (3s) — safety net for list accuracy
    const pollInterval = setInterval(refreshTasks, 3000);

    return () => {
      unsubscribeEvents();
      unsubscribeNetInfo();
      appStateSub.remove();
      clearInterval(pollInterval);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [refreshTasks, showFeedback, syncNow]);

  const waitingCount = stats.pending + stats.syncing;

  return {
    pendingTasks,
    isSyncing,
    isConnected,
    count: waitingCount,
    failedCount: stats.failed,
    syncedCount: stats.synced,
    feedbackMessage,
    stats,
    syncNow,
    retryFailed,
  };
}
