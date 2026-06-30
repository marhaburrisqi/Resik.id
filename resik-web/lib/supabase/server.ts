import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing server Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
}

let _serverClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  // Guard: ensure this is only used server-side
  if (typeof window !== 'undefined') {
    throw new Error('[RESIK] Server Supabase client cannot be used on the client side.');
  }

  if (!_serverClient) {
    _serverClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }

  return _serverClient;
}
