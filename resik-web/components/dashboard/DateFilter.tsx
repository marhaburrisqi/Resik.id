'use client';

import { useState } from 'react';

export function DateFilter({
  onChange,
}: {
  onChange: (range: { from: string; to: string }) => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={from}
        onChange={e => { setFrom(e.target.value); onChange({ from: e.target.value, to }); }}
        className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded px-2 py-1.5 transition-colors duration-150 focus:border-emerald-500 hover:border-slate-600"
      />
      <span className="text-slate-500">to</span>
      <input
        type="date"
        value={to}
        onChange={e => { setTo(e.target.value); onChange({ from, to: e.target.value }); }}
        className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded px-2 py-1.5 transition-colors duration-150 focus:border-emerald-500 hover:border-slate-600"
      />
    </div>
  );
}
