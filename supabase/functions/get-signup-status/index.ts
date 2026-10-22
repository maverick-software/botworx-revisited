import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client - use anon key for public access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch signup_enabled setting from platform_settings
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'signup_enabled')
      .single();

    if (error) {
      console.error('Error fetching signup status:', error);
      // Default to enabled if setting doesn't exist
      return new Response(
        JSON.stringify({ 
          enabled: true, 
          message: 'Signup setting not found, defaulting to enabled' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const enabled = data?.value === 'true';

    return new Response(
      JSON.stringify({ 
        enabled,
        message: enabled ? 'Signups are currently enabled' : 'Signups are currently disabled'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        enabled: true, 
        error: 'Failed to check signup status, defaulting to enabled' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

