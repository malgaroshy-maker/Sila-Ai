import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Use createBrowserClient for consistent cookie handling across server/client
export const supabase = (supabaseUrl && supabaseKey) 
  ? createBrowserClient(supabaseUrl, supabaseKey)
  : null as any; 
