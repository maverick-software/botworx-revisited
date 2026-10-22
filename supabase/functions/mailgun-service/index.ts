import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from "../_shared/cors.ts";

interface MailgunRequest {
  action: 'send_email' | 'validate_email' | 'get_stats' | 'manage_suppressions' | 'test_connection';
  agent_id?: string;
  user_id: string;
  parameters?: Record<string, any>;
}

interface MailgunConfig {
  domain: string;
  api_key: string;
  region: string;
  webhook_signing_key?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { action, agent_id, user_id, parameters = {} }: MailgunRequest = await req.json();
    
    console.log(`[Mailgun] Processing ${action} for user ${user_id}, agent ${agent_id}`);
    
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Route to appropriate handler
    let result;
    switch (action) {
      case 'test_connection':
        // Simple test to verify configuration exists
        const testConfig = await getMailgunConfig(supabase, user_id);
        result = {
          success: !!testConfig,
          message: testConfig ? 'Mailgun configuration found' : 'No Mailgun configuration found'
        };
        break;
        
      case 'send_email':
        const config = await getMailgunConfig(supabase, user_id);
        if (!config) {
          throw new Error('Mailgun not configured for this user');
        }
        result = await handleSendEmail(config, parameters, agent_id, user_id, supabase);
        break;
        
      case 'validate_email':
        const validateConfig = await getMailgunConfig(supabase, user_id);
        if (!validateConfig) {
          throw new Error('Mailgun not configured for this user');
        }
        result = await handleValidateEmail(validateConfig, parameters);
        break;
        
      case 'get_stats':
        const statsConfig = await getMailgunConfig(supabase, user_id);
        if (!statsConfig) {
          throw new Error('Mailgun not configured for this user');
        }
        result = await handleGetStats(statsConfig, parameters);
        break;
        
      case 'manage_suppressions':
        const suppressConfig = await getMailgunConfig(supabase, user_id);
        if (!suppressConfig) {
          throw new Error('Mailgun not configured for this user');
        }
        result = await handleManageSuppressions(suppressConfig, parameters);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[Mailgun] Service error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function getMailgunConfig(supabase: any, userId: string): Promise<MailgunConfig | null> {
  try {
    // Get user's Mailgun configuration
    const { data: config, error: configError } = await supabase
      .from('mailgun_configurations')
      .select(`
        domain,
        region,
        user_oauth_connection_id,
        is_active
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('[Mailgun] Failed to get config:', configError);
      return null;
    }

    // Get the OAuth connection to find the API key
    const { data: connection, error: connError } = await supabase
      .from('user_integration_credentials')
      .select(`
        vault_access_token_id,
        connection_status,
        service_providers!inner(name)
      `)
      .eq('id', config.user_oauth_connection_id)
      .eq('service_providers.name', 'mailgun')
      .eq('connection_status', 'connected')
      .single();

    if (connError || !connection) {
      console.error('[Mailgun] Failed to get connection:', connError);
      return null;
    }

    // Get API key from vault
    const { data: apiKey, error: keyError } = await supabase
      .rpc('get_secret', { 
        secret_id: connection.vault_access_token_id 
      });

    if (keyError || !apiKey) {
      console.error('[Mailgun] Failed to get API key:', keyError);
      return null;
    }

    return {
      domain: config.domain,
      api_key: apiKey,
      region: config.region || 'us'
    };
  } catch (error) {
    console.error('[Mailgun] Error getting config:', error);
    return null;
  }
}

async function handleSendEmail(
  config: MailgunConfig, 
  params: any, 
  agentId: string | undefined, 
  userId: string,
  supabase: any
): Promise<any> {
  const apiUrl = `https://api.mailgun.net/v3/${config.domain}/messages`;
  
  // Prepare form data for Mailgun API
  const formData = new FormData();
  formData.append('from', params.from);
  formData.append('to', params.to);
  formData.append('subject', params.subject);
  
  // Add text or HTML body
  if (params.text) formData.append('text', params.text);
  if (params.html) formData.append('html', params.html);
  
  // Add optional parameters
  if (params.cc && Array.isArray(params.cc)) {
    params.cc.forEach((cc: string) => formData.append('cc', cc));
  }
  if (params.bcc && Array.isArray(params.bcc)) {
    params.bcc.forEach((bcc: string) => formData.append('bcc', bcc));
  }
  
  // Template support
  if (params.template) {
    formData.append('template', params.template);
  }
  if (params.template_variables) {
    formData.append('h:X-Mailgun-Variables', JSON.stringify(params.template_variables));
  }
  
  // Scheduled delivery
  if (params.scheduled_time) {
    formData.append('o:deliverytime', params.scheduled_time);
  }
  
  // Tags for tracking
  if (params.tags && Array.isArray(params.tags)) {
    params.tags.forEach((tag: string) => formData.append('o:tag', tag));
  }
  
  // Handle attachments
  if (params.attachments && Array.isArray(params.attachments)) {
    for (const attachment of params.attachments) {
      try {
        // Decode base64 content
        const binaryString = atob(attachment.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: attachment.contentType || 'application/octet-stream' });
        formData.append('attachment', blob, attachment.filename);
      } catch (error) {
        console.error('[Mailgun] Error processing attachment:', error);
      }
    }
  }

  // Send email via Mailgun
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
    },
    body: formData
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Mailgun API error: ${result.message || 'Unknown error'}`);
  }

  // Log email activity
  try {
    await supabase.rpc('log_email_activity', {
      p_mailgun_message_id: result.id,
      p_agent_id: agentId || null,
      p_user_id: userId,
      p_direction: 'outbound',
      p_from_address: params.from,
      p_to_address: params.to,
      p_subject: params.subject,
      p_status: 'sent',
      p_event_data: result
    });
  } catch (logError) {
    console.error('[Mailgun] Failed to log email activity:', logError);
  }

  return {
    success: true,
    message_id: result.id,
    message: result.message
  };
}

async function handleValidateEmail(config: MailgunConfig, params: any): Promise<any> {
  const apiUrl = `https://api.mailgun.net/v4/address/validate`;
  
  const response = await fetch(`${apiUrl}?address=${encodeURIComponent(params.email)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
    }
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Mailgun validation error: ${result.message || 'Unknown error'}`);
  }

  return {
    success: true,
    is_valid: result.is_valid,
    address: result.address,
    did_you_mean: result.did_you_mean,
    is_disposable_address: result.is_disposable_address,
    is_role_address: result.is_role_address,
    reason: result.reason,
    risk: result.risk
  };
}

async function handleGetStats(config: MailgunConfig, params: any): Promise<any> {
  const apiUrl = `https://api.mailgun.net/v3/${config.domain}/stats/total`;
  const queryParams = new URLSearchParams();
  
  if (params.start_date) queryParams.append('start', params.start_date);
  if (params.end_date) queryParams.append('end', params.end_date);
  if (params.resolution) queryParams.append('resolution', params.resolution);
  queryParams.append('event', 'accepted,delivered,failed,opened,clicked,unsubscribed,complained,stored');
  
  const response = await fetch(`${apiUrl}?${queryParams}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
    }
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Mailgun stats error: ${result.message || 'Unknown error'}`);
  }

  return {
    success: true,
    stats: result.stats
  };
}

async function handleManageSuppressions(config: MailgunConfig, params: any): Promise<any> {
  const { action, type, email } = params;
  const apiUrl = `https://api.mailgun.net/v3/${config.domain}/${type}`;
  
  let response;
  switch (action) {
    case 'get':
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
        }
      });
      break;
      
    case 'add':
      if (!email) throw new Error('Email required for add action');
      const addFormData = new FormData();
      addFormData.append('address', email);
      
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
        },
        body: addFormData
      });
      break;
      
    case 'remove':
      if (!email) throw new Error('Email required for remove action');
      response = await fetch(`${apiUrl}/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
        }
      });
      break;
      
    default:
      throw new Error(`Invalid suppression action: ${action}`);
  }

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Mailgun suppression error: ${result.message || 'Unknown error'}`);
  }

  return {
    success: true,
    data: result
  };
}
