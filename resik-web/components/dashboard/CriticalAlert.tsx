'use client';

import { Insight } from '@/types/dashboard';

export function CriticalAlert({ insights }: { insights: Insight[] }) {
  const critical = insights.filter(i => i.severity === 'HIGH')[0];

  if (!critical) return null;

  return (
    <div className="border-l-4 border-red-500 bg-red-950/50 p-4 rounded-r-lg flex items-start justify-between transition-all duration-150 hover:shadow-lg hover:scale-[1.005]">
      <div>
        <div className="text-red-400 text-xs font-bold uppercase tracking-wider">Critical Alert</div>
        <p className="text-white text-lg font-bold mt-1">{critical.message}</p>
        <p className="text-red-300 text-sm mt-1">Action: {critical.action}</p>
      </div>
      <div className="text-red-500 text-2xl font-bold">!</div>
    </div>
  );
}
