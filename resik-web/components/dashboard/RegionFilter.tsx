'use client';

export function RegionFilter({
  regions,
  selected,
  onChange,
}: {
  regions: string[];
  selected: string;
  onChange: (region: string) => void;
}) {
  return (
    <select
      value={selected}
      onChange={e => onChange(e.target.value)}
      className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded px-2 py-1.5 transition-colors duration-150 focus:border-emerald-500 hover:border-slate-600"
    >
      <option value="">All Regions</option>
      {regions.map(r => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}
