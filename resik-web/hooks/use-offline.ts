'use client';

import { useState, useEffect } from 'react';

export type OfflineStatus = 'online' | 'offline' | 'syncing';

export function useOffline(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>(typeof window !== 'undefined' && navigator.onLine ? 'online' : 'offline');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => setStatus(navigator.onLine ? 'online' : 'offline');

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return status;
}
