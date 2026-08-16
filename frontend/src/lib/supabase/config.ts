import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Browser-safe client: uses the public anon key only. Access is restricted
// per-table by Postgres Row Level Security policies (see activity_logs
// migration notes), never by hiding this key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
