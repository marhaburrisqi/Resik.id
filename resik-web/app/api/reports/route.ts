import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = getServerSupabase();
  const { searchParams } = new URL(request.url);

  const from = searchParams.get('from');
  const to = searchParams.get('to');

  try {
    let query = supabase.from('reports').select('*');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to + 'T23:59:59');
    const { data: rData } = await query.order('created_at', { ascending: false }).limit(100);

    const r = (rData || []) as any[];
    const { count: total } = await supabase.from('reports').select('*', { count: 'exact', head: true });
    const { data: wData } = await supabase.from('reports').select('estimated_weight');
    const { count: active } = await supabase.from('reports').select('user_id', { count: 'exact', head: true }).not('user_id', 'is', null);
    const { data: pickupsData } = await supabase.from('pickups').select('*').order('created_at', { ascending: false }).limit(20);

    const statusCounts = { pending: 0, processing: 0, completed: 0 };
    (rData || []).forEach((rep: any) => {
      if (statusCounts[rep.status as keyof typeof statusCounts] !== undefined) statusCounts[rep.status as keyof typeof statusCounts]++;
    });

    const stats = {
      totalReports: total || 0,
      totalWasteKg: (wData || []).reduce((s: number, w: any) => s + (w.estimated_weight || 0), 0),
      activeUsers: active || 0,
      statusCounts,
    };

    return NextResponse.json({ reports: r, pickups: pickupsData, stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
