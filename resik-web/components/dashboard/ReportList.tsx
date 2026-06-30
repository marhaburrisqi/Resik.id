'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Report, Pickup } from '@/types/dashboard';
import { normalizeError } from '@/lib/errors';
import { logPickupCompleted } from '@/lib/logger';

function getRegion(address: string | null): string {
  if (!address) return 'Unknown';
  const parts = address.split(',').map(s => s.trim());
  return parts[parts.length - 1] || 'Unknown';
}

export function ReportList({ reports, pickups, onAction }: {
  reports: Report[];
  pickups: Pickup[];
  onAction?: () => void;
}) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [pickupDate, setPickupDate] = useState('');
  const [collector, setCollector] = useState('');

  const regions = useMemo(() => {
    const set = new Set<string>();
    reports.forEach(r => set.add(getRegion(r.address)));
    return Array.from(set).sort();
  }, [reports]);

  const filtered = useMemo(() => {
    let r = reports;
    if (filterStatus) r = r.filter(x => x.status === filterStatus);
    if (filterRegion) r = r.filter(x => getRegion(x.address) === filterRegion);
    return r;
  }, [reports, filterStatus, filterRegion]);

  async function assignPickup(reportId: string) {
    setActionLoading(reportId);
    try {
      const { error } = await supabase.from('pickups').insert({
        report_id: reportId,
        collector_id: collector || null,
        actual_weight: null,
        status: 'assigned',
      });
      if (error) throw error;

      const { error: updateError } = await supabase
        .from('reports')
        .update({ status: 'processing' })
        .eq('id', reportId);
      if (updateError) throw updateError;

      setAssigning(null);
      setPickupDate('');
      setCollector('');
      onAction?.();
    } catch (err) {
      alert(`Failed to assign pickup: ${(err as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function completePickup(reportId: string) {
    const pickup = pickups.find(p => p.report_id === reportId);
    if (!pickup) { alert('No pickup found for this report'); return; }

    const weightStr = prompt('Enter actual weight (kg):');
    const weight = parseFloat(weightStr || '');
    if (!weightStr || isNaN(weight) || weight <= 0) {
      alert('Valid weight (>0) is required');
      return;
    }

    setActionLoading(reportId);
    try {
      const { error } = await supabase
        .from('pickups')
        .update({ actual_weight: weight, status: 'completed' })
        .eq('id', pickup.id);
      if (error) throw error;

      const { error: updateError } = await supabase
        .from('reports')
        .update({ status: 'completed' })
        .eq('id', reportId);
      if (updateError) throw updateError;

      logPickupCompleted(pickup.id, reportId, weight);
      onAction?.();
    } catch (err) {
      alert(`Failed to complete pickup: ${(err as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Report Management</h3>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded px-2 py-1.5"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={filterRegion}
          onChange={e => setFilterRegion(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded px-2 py-1.5"
        >
          <option value="">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">No reports found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Weight</th>
                <th className="text-left py-2">Address</th>
                <th className="text-left py-2">Status</th>
                <th className="text-right py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="py-2 text-slate-300">{r.waste_type}</td>
                  <td className="py-2 text-slate-300">{Number(r.estimated_weight).toLocaleString('en-US')}kg</td>
                  <td className="py-2 text-slate-500 truncate max-w-[200px]">{r.address || '—'}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                      r.status === 'processing' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>{r.status}</span>
                  </td>
                  <td className="py-2 text-right">
                    {r.status === 'pending' && (
                      <button
                        onClick={() => setAssigning(assigning === r.id ? null : r.id)}
                        disabled={actionLoading === r.id}
                        className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === r.id ? '...' : 'Assign Pickup'}
                      </button>
                    )}
                    {r.status === 'processing' && (
                      <button
                        onClick={() => completePickup(r.id)}
                        disabled={actionLoading === r.id}
                        className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === r.id ? '...' : 'Mark Completed'}
                      </button>
                    )}
                    {r.status === 'completed' && (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {assigning && (
            <div className="mt-3 p-3 bg-slate-900 rounded border border-slate-700">
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="date"
                  value={pickupDate}
                  onChange={e => setPickupDate(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded px-2 py-1"
                />
                <input
                  type="text"
                  value={collector}
                  onChange={e => setCollector(e.target.value)}
                  placeholder="Collector ID (optional)"
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded px-2 py-1"
                />
                <button
                  onClick={() => assignPickup(assigning)}
                  disabled={!pickupDate}
                  className="text-xs bg-emerald-500 text-white px-3 py-1 rounded hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setAssigning(null)}
                  className="text-xs text-slate-400 px-2 py-1 hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
