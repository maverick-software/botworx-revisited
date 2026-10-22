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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid or expired token')
    }

    // Parse request body
    const { name, description, avatar_url, personality, metadata, system_instructions, assistant_instructions, provider, model } = await req.json()

    if (!name || !name.trim()) {
      throw new Error('Agent name is required')
    }

    // Create agent data with defaults
    const agentData = {
      name: name.trim(),
      description: description || `AI assistant named ${name.trim()}`,
      user_id: user.id,
      active: true,
      avatar_url: avatar_url || null,
      personality: personality || 'helpful',
      system_instructions: system_instructions || `You are ${name.trim()}, a helpful AI assistant. Be friendly, professional, and assist users with their questions and tasks.`,
      assistant_instructions: assistant_instructions || 'Provide clear, accurate, and helpful responses. Ask clarifying questions when needed.',
      metadata: metadata || {},
      reasoning_config: {
        enabled: false,
        threshold: 0.3,
        timeout_ms: 30000,
        max_iterations: 6,
        preferred_styles: ['inductive', 'deductive', 'abductive'],
        confidence_threshold: 0.85,
        safety_switch_enabled: true
      }
    }

    console.log('Creating agent with data:', agentData)

    // Create the agent
    const { data: newAgent, error: createError } = await supabase
      .from('agents')
      .insert([agentData])
      .select()
      .single()

    if (createError) {
      console.error('Error creating agent:', createError)
      throw new Error(`Failed to create agent: ${createError.message}`)
    }

    console.log('Agent created successfully:', newAgent)

    // The database trigger owns default preference creation. Apply an explicit selection once.
    if (provider && model) {
      const { error: llmPrefsError } = await supabase
        .from('agent_llm_preferences')
        .update({ provider, model, params: {} })
        .eq('agent_id', newAgent.id)
      if (llmPrefsError) throw new Error(`Failed to save model preferences: ${llmPrefsError.message}`)
    }

    // The database trigger should automatically grant reasoning permissions
    // Let's verify they were created
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for trigger

    const { data: permissions, error: permError } = await supabase
      .from('agent_integration_permissions')
      .select(`
        *,
        user_integration_credentials!inner(connection_name)
      `)
      .eq('agent_id', newAgent.id)
      .eq('user_integration_credentials.connection_name', 'Internal Reasoning System')

    if (permError) {
      console.warn('Could not verify reasoning permissions:', permError)
    } else {
      console.log('Reasoning permissions verified:', permissions?.length > 0 ? 'granted' : 'not found')
    }

    return new Response(
      JSON.stringify({
        success: true,
        agent: newAgent,
        reasoning_permissions_granted: permissions?.length > 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in create-agent function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
