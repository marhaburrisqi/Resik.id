'use client';

import type { OfflineStatus } from '@/hooks/use-offline';

const config = {
  online:   { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Online' },
  offline:   { dot: 'bg-red-500',    text: 'text-red-400',    label: 'Offline' },
  syncing:  { dot: 'bg-yellow-500',  text: 'text-yellow-400',  label: 'Syncing' },
} as const;

export function OfflineIndicator({ status }: { status: OfflineStatus }) {
  const cfg = config[status];
  return (
    <div className={`flex items-center gap-1.5 text-xs ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
      <span>{cfg.label}</span>
    </div>
  );
}
