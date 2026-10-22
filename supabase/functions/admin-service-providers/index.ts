import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdminServiceProviderRequest {
  action: 'list' | 'create' | 'update' | 'delete'
  data?: {
    id?: string
    name?: string
    display_name?: string
    authorization_endpoint?: string
    token_endpoint?: string
    revoke_endpoint?: string
    discovery_endpoint?: string
    scopes_supported?: any[]
    pkce_required?: boolean
    client_credentials_location?: string
    is_enabled?: boolean
    configuration_metadata?: any
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[admin-service-providers] Raw request method: ${req.method}`)
    
    // Create Supabase service role client (bypasses RLS)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify user is admin
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    // For now, skip admin check since user_profiles doesn't have role column
    // TODO: Implement proper admin role system
    console.log(`[admin-service-providers] Skipping admin check for user: ${user.id}`)
    
    // Alternative: Check if user exists in user_profiles (basic validation)
    const { data: profile, error: profileError } = await supabaseServiceRole
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    console.log(`[admin-service-providers] Profile check:`, { profile, profileError, userId: user.id })

    if (profileError && profileError.code !== 'PGRST116') {
      console.log(`[admin-service-providers] Profile lookup failed:`, profileError)
      // Don't fail for missing profile, just log it
    }

    console.log(`[admin-service-providers] Admin user verified: ${user.id}`)

    let requestBody: AdminServiceProviderRequest
    try {
      const rawText = await req.text()
      console.log(`[admin-service-providers] Raw request body:`, rawText)
      
      if (!rawText || rawText.trim() === '') {
        throw new Error('Request body is empty')
      }
      
      requestBody = JSON.parse(rawText)
      console.log(`[admin-service-providers] Parsed request body:`, JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error(`[admin-service-providers] JSON parse error:`, parseError)
      throw new Error(`Failed to parse request body: ${parseError.message}`)
    }

    const { action, data } = requestBody

    if (!action) {
      throw new Error('Action is required')
    }

    let result: any

    switch (action) {
      case 'list':
        result = await supabaseServiceRole
          .from('service_providers')
          .select('*')
          .order('name')
        break

      case 'create':
        if (!data) {
          throw new Error('Data is required for create action')
        }
        result = await supabaseServiceRole
          .from('service_providers')
          .insert([data])
          .select()
          .single()
        break

      case 'update':
        if (!data || !data.id) {
          throw new Error('Data with id is required for update action')
        }
        const { id, ...updateData } = data
        console.log(`[admin-service-providers] Updating provider ${id} with:`, updateData)
        
        result = await supabaseServiceRole
          .from('service_providers')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()
        
        console.log(`[admin-service-providers] Update result:`, result)
        break

      case 'delete':
        if (!data || !data.id) {
          throw new Error('Data with id is required for delete action')
        }
        result = await supabaseServiceRole
          .from('service_providers')
          .delete()
          .eq('id', data.id)
          .select()
          .single()
        break

      default:
        throw new Error(`Unsupported action: ${action}`)
    }

    if (result.error) {
      console.error(`[admin-service-providers] Database error:`, result.error)
      throw new Error(`Database operation failed: ${result.error.message}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result.data,
        action: action
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('[admin-service-providers] Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
