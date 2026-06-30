const IDEMPOTENCY_KEY_PREFIX = 'resik_idem_';

export function generateIdempotencyKey(userId: string, timestamp: number): string {
  return `${IDEMPOTENCY_KEY_PREFIX}${userId}_${timestamp}`;
}

export function storeIdempotencyResult(key: string, result: { reportId: string; created_at: string }) {
  try {
    if (typeof window === 'undefined') return;
    const stored = JSON.parse(localStorage.getItem('resik_idem_cache') || '{}');
    stored[key] = { result, expires: Date.now() + 24 * 60 * 60 * 1000 };
    localStorage.setItem('resik_idem_cache', JSON.stringify(stored));
  } catch { /* ignore storage errors */ }
}

export function getIdempotencyResult(key: string): { reportId: string; created_at: string } | null {
  try {
    if (typeof window === 'undefined') return null;
    const stored = JSON.parse(localStorage.getItem('resik_idem_cache') || '{}');
    const entry = stored[key];
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      delete stored[key];
      localStorage.setItem('resik_idem_cache', JSON.stringify(stored));
      return null;
    }
    return entry.result;
  } catch { return null; }
}

export function clearExpiredIdempotency() {
  try {
    if (typeof window === 'undefined') return;
    const stored = JSON.parse(localStorage.getItem('resik_idem_cache') || '{}');
    const now = Date.now();
    let changed = false;
    for (const key of Object.keys(stored)) {
      if (stored[key].expires < now) {
        delete stored[key];
        changed = true;
      }
    }
    if (changed) localStorage.setItem('resik_idem_cache', JSON.stringify(stored));
  } catch { /* ignore */ }
}
