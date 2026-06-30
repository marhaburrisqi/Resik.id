import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Guard: prevent admin operations from client-side
if (typeof window !== 'undefined') {
  const originalFrom = supabase.from.bind(supabase);
  supabase.from = function (table: string) {
    const result = originalFrom(table);
    const originalSelect = result.select.bind(result);
    const originalInsert = result.insert.bind(result);
    const originalUpdate = result.update.bind(result);
    const originalDelete = result.delete.bind(result);

    result.select = function (...args: any[]) {
      console.warn('[RESIK] Client-side read from:', table);
      return originalSelect(...args);
    };
    result.insert = function (...args: any[]) {
      console.error('[RESIK] Client-side insert blocked on:', table);
      throw new Error('Direct insert not allowed from client. Use API endpoint.');
    };
    result.update = function (...args: any[]) {
      console.error('[RESIK] Client-side update blocked on:', table);
      throw new Error('Direct update not allowed from client. Use API endpoint.');
    };
    result.delete = function (...args: any[]) {
      console.error('[RESIK] Client-side delete blocked on:', table);
      throw new Error('Direct delete not allowed from client. Use API endpoint.');
    };

    return result;
  };
}
