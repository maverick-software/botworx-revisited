import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  console.log(`[debug-temp-chat] === DEBUG START ===`)
  console.log(`[debug-temp-chat] Method: ${req.method}`)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[debug-temp-chat] Creating Supabase client`)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    console.log(`[debug-temp-chat] Supabase client created`)

    console.log(`[debug-temp-chat] Testing generate_temp_chat_token function`)
    const { data: tokenResult, error: tokenError } = await supabase
      .rpc('generate_temp_chat_token')

    console.log(`[debug-temp-chat] Token result:`, tokenResult)
    console.log(`[debug-temp-chat] Token error:`, tokenError)

    if (tokenError) {
      console.error(`[debug-temp-chat] Token generation failed:`, tokenError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token generation failed',
          details: tokenError
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[debug-temp-chat] Success! Token generated: ${tokenResult}`)
    return new Response(
      JSON.stringify({
        success: true,
        token_result: tokenResult,
        message: 'Token generation test successful'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`[debug-temp-chat] CRITICAL ERROR:`, error)
    console.error(`[debug-temp-chat] Error stack:`, error.stack)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Critical error',
        details: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
