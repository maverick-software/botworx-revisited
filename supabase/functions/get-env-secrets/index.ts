import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Return the environment variables that are needed
    const secrets = {
      supabase_url: Deno.env.get('SUPABASE_URL'),
      supabase_service_role_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      supabase_anon_key: Deno.env.get('SUPABASE_ANON_KEY'),
      project_ref: 'txhscptzjrrudnqwavcb'
    }

    console.log('Environment secrets requested')
    console.log('SUPABASE_URL:', secrets.supabase_url ? 'Set' : 'Not set')
    console.log('SUPABASE_SERVICE_ROLE_KEY:', secrets.supabase_service_role_key ? 'Set' : 'Not set')

    return new Response(
      JSON.stringify(secrets),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in get-env-secrets:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
}) 