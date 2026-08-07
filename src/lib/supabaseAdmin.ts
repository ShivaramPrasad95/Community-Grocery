import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL must be set');
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[warn] Using anon key — write operations that bypass RLS may fail. Set SUPABASE_SERVICE_ROLE_KEY in environment.');
  }

  return createClient(supabaseUrl, key, {
    auth: { persistSession: false },
  });
}
