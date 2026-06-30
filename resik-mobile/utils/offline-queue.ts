import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SyncTask,
  SyncActionType,
  SyncEvent,
  SyncQueueStats,
  CreateReportPayload,
} from '../types/offline';
import { citizenApi } from '../lib/supabase/citizen';
import { supabase } from '../lib/supabase/client';
import { logger } from './logger';

const QUEUE_STORAGE_KEY = 'resik_sync_queue_v3';

const MAX_RETRIES = 3;

const BACKOFF_MS: readonly number[] = [5_000, 15_000, 30_000];

const STUCK_TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const SYNCED_LOG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type SyncEventListener = (event: SyncEvent) => void;

export class OfflineQueue {
  private static instance: OfflineQueue;

  private isProcessing = false;

  private listeners: Set<SyncEventListener> = new Set();

  private constructor() { }

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
    }
    return OfflineQueue.instance;
  }

  // ─── Event Emitter ──────────────────────────────────────────────────────────

  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SyncEvent): void {
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        logger.error('SyncEvent listener threw', err);
      }
    });
  }

  // ─── ID Generation ──────────────────────────────────────────────────────────

  private generateLocalUuid(): string {
    return `resik_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // ─── Storage ────────────────────────────────────────────────────────────────

  async getTasks(): Promise<SyncTask[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SyncTask[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      logger.error('Failed to read sync queue', err);
      return [];
    }
  }

  private async saveTasks(tasks: SyncTask[]): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      logger.error('CRITICAL: Failed to persist sync queue', err);
    }
  }

  /** Clear all tasks (dev/test use only). */
  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    logger.info('Sync queue cleared');
  }

  // ─── Statistics ─────────────────────────────────────────────────────────────

  async getStats(): Promise<SyncQueueStats> {
    const tasks = await this.getTasks();
    return {
      pending: tasks.filter((t) => t.sync_status === 'waiting').length,
      syncing: tasks.filter((t) => t.sync_status === 'syncing').length,
      synced: tasks.filter((t) => t.sync_status === 'synced').length,
      failed: tasks.filter((t) => t.sync_status === 'failed').length,
      total: tasks.length,
    };
  }

  // ─── Duplicate Prevention ───────────────────────────────────────────────────

  async isDuplicate(localUuid: string): Promise<boolean> {
    const tasks = await this.getTasks();
    return tasks.some((t) => t.local_uuid === localUuid);
  }

  // ─── Enqueue ────────────────────────────────────────────────────────────────

  async addTask(
    type: SyncActionType,
    payload: CreateReportPayload,
    existingLocalUuid?: string
  ): Promise<SyncTask> {
    const localUuid = existingLocalUuid ?? this.generateLocalUuid();

    // Idempotent enqueue: do not add if already queued.
    if (await this.isDuplicate(localUuid)) {
      logger.warn(`Task already queued: ${localUuid}`);
      const tasks = await this.getTasks();
      const existing = tasks.find((t) => t.local_uuid === localUuid);
      if (existing) return existing;
    }

    const taskPayload: CreateReportPayload = {
      ...payload,
      local_uuid: localUuid,
      idempotency_key: localUuid,
    };

    const newTask: SyncTask = {
      id: localUuid,
      local_uuid: localUuid,
      type,
      payload: taskPayload,
      priority: 0,
      retry_count: 0,
      sync_status: 'waiting',
      created_at: new Date().toISOString(),
      photoUris: payload.photo_url ? [payload.photo_url] : [],
    };

    const tasks = await this.getTasks();
    tasks.push(newTask);
    await this.saveTasks(tasks);

    logger.info(`Task queued: ${type}`, { localUuid });
    this.emit({ type: 'TASK_QUEUED', taskId: localUuid });

    // Non-blocking: try to sync immediately (no-op if offline or locked)
    this.processQueue().catch((err) =>
      logger.error('processQueue failed after addTask', err)
    );

    return newTask;
  }

  // ─── Manual Retry ───────────────────────────────────────────────────────────

  async retryFailed(): Promise<void> {
    let tasks = await this.getTasks();
    let mutated = false;
    tasks = tasks.map((t) => {
      if (t.sync_status === 'failed') {
        mutated = true;
        return {
          ...t,
          sync_status: 'waiting' as const,
          retry_count: 0,
          lastError: undefined,
          nextRetryAt: undefined,
        };
      }
      return t;
    });
    if (mutated) {
      await this.saveTasks(tasks);
      logger.info('Failed tasks reset to waiting');
      this.processQueue().catch((err) =>
        logger.error('processQueue failed after retryFailed', err)
      );
    }
  }

  // ─── Backoff ────────────────────────────────────────────────────────────────

  private isReadyForRetry(task: SyncTask): boolean {
    if (!task.nextRetryAt) return true;
    return Date.now() >= new Date(task.nextRetryAt).getTime();
  }

  private computeNextRetryAt(retryCount: number): string {
    const delayMs = BACKOFF_MS[Math.min(retryCount, BACKOFF_MS.length - 1)];
    return new Date(Date.now() + delayMs).toISOString();
  }

  // ─── Synced Log Pruning ─────────────────────────────────────────────────────

  private pruneSyncedLog(tasks: SyncTask[]): SyncTask[] {
    const cutoff = Date.now() - SYNCED_LOG_TTL_MS;
    return tasks.filter((t) => {
      if (t.sync_status === 'synced' && t.syncedAt) {
        return new Date(t.syncedAt).getTime() > cutoff;
      }
      return true;
    });
  }

  // ─── Process Queue ──────────────────────────────────────────────────────────

  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      logger.info('processQueue: already running, skipping');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      logger.info('processQueue: skipped — no active session');
      return;
    }

    this.isProcessing = true;
    logger.info('processQueue: started');

    try {
      let tasks = await this.getTasks();
      let mutated = false;
      const now = Date.now();

      // ── Step 1: Prune old synced log entries ─────────────────────────────
      const beforePrune = tasks.length;
      tasks = this.pruneSyncedLog(tasks);
      if (tasks.length < beforePrune) {
        mutated = true;
        logger.info(`Pruned ${beforePrune - tasks.length} expired synced log entries`);
      }

      // ── Step 2: Recover stuck tasks ──────────────────────────────────────
      tasks = tasks.map((t) => {
        if (t.sync_status === 'syncing' && t.syncStartedAt) {
          const elapsed = now - new Date(t.syncStartedAt).getTime();
          if (elapsed > STUCK_TASK_TIMEOUT_MS) {
            logger.warn(`Task ${t.id} stuck ${elapsed}ms → reverting to waiting`);
            mutated = true;
            return {
              ...t,
              sync_status: 'waiting' as const,
              retry_count: t.retry_count + 1,
              lastError: 'Sync timeout — will retry',
              nextRetryAt: this.computeNextRetryAt(t.retry_count + 1),
            };
          }
        }
        return t;
      });

      // ── Step 3: Drop tasks that exhausted retries ────────────────────────
      tasks = tasks.filter((t) => {
        if (t.sync_status === 'failed' && t.retry_count >= MAX_RETRIES) {
          logger.warn(`Task ${t.id} dropped after ${MAX_RETRIES} retries: ${t.lastError ?? ''}`);
          this.emit({
            type: 'TASK_DROPPED',
            taskId: t.id,
            reason: t.lastError ?? 'Max retries exceeded',
          });
          mutated = true;
          return false;
        }
        return true;
      });

      if (mutated) {
        await this.saveTasks(tasks);
      }

      // ── Step 4: Collect eligible tasks ───────────────────────────────────
      const eligible = tasks.filter(
        (t) =>
          (t.sync_status === 'waiting' || t.sync_status === 'failed') &&
          this.isReadyForRetry(t)
      );

      if (eligible.length === 0) {
        logger.info('processQueue: nothing to sync');
        this.emit({ type: 'QUEUE_EMPTY' });
        return;
      }

      logger.info(`processQueue: syncing ${eligible.length} task(s)`);

      // ── Step 5: Process sequentially ─────────────────────────────────────
      for (const task of eligible) {
        tasks = await this.getTasks();
        const idx = tasks.findIndex((t) => t.id === task.id);
        if (idx === -1) continue;

        // Mark syncing and persist before the network call
        tasks[idx] = {
          ...tasks[idx],
          sync_status: 'syncing',
          syncStartedAt: new Date().toISOString(),
        };
        await this.saveTasks(tasks);
        this.emit({ type: 'SYNC_STARTED', taskId: task.id });

        try {
          await this.executeTask(tasks[idx]);

          // Success: mark as synced (keep in log for stats), persist
          tasks = await this.getTasks();
          const successIdx = tasks.findIndex((t) => t.id === task.id);
          if (successIdx !== -1) {
            tasks[successIdx] = {
              ...tasks[successIdx],
              sync_status: 'synced',
              syncedAt: new Date().toISOString(),
            };
            await this.saveTasks(tasks);
          }

          logger.info(`Task synced: ${task.type}`, { taskId: task.id });
          this.emit({ type: 'SYNC_SUCCESS', taskId: task.id });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          logger.error(`Task ${task.id} failed: ${errorMsg}`);

          tasks = await this.getTasks();
          const failIdx = tasks.findIndex((t) => t.id === task.id);
          if (failIdx !== -1) {
            const newRetry = tasks[failIdx].retry_count + 1;
            const maxReached = newRetry >= MAX_RETRIES;
            tasks[failIdx] = {
              ...tasks[failIdx],
              sync_status: maxReached ? 'failed' : 'waiting',
              retry_count: newRetry,
              lastError: errorMsg,
              nextRetryAt: maxReached ? undefined : this.computeNextRetryAt(newRetry),
            };
            await this.saveTasks(tasks);

            this.emit({
              type: 'SYNC_FAILED',
              taskId: task.id,
              error: errorMsg,
              retryCount: newRetry,
            });
          }

          // Auth errors: abort entire queue run
          if (
            errorMsg.includes('login') ||
            errorMsg.includes('authenticated') ||
            errorMsg.includes('JWT') ||
            errorMsg.includes('session')
          ) {
            logger.warn('processQueue: stopping — auth error');
            break;
          }
          // Non-auth errors: continue to next task
        }
      }
    } finally {
      this.isProcessing = false;
      logger.info('processQueue: finished');
    }
  }

  // ─── Execute Task ────────────────────────────────────────────────────────────

  private async executeTask(task: SyncTask): Promise<void> {
    switch (task.type) {
      case 'CREATE_REPORT':
        await citizenApi.createReport(task.payload as CreateReportPayload);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }
}

export const offlineQueue = OfflineQueue.getInstance();
