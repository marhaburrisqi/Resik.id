import { getServerSupabase } from '@/lib/supabase/server';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import type { Report, Pickup, DashboardStats } from '@/types/dashboard';

function extractRegion(address: string | null): string {
  if (!address) return 'Unknown';
  const parts = address.split(',').map(s => s.trim());
  return parts[parts.length - 1] || 'Unknown';
}

function computeTrend(current: number, previous: number): { value: number; label: string } | undefined {
  if (previous === 0) return current > 0 ? { value: 100, label: 'vs last week' } : undefined;
  return { value: Math.round(((current - previous) / previous) * 100), label: 'vs last week' };
}

export default async function Page() {
  const supabase = getServerSupabase();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

  // All-time stats
  const { count: totalReports } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true });

  const { data: wasteData } = await supabase
    .from('reports')
    .select('estimated_weight');

  const { count: activeUsers } = await supabase
    .from('reports')
    .select('user_id', { count: 'exact', head: true })
    .not('user_id', 'is', null);

  // Current period (last 7 days)
  const { count: curReports } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo);

  const { data: curWaste } = await supabase
    .from('reports')
    .select('estimated_weight')
    .gte('created_at', weekAgo);

  const { count: curUsers } = await supabase
    .from('reports')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', weekAgo)
    .not('user_id', 'is', null);

  // Previous period (7-14 days ago)
  const { count: prevReports } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', twoWeeksAgo)
    .lt('created_at', weekAgo);

  const { data: prevWaste } = await supabase
    .from('reports')
    .select('estimated_weight')
    .gte('created_at', twoWeeksAgo)
    .lt('created_at', weekAgo);

  const { count: prevUsers } = await supabase
    .from('reports')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', twoWeeksAgo)
    .lt('created_at', weekAgo)
    .not('user_id', 'is', null);

  const { data: reportsData } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: pickupsData } = await supabase
    .from('pickups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  const statusCounts = { pending: 0, processing: 0, completed: 0 };
  (reportsData || []).forEach((r: any) => {
    if (statusCounts[r.status as keyof typeof statusCounts] !== undefined) {
      statusCounts[r.status as keyof typeof statusCounts]++;
    }
  });

  const stats: DashboardStats = {
    totalReports: totalReports || 0,
    totalWasteKg: (wasteData || []).reduce((s: number, w: any) => s + (w.estimated_weight || 0), 0),
    activeUsers: activeUsers || 0,
    statusCounts,
    trends: {
      totalReports: computeTrend(curReports || 0, prevReports || 0)!,
      totalWasteKg: computeTrend(
        (curWaste || []).reduce((s: number, w: any) => s + (w.estimated_weight || 0), 0),
        (prevWaste || []).reduce((s: number, w: any) => s + (w.estimated_weight || 0), 0)
      )!,
      activeUsers: computeTrend(curUsers || 0, prevUsers || 0)!,
    },
  };

  const reports = (reportsData || []) as Report[];
  const pickups = (pickupsData || []) as Pickup[];

  const regions = [...new Set(reports.map(r => extractRegion(r.address)))].sort();

  return (
    <DashboardPage
      initialStats={stats}
      initialReports={reports}
      initialPickups={pickups}
    />
  );
}
