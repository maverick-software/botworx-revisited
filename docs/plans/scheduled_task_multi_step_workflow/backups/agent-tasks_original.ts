import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Cron from 'https://esm.sh/croner@4'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
}

// Helper function to calculate next run time using croner
function calculateNextRunTime(cronExpression: string, timezone: string = 'UTC'): string | null {
  try {
    const cronJob = new Cron(cronExpression, { timezone });
    const nextRun = cronJob.nextRun();
    return nextRun ? nextRun.toISOString() : null;
  } catch (error) {
    console.error('Error calculating next run time:', error);
    return null;
  }
}

interface Database {
  public: {
    Tables: {
      agent_tasks: {
        Row: {
          id: string
          agent_id: string
          user_id: string
          name: string
          description: string | null
          task_type: 'scheduled' | 'event_based'
          status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
          instructions: string
          selected_tools: any[]
          cron_expression: string | null
          timezone: string
          next_run_at: string | null
          last_run_at: string | null
          event_trigger_type: string | null
          event_trigger_config: any
          total_executions: number
          successful_executions: number
          failed_executions: number
          max_executions: number | null
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          agent_id: string
          user_id: string
          name: string
          description?: string | null
          task_type?: 'scheduled' | 'event_based'
          status?: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
          instructions: string
          selected_tools?: any[]
          cron_expression?: string | null
          timezone?: string
          next_run_at?: string | null
          last_run_at?: string | null
          event_trigger_type?: string | null
          event_trigger_config?: any
          total_executions?: number
          successful_executions?: number
          failed_executions?: number
          max_executions?: number | null
          start_date?: string | null
          end_date?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          agent_id?: string
          user_id?: string
          name?: string
          description?: string | null
          task_type?: 'scheduled' | 'event_based'
          status?: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'
          instructions?: string
          selected_tools?: any[]
          cron_expression?: string | null
          timezone?: string
          next_run_at?: string | null
          last_run_at?: string | null
          event_trigger_type?: string | null
          event_trigger_config?: any
          total_executions?: number
          successful_executions?: number
          failed_executions?: number
          max_executions?: number | null
          start_date?: string | null
          end_date?: string | null
          created_by?: string | null
        }
      }
      agent_task_executions: {
        Row: {
          id: string
          task_id: string
          agent_id: string
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          trigger_type: string
          trigger_data: any
          instructions_used: string
          tools_used: any[]
          started_at: string | null
          completed_at: string | null
          duration_ms: number | null
          output: string | null
          tool_outputs: any[]
          error_message: string | null
          metadata: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          agent_id: string
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          trigger_type: string
          trigger_data?: any
          instructions_used: string
          tools_used?: any[]
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          output?: string | null
          tool_outputs?: any[]
          error_message?: string | null
          metadata?: any
        }
        Update: {
          id?: string
          task_id?: string
          agent_id?: string
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
          trigger_type?: string
          trigger_data?: any
          instructions_used?: string
          tools_used?: any[]
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          output?: string | null
          tool_outputs?: any[]
          error_message?: string | null
          metadata?: any
        }
      }
      agents: {
        Row: {
          id: string
          user_id: string
          name: string
        }
      }
    }
  }
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
    const url = new URL(req.url)
    const segments = url.pathname.split('/').filter(Boolean)
    
    // Get user from Authorization header
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Set up the supabase client with user auth
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    })

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route handling
    const method = req.method
    const agentId = url.searchParams.get('agent_id')
    const taskId = segments[segments.length - 1] // Last segment might be task ID

    switch (method) {
      case 'GET':
        return await handleGet(supabaseClient, user.id, agentId, taskId, url.searchParams)
      
      case 'POST':
        const postBody = await req.json()
        return await handlePost(supabaseClient, user.id, postBody)
      
      case 'PUT':
        const putBody = await req.json()
        return await handlePut(supabaseClient, user.id, taskId, putBody)
      
      case 'DELETE':
        return await handleDelete(supabaseClient, user.id, taskId)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error in agent-tasks function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleGet(supabase: any, userId: string, agentId: string | null, taskId: string | null, params: URLSearchParams) {
  if (taskId && taskId !== 'agent-tasks') {
    // Get specific task
    const { data: task, error } = await supabase
      .from('agent_tasks')
      .select(`
        *,
        agent_task_executions (
          id,
          status,
          trigger_type,
          started_at,
          completed_at,
          duration_ms,
          output,
          error_message,
          created_at
        )
      `)
      .eq('id', taskId)
      .eq('user_id', userId)
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch task', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ task }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get tasks for agent or all tasks for user
  let query = supabase
    .from('agent_tasks')
    .select(`
      *,
      agents!inner (
        id,
        name
      )
    `)
    .eq('user_id', userId)

  if (agentId) {
    query = query.eq('agent_id', agentId)
  }

  // Add filters based on query parameters
  const status = params.get('status')
  if (status) {
    query = query.eq('status', status)
  }

  const taskType = params.get('task_type')
  if (taskType) {
    query = query.eq('task_type', taskType)
  }

  // Ordering
  const orderBy = params.get('order_by') || 'created_at'
  const orderDirection = params.get('order_direction') || 'desc'
  query = query.order(orderBy, { ascending: orderDirection === 'asc' })

  // Pagination
  const page = parseInt(params.get('page') || '1')
  const limit = parseInt(params.get('limit') || '50')
  const offset = (page - 1) * limit

  query = query.range(offset, offset + limit - 1)

  const { data: tasks, error } = await query

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch tasks', details: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ tasks, page, limit }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handlePost(supabase: any, userId: string, body: any) {
  // Validate required fields
  const requiredFields = ['agent_id', 'name', 'instructions', 'task_type']
  for (const field of requiredFields) {
    if (!body[field]) {
      return new Response(
        JSON.stringify({ error: `Missing required field: ${field}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Verify user owns the agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', body.agent_id)
    .eq('user_id', userId)
    .single()

  if (agentError || !agent) {
    return new Response(
      JSON.stringify({ error: 'Agent not found or access denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate task type specific requirements
  if (body.task_type === 'scheduled' && !body.cron_expression) {
    return new Response(
      JSON.stringify({ error: 'Cron expression is required for scheduled tasks' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (body.task_type === 'event_based' && !body.event_trigger_type) {
    return new Response(
      JSON.stringify({ error: 'Event trigger type is required for event-based tasks' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Calculate next run time for scheduled tasks
  let nextRunAt = null
  if (body.task_type === 'scheduled' && body.cron_expression) {
    nextRunAt = calculateNextRunTime(body.cron_expression, body.timezone || 'UTC')
  }

  // Create the task
  const taskData = {
    agent_id: body.agent_id,
    user_id: userId,
    name: body.name,
    description: body.description || null,
    task_type: body.task_type,
    status: body.status || 'active',
    instructions: body.instructions,
    selected_tools: body.selected_tools || [],
    cron_expression: body.cron_expression || null,
    timezone: body.timezone || 'UTC',
    next_run_at: nextRunAt,
    event_trigger_type: body.event_trigger_type || null,
    event_trigger_config: body.event_trigger_config || {},
    max_executions: body.max_executions || null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    created_by: userId
  }

  const { data: task, error } = await supabase
    .from('agent_tasks')
    .insert(taskData)
    .select()
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to create task', details: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ task }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handlePut(supabase: any, userId: string, taskId: string, body: any) {
  if (!taskId) {
    return new Response(
      JSON.stringify({ error: 'Task ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify user owns the task
  const { data: existingTask, error: taskError } = await supabase
    .from('agent_tasks')
    .select('id, agent_id, task_type, cron_expression')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (taskError || !existingTask) {
    return new Response(
      JSON.stringify({ error: 'Task not found or access denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate task type specific requirements if changing
  const newTaskType = body.task_type || existingTask.task_type
  if (newTaskType === 'scheduled') {
    const cronExpression = body.cron_expression || existingTask.cron_expression
    if (!cronExpression) {
      return new Response(
        JSON.stringify({ error: 'Cron expression is required for scheduled tasks' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  if (newTaskType === 'event_based' && !body.event_trigger_type) {
    return new Response(
      JSON.stringify({ error: 'Event trigger type is required for event-based tasks' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Calculate next run time if cron expression changed
  let updateData = { ...body }
  if (body.cron_expression && body.cron_expression !== existingTask.cron_expression) {
    updateData.next_run_at = calculateNextRunTime(body.cron_expression, body.timezone || existingTask.timezone || 'UTC')
  }

  const { data: task, error } = await supabase
    .from('agent_tasks')
    .update(updateData)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to update task', details: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ task }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleDelete(supabase: any, userId: string, taskId: string) {
  if (!taskId) {
    return new Response(
      JSON.stringify({ error: 'Task ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { error } = await supabase
    .from('agent_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to delete task', details: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ message: 'Task deleted successfully' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
} 