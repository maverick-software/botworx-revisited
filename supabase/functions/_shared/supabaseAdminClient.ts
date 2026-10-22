import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database } from '../../../src/types/database.types.ts'; // Adjust path as needed

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is not set in environment variables.');
}
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
}

export const supabaseAdminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

console.log('Supabase admin client initialized in _shared.'); 