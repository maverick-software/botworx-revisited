import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase admin client (service role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Query auth.users via RPC to check if email exists
    // We use a simple SQL query since auth.users is not directly accessible via REST API
    const { data, error } = await supabaseAdmin.rpc('check_user_exists_by_email', {
      user_email: email
    })

    if (error) {
      console.error('[check-email-exists] Error checking email:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to check email', details: error.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // User exists if the RPC returned true
    const userExists = data === true

    console.log(`[check-email-exists] Email ${email}: exists=${userExists}`)

    return new Response(
      JSON.stringify({ 
        exists: userExists,
        email: email
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[check-email-exists] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

