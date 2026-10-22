import { supabase } from '../lib/supabase';

/**
 * Simple hook to replace the deprecated useSupabaseClient from @supabase/auth-helpers-react
 * Returns the initialized supabase client
 */
export const useSupabaseClient = () => {
  return supabase;
}; 