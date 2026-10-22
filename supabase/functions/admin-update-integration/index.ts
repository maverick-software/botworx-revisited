import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Create a Supabase client with service role key (bypasses RLS)
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create a client with anon key to verify user auth
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated and is admin
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const { data: userRoles, error: roleError } = await supabaseServiceRole
      .from('user_roles')
      .select(`
        roles (
          name
        )
      `)
      .eq('user_id', user.id)

    if (roleError) {
      throw new Error('Error checking user roles')
    }

    const isAdmin = userRoles?.some(ur => ur.roles?.name === 'admin')
    if (!isAdmin) {
      throw new Error('Admin access required')
    }

    // Parse the request body
    const { integrationId, updateData, operation = 'update' } = await req.json()

    if (!integrationId) {
      throw new Error('Missing integrationId')
    }

    if (operation === 'update' && !updateData) {
      throw new Error('Missing updateData for update operation')
    }

    let data, error

    if (operation === 'delete') {
      // Delete the integration using service role (bypasses RLS)
      const result = await supabaseServiceRole
        .from('integrations')
        .delete()
        .eq('id', integrationId)
        .select()

      data = result.data
      error = result.error
    } else {
      // Update the integration using service role (bypasses RLS)
      const result = await supabaseServiceRole
        .from('integrations')
        .update(updateData)
        .eq('id', integrationId)
        .select()

      data = result.data
      error = result.error
    }

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      throw new Error('No integration found with the specified ID')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: operation === 'delete' ? { deleted: true, id: integrationId } : data[0],
        operation
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in admin-update-integration function:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 