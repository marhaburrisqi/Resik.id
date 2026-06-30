export type SyncActionType = 'CREATE_REPORT' | 'UPDATE_STATUS' | 'PROCESS_PICKUP';

/**
 * Sync status lifecycle:
 *   waiting  → task is queued, waiting for connectivity or backoff delay
 *   syncing  → network call in progress right now
 *   synced   → successfully uploaded to Supabase (kept in log for 24h then pruned)
 *   failed   → all retries exhausted, citizen must manually retry
 */
export type SyncTaskStatus = 'waiting' | 'syncing' | 'synced' | 'failed';

/** Typed payload for CREATE_REPORT sync tasks */
export interface CreateReportPayload {
  trash_type: string;
  estimated_weight: number;
  location_lat: number;
  location_lng: number;
  accuracy: number;
  loc_timestamp: number;
  source?: string;
  address?: string | null;
  photo_url?: string;
  /** Supabase Storage object path — used to reconstruct the URL on retry */
  storage_path?: string;
  idempotency_key?: string;
  /** local_uuid is the stable deduplication key stored in the task and sent to Supabase */
  local_uuid?: string;
  tracking_id?: string;
  report_type?: 'trash' | 'illegal';
  description?: string;
}

/** Typed payload for UPDATE_STATUS sync tasks */
export interface UpdateStatusPayload {
  report_id: string;
  status: string;
}

/** Typed payload for PROCESS_PICKUP sync tasks */
export interface ProcessPickupPayload {
  report_id: string;
  actual_weight: number;
  points_per_kg: number;
}

/** Discriminated union of all task payloads */
export type SyncTaskPayload = CreateReportPayload | UpdateStatusPayload | ProcessPickupPayload;

/**
 * Production-ready sync task model.
 * Every field is crash-safe — survives app kill, device reboot, and AsyncStorage serialization.
 */
export interface SyncTask {
  /** Unique local identifier, also used as idempotency key for CREATE_REPORT */
  id: string;
  /** Stable deduplication key — matches idempotency_key sent to Supabase */
  local_uuid: string;
  /** The action type to execute on sync */
  type: SyncActionType;
  /** Typed payload containing all data needed for the server call */
  payload: SyncTaskPayload;
  /** Priority for ordering (lower = higher priority). Default 0 */
  priority: number;
  /** Number of times this task has been retried after failure */
  retry_count: number;
  /** ISO timestamp of when the task was originally created */
  created_at: string;
  /** Current processing status */
  sync_status: SyncTaskStatus;
  /** ISO timestamp of when the last sync attempt started */
  syncStartedAt?: string;
  /** ISO timestamp of when the next retry should be attempted (backoff scheduling) */
  nextRetryAt?: string;
  /** Last error message from the most recent failed attempt */
  lastError?: string;
  /** Local photo URIs that need to be uploaded (future: photo upload pipeline) */
  photoUris?: string[];
  /** ISO timestamp of when the task successfully synced */
  syncedAt?: string;
}

export interface SyncQueueState {
  tasks: SyncTask[];
  isSyncing: boolean;
  lastSyncAt?: string;
}

/** Sync event emitted by the queue engine for UI feedback */
export type SyncEvent =
  | { type: 'TASK_QUEUED'; taskId: string }
  | { type: 'SYNC_STARTED'; taskId: string }
  | { type: 'SYNC_SUCCESS'; taskId: string }
  | { type: 'SYNC_FAILED'; taskId: string; error: string; retryCount: number }
  | { type: 'TASK_DROPPED'; taskId: string; reason: string }
  | { type: 'QUEUE_EMPTY' };

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

/** Aggregated queue statistics for UI display */
export interface SyncQueueStats {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
}
