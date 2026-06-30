'use client';

import { useEffect, useRef, memo } from 'react';
import { Report } from '@/types/dashboard';
import type { AppError } from '@/lib/errors';

const statusColor: Record<string, string> = {
  pending: '#eab308',
  processing: '#3b82f6',
  completed: '#10b981',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  processing: 'In Progress',
  completed: 'Completed',
};

function WasteMapInner({ reports, loading, error }: { reports: Report[]; loading?: boolean; error?: AppError | null }) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const LRef = useRef<any>(null);

  useEffect(() => {
    if (loading) return;
    if (error) return;
    if (!containerRef.current) return;

    let cancelled = false;

    import('leaflet').then(L => {
      if (cancelled) return;
      LRef.current = L.default || L;

      // Dynamically import the CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/leaflet.css';
      document.head.appendChild(link);

      const withLocation = reports.filter(r => r.location_lat != null && r.location_lng != null);
      if (withLocation.length === 0) return;

      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

      const L_mod = LRef.current;
      const map = L_mod.map(containerRef.current).setView(
        [withLocation[0].location_lat!, withLocation[0].location_lng!],
        11
      );
      mapRef.current = map;

      L_mod.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM',
      }).addTo(map);

      withLocation.forEach((r: Report) => {
        const color = statusColor[r.status] || '#6b7280';
        const marker = L_mod.circleMarker([r.location_lat!, r.location_lng!], {
          radius: 7,
          color: '#fff',
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(map);
        marker.bindPopup(
          `<div style="font-family:system-ui;min-width:140px">` +
          `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.waste_type}</div>` +
          `<div style="font-size:12px;color:#374151;margin-bottom:2px"><b>${Number(r.estimated_weight).toLocaleString('en-US')}kg</b></div>` +
          `<div style="font-size:11px;color:#6b7280">${statusLabel[r.status] || r.status}</div>` +
          (r.address ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">${r.address}</div>` : '') +
          `</div>`
        );
      });

      const bounds = L_mod.latLngBounds(withLocation.map((r: Report) => [r.location_lat!, r.location_lng!]));
      map.fitBounds(bounds, { padding: [20, 20] });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [reports, loading, error]);

  if (error) return (
    <div>
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Waste Reports Map</h3>
      <div className="h-64 w-full rounded-lg bg-slate-800 border border-red-500/20 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Unable to load map data. Please try again.</p>
      </div>
    </div>
  );

  if (loading) return (
    <div>
      <div className="shimmer h-3 w-32 rounded bg-slate-700 mb-2" />
      <div className="h-64 w-full rounded-lg bg-slate-800 shimmer" />
    </div>
  );

  return (
    <div>
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Waste Reports Map</h3>
      <div ref={containerRef} className="h-64 w-full rounded-lg overflow-hidden bg-slate-800" />
      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
        {(['pending','processing','completed'] as const).map(s => (
          <div key={s} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: statusColor[s] }} />
            <span className="capitalize">{s}</span>
          </div>
        ))}
      </div>
      {reports.filter(r => r.location_lat == null).length > 0 && (
        <p className="text-slate-500 text-xs mt-1">
          {reports.filter(r => r.location_lat == null).length} reports missing location data
        </p>
      )}
      {reports.filter(r => r.location_lat != null).length === 0 && reports.length > 0 && (
        <p className="text-slate-500 text-xs mt-1">No reports with location in selected period</p>
      )}
    </div>
  );
}

export const WasteMap = memo(WasteMapInner);
