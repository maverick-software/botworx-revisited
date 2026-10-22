import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Using Supabase pg_cron for scheduling - no external cron library needed

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
}

// Helper function to schedule task with pg_cron
async function scheduleTaskWithPgCron(supabase: any, taskId: string, cronExpression: string, taskData: any): Promise<boolean> {
  try {
    console.log('Scheduling task with pg_cron:', taskId, cronExpression);
    
    // Strip comments from cron expression for pg_cron (it doesn't support comments)
    let cleanCron = cronExpression;
    if (cronExpression.includes(' # ')) {
      cleanCron = cronExpression.split(' # ')[0].trim();
      console.log('Cleaned cron expression for pg_cron:', cleanCron);
    }
    
    // Create unique job name for this task
    const jobName = `agentopia_task_${taskId.replace(/-/g, '_')}`;
    
    // Create the pg_cron job that will call the task-executor Edge Function
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT cron.schedule(
          '${jobName}',
          '${cleanCron}',
          $$
          SELECT net.http_post(
            url := 'https://${Deno.env.get('SUPABASE_URL')?.replace('https://', '')}/functions/v1/task-executor',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}'
            ),
            body := jsonb_build_object(
              'action', 'execute_task',
              'task_id', '${taskId}',
              'trigger_type', 'scheduled'
            )
          );
          $$
        );
      `
    });

    if (error) {
      console.error('Error scheduling task with pg_cron:', error);
      return false;
    }

    console.log('Task scheduled successfully with pg_cron:', jobName);
    return true;
  } catch (error) {
    console.error('Error in scheduleTaskWithPgCron:', error);
    return false;
  }
}

// Helper function to unschedule task from pg_cron
async function unscheduleTaskFromPgCron(supabase: any, taskId: string): Promise<boolean> {
  try {
    const jobName = `agentopia_task_${taskId.replace(/-/g, '_')}`;
    
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `SELECT cron.unschedule('${jobName}');`
    });

    if (error) {
      console.error('Error unscheduling task from pg_cron:', error);
      return false;
    }

    console.log('Task unscheduled successfully from pg_cron:', jobName);
    return true;
  } catch (error) {
    console.error('Error in unscheduleTaskFromPgCron:', error);
    return false;
  }
}

// Convert timezone-aware cron expression to UTC cron expression
function convertCronToUTC(cronExpression: string, timezone: string = 'UTC'): string {
  try {
    // Preserve comments but work with clean cron for conversion
    let comment = '';
    let actualCron = cronExpression.trim();
    
    if (cronExpression.includes(' # ')) {
      const [cronPart, commentPart] = cronExpression.split(' # ', 2);
      actualCron = cronPart.trim();
      comment = ' # ' + commentPart;
    }
    
    // Parse cron expression: minute hour day month dayOfWeek
    const parts = actualCron.split(' ');
    if (parts.length !== 5) {
      console.error('Invalid cron expression format:', actualCron);
      return cronExpression; // Return original if invalid
    }

    const [minute, hour, day, month, dayOfWeek] = parts;
    
    // Handle minute intervals and other wildcard expressions - no conversion needed
    if (minute.includes('*') || hour.includes('*')) {
      console.log('Cron contains wildcards, no timezone conversion needed:', actualCron);
      return cronExpression; // Return original with comments intact
    }
    
    const cronMinute = parseInt(minute);
    const cronHour = parseInt(hour);

    if (isNaN(cronMinute) || isNaN(cronHour)) {
      console.error('Invalid hour/minute in cron:', cronExpression);
      return cronExpression; // Return original if invalid
    }

    // Get proper timezone offset accounting for DST
    let offsetHours = 0;
    const now = new Date();
    
    // Check if the target timezone is in daylight saving time
    const isDST = (tz: string) => {
      try {
        const jan = new Date(now.getFullYear(), 0, 1);
        const jul = new Date(now.getFullYear(), 6, 1);
        const janOffset = -new Date(jan.toLocaleString('en-US', { timeZone: tz })).getTimezoneOffset();
        const julOffset = -new Date(jul.toLocaleString('en-US', { timeZone: tz })).getTimezoneOffset();
        const currentOffset = -new Date(now.toLocaleString('en-US', { timeZone: tz })).getTimezoneOffset();
        return currentOffset !== Math.min(janOffset, julOffset); // DST if not standard time
      } catch (error) {
        console.error('Error checking DST for timezone:', tz, error);
        return false; // Fallback to standard time
      }
    };
    
    // Use dynamic timezone offset calculation instead of hardcoded values
    try {
      const testDate = new Date();
      const utcTime = new Date(testDate.toLocaleString('en-US', { timeZone: 'UTC' }));
      const localTime = new Date(testDate.toLocaleString('en-US', { timeZone: timezone }));
      const offsetMinutes = (localTime.getTime() - utcTime.getTime()) / (1000 * 60);
      const rawOffsetHours = Math.round(offsetMinutes / 60);
      
      // To convert FROM local time TO UTC, we need to ADD the absolute offset
      // PST is UTC-8, so rawOffsetHours will be -8, but we need +8 to convert 9AM PST to 5PM UTC
      offsetHours = Math.abs(rawOffsetHours);
      console.log(`Dynamic timezone offset for ${timezone}: raw=${rawOffsetHours}, using=${offsetHours} hours`);
    } catch (error) {
      console.error('Error calculating dynamic timezone offset, using fallback:', error);
      // Fallback for common timezones if dynamic calculation fails
      switch (timezone) {
        case 'America/Los_Angeles':
        case 'America/Vancouver':
          offsetHours = isDST(timezone) ? 7 : 8; // PDT: UTC-7, PST: UTC-8
          break;
        case 'America/Denver':
          offsetHours = isDST(timezone) ? 6 : 7; // MDT: UTC-6, MST: UTC-7
          break;
        case 'America/Phoenix':
          offsetHours = 7; // MST: UTC-7, no DST
          break;
        case 'America/Chicago':
          offsetHours = isDST(timezone) ? 5 : 6; // CDT: UTC-5, CST: UTC-6
          break;
        case 'America/New_York':
          offsetHours = isDST(timezone) ? 4 : 5; // EDT: UTC-4, EST: UTC-5
          break;
        case 'UTC':
        default:
          offsetHours = 0;
          break;
      }
    }
    
    console.log(`Timezone ${timezone} offset: ${offsetHours} hours (DST: ${isDST()})`);

    // Convert to UTC time
    let utcHour = Math.floor(cronHour + offsetHours); // Add offset to convert FROM local TO UTC
    let utcDay = day;

    // Handle day rollover
    if (utcHour >= 24) {
      utcHour -= 24;
      // Note: This is simplified - doesn't handle month/year rollover
      if (day === '*') {
        utcDay = '*'; // Daily tasks stay daily
      }
    } else if (utcHour < 0) {
      utcHour += 24;
      // Note: This is simplified - doesn't handle month/year rollover  
      if (day === '*') {
        utcDay = '*'; // Daily tasks stay daily
      }
    }

    const utcCron = `${cronMinute} ${utcHour} ${utcDay} ${month} ${dayOfWeek}`;
    console.log(`Converted cron from ${timezone}: ${cronExpression} → UTC: ${utcCron}`);
    return utcCron;
  } catch (error) {
    console.error('Error converting cron to UTC:', error);
    return cronExpression; // Return original on error
  }
}

// Calculate next run time based on cron expression and timezone
function calculateNextRunTime(cronExpression: string, timezone: string = 'UTC', isOneTime: boolean = false): string | null {
  try {
    console.log('Calculating next run time:', cronExpression, 'timezone:', timezone);
    
    // Extract time from comment if present: "*/4 * * * * # time=17:06"
    let actualCron = cronExpression.trim();
    let userTime = null;
    
    if (cronExpression.includes(' # time=')) {
      const [cronPart, timePart] = cronExpression.split(' # time=');
      actualCron = cronPart.trim();
      userTime = timePart.trim();
      console.log('Extracted user time from cron comment:', userTime);
    } else if (cronExpression.includes(' # ')) {
      // Handle other comment formats by stripping them
      actualCron = cronExpression.split(' # ')[0].trim();
      console.log('Stripped comment from cron:', actualCron, 'from:', cronExpression);
    }
    
    // Parse cron expression: minute hour day month dayOfWeek
    const parts = actualCron.split(' ');
    if (parts.length !== 5) {
      console.error('Invalid cron expression format:', actualCron);
      return null;
    }

    const [minute, hour, day, month, dayOfWeek] = parts;
    
    // Handle minute intervals like */4 * * * *
    if (minute.startsWith('*/') && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      const intervalMinutes = parseInt(minute.substring(2));
      if (!isNaN(intervalMinutes)) {
        console.log(`Minute interval detected: every ${intervalMinutes} minutes`);
        
        if (userTime) {
          // For minute intervals, calculate next run from current time
          const now = new Date();
          const [userHour, userMinute] = userTime.split(':').map(Number);
          
          // Create the user's start time for today
          const startTimeToday = new Date(now);
          startTimeToday.setHours(userHour, userMinute, 0, 0);
          
          if (startTimeToday > now) {
            // Start time hasn't occurred yet today - schedule for start time
            console.log('Next run for minute interval (first run today):', startTimeToday.toISOString());
            return startTimeToday.toISOString();
          } else {
            // Start time has passed - calculate next interval from now
            const minutesSinceStart = Math.floor((now.getTime() - startTimeToday.getTime()) / (60 * 1000));
            const intervalsElapsed = Math.floor(minutesSinceStart / intervalMinutes);
            const nextInterval = (intervalsElapsed + 1) * intervalMinutes;
            
            const nextRun = new Date(startTimeToday.getTime() + (nextInterval * 60 * 1000));
            console.log(`Next run for minute interval (${intervalsElapsed + 1} intervals from start):`, nextRun.toISOString());
            return nextRun.toISOString();
          }
        } else {
          // Fallback: calculate next run based on current time + interval
          const now = new Date();
          const nextRun = new Date(now.getTime() + (intervalMinutes * 60 * 1000));
          console.log('Next run for minute interval (fallback):', nextRun.toISOString());
          return nextRun.toISOString();
        }
      }
    }
    
    // Handle regular time-based cron expressions
    const cronMinute = parseInt(minute);
    const cronHour = parseInt(hour);

    if (isNaN(cronMinute) || isNaN(cronHour)) {
      console.error('Invalid hour/minute in cron:', cronExpression);
      return null;
    }

    // Get current time in the specified timezone
    const now = new Date();
    
    // Get proper timezone offset accounting for DST
    let offsetHours = 0;
    try {
      // Use Intl.DateTimeFormat to get the actual current offset for the timezone
      const testDate = new Date();
      const utcTime = testDate.getTime();
      const localTime = new Date(testDate.toLocaleString('en-US', { timeZone: timezone })).getTime();
      offsetHours = (localTime - utcTime) / (1000 * 60 * 60);
      console.log(`Calculated timezone offset for ${timezone}: ${offsetHours} hours`);
    } catch (error) {
      console.error('Error calculating timezone offset, using fallback:', error);
      // Fallback to hardcoded values (without DST)
      switch (timezone) {
        case 'America/Los_Angeles':
        case 'America/Vancouver':
          offsetHours = -8; // PST fallback
          break;
        case 'America/Denver':
        case 'America/Phoenix':
          offsetHours = -7; // MST fallback
          break;
        case 'America/Chicago':
          offsetHours = -6; // CST fallback
          break;
        case 'America/New_York':
          offsetHours = -5; // EST fallback
          break;
        case 'UTC':
        default:
          offsetHours = 0;
          break;
      }
    }

    // Calculate next run time
    const localNow = new Date(now.getTime() + (offsetHours * 60 * 60 * 1000));
    const nextRun = new Date(localNow);
    
    // Set the target time
    nextRun.setHours(cronHour, cronMinute, 0, 0);
    
    // If the time has already passed today
    if (nextRun <= localNow) {
      if (isOneTime) {
        // For one-time tasks, if the time has passed, return null (will be marked as overdue)
        return null;
      } else {
        // For recurring tasks, schedule for tomorrow
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }
    
    // Convert back to UTC for storage
    const utcNextRun = new Date(nextRun.getTime() - (offsetHours * 60 * 60 * 1000));
    
    console.log('Next run calculated:', utcNextRun.toISOString());
    return utcNextRun.toISOString();
  } catch (error) {
    console.error('Error calculating next run time:', error);
    // Fallback: 1 hour from now
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 1);
    return fallback.toISOString();
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
        let postBody;
        try {
          const bodyText = await req.text();
          console.log('Request body text:', bodyText);
          
          if (!bodyText || bodyText.trim() === '') {
            return new Response(
              JSON.stringify({ error: 'Empty request body - no data provided' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          postBody = JSON.parse(bodyText);
          console.log('Parsed POST body:', postBody);
        } catch (parseError) {
          console.error('Error parsing request body:', parseError);
          return new Response(
            JSON.stringify({ error: 'Invalid JSON in request body', details: parseError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return await handlePost(supabaseClient, user.id, postBody)
      
      case 'PUT':
        const putBody = await req.json()
        return await handlePut(supabaseClient, user.id, taskId, putBody)
      
      case 'DELETE':
        let deleteTaskId = taskId;
        // If taskId is not in URL, check request body
        if (!deleteTaskId || deleteTaskId === 'agent-tasks') {
          try {
            const deleteBody = await req.json();
            deleteTaskId = deleteBody.task_id;
          } catch (e) {
            // If body parsing fails, continue with URL taskId
          }
        }
        return await handleDelete(supabaseClient, user.id, deleteTaskId)
      
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
  // Check if this is an update action
  if (body.action === 'update' && body.task_id) {
    return await handleTaskUpdate(supabase, userId, body.task_id, body)
  }
  
  // Validate required fields for creation
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
    const isOneTime = body.max_executions === 1;
    nextRunAt = calculateNextRunTime(body.cron_expression, body.timezone || 'UTC', isOneTime)
  }

  // Handle date range validation - if start_date equals end_date, set end_date to null
  let startDate = body.start_date || null;
  let endDate = body.end_date || null;
  
  // If both dates are the same, treat as single-day task (end_date = null)
  if (startDate && endDate && startDate === endDate) {
    endDate = null;
    console.log('Same start/end date detected, setting end_date to null for single-day task');
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
    event_trigger_type: body.event_trigger_type === '' ? null : (body.event_trigger_type || null),
    event_trigger_config: body.event_trigger_config || {},
    max_executions: body.max_executions || null,
    start_date: startDate,
    end_date: endDate,
    created_by: userId,
    conversation_id: body.target_conversation_id || null
  }

  console.log('About to insert task data:', JSON.stringify(taskData, null, 2));

  const { data: task, error } = await supabase
    .from('agent_tasks')
    .insert(taskData)
    .select()
    .single()

  console.log('Database insert result - error:', error, 'data:', task);

  if (error) {
    console.error('Database insertion failed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create task', details: error.message, code: error.code }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Schedule the task with pg_cron if it's a scheduled task
  if (body.task_type === 'scheduled' && body.cron_expression) {
    // Convert timezone-aware cron to UTC for pg_cron
    const utcCronExpression = convertCronToUTC(body.cron_expression, body.timezone || 'UTC');
    const schedulingSuccess = await scheduleTaskWithPgCron(supabase, task.id, utcCronExpression, taskData);
    if (!schedulingSuccess) {
      console.warn('Task created but scheduling failed for task:', task.id);
      // Don't fail the entire request - task is created, scheduling can be retried
    }
  }

  return new Response(
    JSON.stringify({ 
      task, 
      task_id: task.id,
      is_multi_step: body.is_multi_step || false,
      step_count: body.step_count || 0
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleTaskUpdate(supabase: any, userId: string, taskId: string, body: any) {
  if (!taskId) {
    return new Response(
      JSON.stringify({ error: 'Task ID is required for update action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify user owns the task
  const { data: existingTask, error: taskError } = await supabase
    .from('agent_tasks')
    .select('id, agent_id, task_type, cron_expression, timezone')
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

  // Handle date range validation for updates
  let updateData = { ...body }
  // Remove action and task_id from update data as they're not table columns
  delete updateData.action
  delete updateData.task_id
  delete updateData.is_multi_step
  delete updateData.step_count
  
  // Map frontend field names to database column names
  if (updateData.target_conversation_id !== undefined) {
    updateData.conversation_id = updateData.target_conversation_id
    delete updateData.target_conversation_id
  }
  
  // Fix enum validation - convert empty strings to null
  if (updateData.event_trigger_type === '') {
    updateData.event_trigger_type = null
  }
  
  // Fix date range constraint violation
  if (updateData.start_date && updateData.end_date && updateData.start_date === updateData.end_date) {
    updateData.end_date = null;
    console.log('Same start/end date detected in update, setting end_date to null for single-day task');
  }
  
  if (body.cron_expression && body.cron_expression !== existingTask.cron_expression) {
    const isOneTime = body.max_executions === 1;
    updateData.next_run_at = calculateNextRunTime(body.cron_expression, body.timezone || 'UTC', isOneTime)
  }

  console.log('About to update task with data:', JSON.stringify(updateData, null, 2));
  
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .update(updateData)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single()

  console.log('Database update result - error:', error, 'data:', task);

  if (error) {
    console.error('Database update failed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update task', details: error.message, code: error.code }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Handle scheduling updates if needed
  if (body.cron_expression && body.cron_expression !== existingTask.cron_expression) {
    // Unschedule old task
    await unscheduleTaskFromPgCron(supabase, taskId);
    
    // Schedule new task if it's still scheduled type
    if (newTaskType === 'scheduled') {
      // Convert timezone-aware cron to UTC for pg_cron
      const utcCronExpression = convertCronToUTC(body.cron_expression, body.timezone || existingTask.timezone || 'UTC');
      const schedulingSuccess = await scheduleTaskWithPgCron(supabase, taskId, utcCronExpression, updateData);
      if (!schedulingSuccess) {
        console.warn('Task updated but rescheduling failed for task:', taskId);
      }
    }
  }

  return new Response(
    JSON.stringify({ 
      task, 
      task_id: task.id,
      is_multi_step: body.is_multi_step || false,
      step_count: body.step_count || 0
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    const isOneTime = body.max_executions === 1;
    updateData.next_run_at = calculateNextRunTime(body.cron_expression, body.timezone || existingTask.timezone || 'UTC', isOneTime)
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

  // First, get the task to check if it's scheduled
  const { data: taskToDelete, error: fetchError } = await supabase
    .from('agent_tasks')
    .select('id, task_type')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !taskToDelete) {
    return new Response(
      JSON.stringify({ error: 'Task not found or access denied' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Unschedule from pg_cron if it's a scheduled task
  if (taskToDelete.task_type === 'scheduled') {
    await unscheduleTaskFromPgCron(supabase, taskId);
  }

  // Delete the task
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