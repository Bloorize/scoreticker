import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
// In Next.js, client-side env vars must be prefixed with NEXT_PUBLIC_
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface TeamSOR {
  id: number;
  team_id: string;
  team_name: string;
  team_short_name: string | null;
  sor_value: number;
  season: number;
  created_at: string;
  updated_at: string;
}

