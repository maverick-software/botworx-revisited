/**
 * Get Agent Tools Edge Function
 * 
 * Returns all authorized MCP tools for an agent based on:
 * - Agent permissions (agent_integration_permissions)  
 * - User credentials (user_integration_credentials)
 * - Integration capabilities (integration_capabilities) - DATABASE DRIVEN
 * 
 * Uses database-driven tool discovery via integration_capabilities table
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
  status: 'active' | 'expired' | 'error';
  error_message?: string;
  provider_name: string;
  connection_name: string;
}

interface AgentToolsResponse {
  success: boolean;
  tools?: ToolDefinition[];
  error?: string;
  metadata?: {
    agent_id: string;
    user_id: string;
    provider_count: number;
    total_tools: number;
    cached: boolean;
  };
}

// Helper function to map agent scopes to integration capabilities
function mapScopeToCapability(scope: string, providerName: string): string[] {
  // Gmail scope mappings
  if (providerName === 'gmail') {
    const gmailMappings: Record<string, string[]> = {
      'email.send': ['send_email'],
      'email.read': ['read_emails', 'search_emails'],
      'email.modify': ['email_actions'],
      'https://www.googleapis.com/auth/gmail.send': ['send_email'],
      'https://www.googleapis.com/auth/gmail.readonly': ['read_emails', 'search_emails'],
      'https://www.googleapis.com/auth/gmail.modify': ['email_actions']
    };
    return gmailMappings[scope] || [scope];
  }
  
  // SMTP scope mappings
  if (providerName === 'smtp') {
    const smtpMappings: Record<string, string[]> = {
      'email.send': ['smtp_send_email'],
      'email.templates': ['smtp_email_templates'],
      'email.stats': ['smtp_email_stats']
    };
    return smtpMappings[scope] || [scope];
  }
  
  // Microsoft OneDrive scope mappings
  if (providerName === 'microsoft-onedrive') {
    const onedriveMappings: Record<string, string[]> = {
      'files.read': ['list_files', 'download_file', 'search_files'],
      'files.write': ['upload_file', 'list_files', 'download_file', 'search_files'],
      'sites.read': ['list_files', 'search_files'],
      'sites.write': ['upload_file', 'list_files', 'download_file', 'search_files'],
      'https://graph.microsoft.com/Files.Read': ['list_files', 'download_file', 'search_files'],
      'https://graph.microsoft.com/Files.ReadWrite': ['upload_file', 'list_files', 'download_file', 'search_files'],
      'https://graph.microsoft.com/Files.Read.All': ['list_files', 'download_file', 'search_files'],
      'https://graph.microsoft.com/Files.ReadWrite.All': ['upload_file', 'list_files', 'download_file', 'search_files', 'share_file'],
      'https://graph.microsoft.com/Sites.Read.All': ['list_files', 'search_files'],
      'https://graph.microsoft.com/Sites.ReadWrite.All': ['upload_file', 'list_files', 'download_file', 'search_files', 'share_file']
    };
    return onedriveMappings[scope] || [scope];
  }
  
  // Default: return the scope as-is
  return [scope];
}

// Helper function to check if agent scope allows a capability
function isScopeAllowed(capability: string, allowedScopes: string[], providerName: string): boolean {
  // Direct match
  if (allowedScopes.includes(capability)) {
    return true;
  }
  
  // Check mapped scopes
  for (const scope of allowedScopes) {
    const mappedCapabilities = mapScopeToCapability(scope, providerName);
    if (mappedCapabilities.includes(capability)) {
      return true;
    }
  }
  
  return false;
}

// Helper function to determine credential status
function getCredentialStatus(credential: any): { status: 'active' | 'expired' | 'error', error_message?: string } {
  // Check if connection status is explicitly set to expired or error
  if (credential.connection_status === 'expired') {
    return {
      status: 'expired',
      error_message: 'OAuth token has expired. Please re-authorize this integration.'
    };
  }
  
  if (credential.connection_status === 'error') {
    return {
      status: 'error',
      error_message: 'Integration connection has an error. Please check your credentials.'
    };
  }
  
  // Check if OAuth token is expired based on timestamp
  if (credential.token_expires_at) {
    const expiresAt = new Date(credential.token_expires_at);
    const now = new Date();
    
    if (expiresAt < now) {
      return {
        status: 'expired',
        error_message: `OAuth token expired on ${expiresAt.toLocaleDateString()}. Please re-authorize this integration.`
      };
    }
  }
  
  // Default to active
  return { status: 'active' };
}

// Generate parameters schema based on capability type (now tool name)
function generateParametersForCapability(toolName: string) {
  const baseSchema = {
    type: 'object' as const,
    properties: {} as Record<string, any>,
    required: [] as string[]
  };

  // Handle email sending tools (smtp_send_email, sendgrid_send_email, mailgun_send_email)
  if (toolName.includes('_send_email')) {
      return {
        ...baseSchema,
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body content' },
          from_name: { type: 'string', description: 'Sender name (optional)' },
          cc: { type: 'string', description: 'CC recipients (optional)' },
          bcc: { type: 'string', description: 'BCC recipients (optional)' }
        },
        required: ['to', 'subject', 'body']
      };
  }

  // Handle email template tools
  if (toolName.includes('_email_templates')) {
    return {
      ...baseSchema,
      properties: {
        template_name: { type: 'string', description: 'Template identifier' },
        to: { type: 'string', description: 'Recipient email' },
        variables: { type: 'object', description: 'Template variables' }
      },
      required: ['template_name', 'to']
    };
  }

  // Handle email stats tools
  if (toolName.includes('_email_stats')) {
    return {
      ...baseSchema,
      properties: {
        date_range: { type: 'string', description: 'Date range for statistics (e.g., "7d", "30d")' },
        metric_type: { type: 'string', description: 'Type of metrics to retrieve' }
      },
      required: []
    };
  }

  // Handle web search tools
  if (toolName.includes('web_search')) {
    return {
      ...baseSchema,
      properties: {
        query: { type: 'string', description: 'Search query' },
        num_results: { type: 'number', description: 'Number of results to return', default: 10 }
      },
      required: ['query']
    };
  }

  // Handle news search tools
  if (toolName.includes('news_search')) {
    return {
      ...baseSchema,
      properties: {
        query: { type: 'string', description: 'News search query' },
        num_results: { type: 'number', description: 'Number of results to return', default: 10 }
      },
      required: ['query']
    };
  }

  // Handle image search tools
  if (toolName.includes('image_search')) {
    return {
      ...baseSchema,
      properties: {
        query: { type: 'string', description: 'Image search query' },
        num_results: { type: 'number', description: 'Number of results to return', default: 10 }
      },
      required: ['query']
    };
  }

  // Handle Gmail-specific capabilities
  if (toolName.includes('gmail') || toolName.includes('https://www.googleapis.com/auth/gmail')) {
    if (toolName.includes('readonly') || toolName.includes('read') || toolName.includes('search')) {
      return {
        ...baseSchema,
        properties: {
          query: { type: 'string', description: 'Search query for emails' },
          max_results: { type: 'number', description: 'Maximum number of emails to return', default: 10 }
        },
        required: ['query']
      };
    }
    
    if (toolName.includes('send')) {
      return {
        ...baseSchema,
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body content' },
          cc: { type: 'string', description: 'CC recipients (optional)' },
          bcc: { type: 'string', description: 'BCC recipients (optional)' }
        },
        required: ['to', 'subject', 'body']
      };
    }
    
    // Default Gmail tool parameters
    return {
      ...baseSchema,
      properties: {
        input: { type: 'string', description: `Gmail tool: ${toolName}` }
      },
      required: []
    };
  }

  // Handle reasoning tools
  if (toolName.startsWith('reasoning_')) {
    if (toolName === 'reasoning_execute_chain') {
      return {
        ...baseSchema,
        properties: {
          query: { type: 'string', description: 'The question or problem to analyze' },
          reasoning_style: { 
            type: 'string', 
            enum: ['inductive', 'deductive', 'abductive', 'analogical', 'causal', 'probabilistic'],
            description: 'Type of reasoning to apply' 
          },
          max_iterations: { type: 'number', description: 'Maximum reasoning iterations (default: 6)', minimum: 1, maximum: 10 },
          confidence_threshold: { type: 'number', description: 'Confidence threshold to stop reasoning (default: 0.85)', minimum: 0.1, maximum: 1.0 }
        },
        required: ['query']
      };
    } else if (toolName.includes('_inductive') || toolName.includes('_deductive') || toolName.includes('_abductive')) {
      return {
        ...baseSchema,
        properties: {
          query: { type: 'string', description: 'The question or problem to analyze' },
          context: { type: 'string', description: 'Additional context for reasoning (optional)' },
          max_steps: { type: 'number', description: 'Maximum reasoning steps (default: 4)', minimum: 1, maximum: 8 }
        },
        required: ['query']
      };
    }
  }

  // Default fallback for any unrecognized tool
  return {
    ...baseSchema,
    properties: {
      input: { type: 'string', description: `Input for ${toolName}` }
    },
    required: []
  };
}

// Database-driven tool discovery - no hardcoded mappings needed

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse request
    const { agent_id, user_id, force_refresh = false } = await req.json();
    
    if (!agent_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: agent_id and user_id' 
        }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    if (force_refresh) {
      console.log(`[GetAgentTools] Force refresh requested for agent ${agent_id}`);
    }

    console.log(`[GetAgentTools] Fetching tools for agent ${agent_id}, user ${user_id}`);

    // Database-driven query: Get agent permissions including expired credentials
    const { data: authorizedTools, error } = await supabase
      .from('agent_integration_permissions')
      .select(`
        allowed_scopes,
        is_active,
        permission_level,
        user_integration_credentials!agent_integration_permissions_user_oauth_connection_id_fkey(
          id,
          connection_name,
          oauth_provider_id,
          credential_type,
          connection_status,
          token_expires_at
        )
      `)
      .eq('agent_id', agent_id)
      .eq('user_integration_credentials.user_id', user_id)
      .eq('is_active', true)
      .in('user_integration_credentials.connection_status', ['active', 'expired'])
      .order('granted_at', { ascending: false });
    
    if (error) {
      console.error('[GetAgentTools] Database error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Database error: ${error.message}` 
        }),
        { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    if (!authorizedTools || authorizedTools.length === 0) {
      console.log(`[GetAgentTools] No authorized tools found for agent ${agent_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          tools: [],
          metadata: {
            agent_id,
            user_id,
            provider_count: 0,
            total_tools: 0,
            cached: false
          }
        }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    // Get unique service provider IDs to fetch their details
    const serviceProviderIds = [...new Set(authorizedTools.map(tool => 
      tool.user_integration_credentials?.oauth_provider_id
    ).filter(Boolean))];
    
    // Fetch service provider details
    const { data: serviceProviders, error: spError } = await supabase
      .from('service_providers')
      .select('id, name, display_name')
      .in('id', serviceProviderIds);
    
    if (spError) {
      console.error('[GetAgentTools] Service providers error:', spError);
    }
    
    // Create a map for quick lookup
    const serviceProviderMap = new Map();
    if (serviceProviders) {
      serviceProviders.forEach((sp: any) => {
        serviceProviderMap.set(sp.id, sp);
      });
    }

    // No longer need separate Email Relay query - using direct provider → integration mapping

    if (!authorizedTools || authorizedTools.length === 0) {
      console.log(`[GetAgentTools] No authorized tools found for agent ${agent_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          tools: [],
          metadata: {
            agent_id,
            user_id,
            provider_count: 0,
            total_tools: 0,
            cached: false
          }
        }),
        { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    // Build tools using database-driven integration capabilities
    const tools: ToolDefinition[] = [];
    const toolNamesSeen = new Set<string>();
    const providersProcessed = new Set<string>();

    for (const permission of authorizedTools) {
      const credential = permission.user_integration_credentials;
      const provider = serviceProviderMap.get(credential?.oauth_provider_id) || {
        name: 'unknown',
        display_name: 'Unknown Provider'
      };
      const allowedScopes = permission.allowed_scopes || [];
      const providerName = provider.name;
      
      // Get credential status (active, expired, error)
      const credentialStatus = getCredentialStatus(credential);

      console.log(`[GetAgentTools] Processing ${provider.display_name} (${providerName}) with ${allowedScopes.length} scopes - Status: ${credentialStatus.status}`);

      // Skip if already processed this provider
      if (providersProcessed.has(providerName)) {
        continue;
      }

      // Direct provider → integration lookup (try required_oauth_provider_id first)
      let { data: integration, error: integrationError } = await supabase
        .from('service_providers')
        .select(`
          id,
          name,
          integration_capabilities(
            capability_key,
            display_label
          )
        `)
        .eq('required_oauth_provider_id', provider.id)
        .maybeSingle();

      // Fallback: try to find integration by name matching (for older integrations)
      if (!integration && !integrationError) {
        console.log(`[GetAgentTools] No integration found via required_oauth_provider_id, trying name matching for ${providerName}`);
        
        // Try direct name match first
        const nameMapping: Record<string, string> = {
          'gmail': 'Gmail',
          'serper_api': 'Serper API',
          'smtp': 'SMTP',
          'sendgrid': 'SendGrid', 
          'mailgun': 'Mailgun'
        };
        
        const integrationName = nameMapping[providerName] || providerName;
        
        const { data: fallbackIntegration, error: fallbackError } = await supabase
          .from('service_providers')
          .select(`
            id,
            name,
            integration_capabilities(
              capability_key,
              display_label
            )
          `)
          .ilike('name', integrationName)
          .maybeSingle();
          
        if (fallbackError) {
          console.warn(`[GetAgentTools] Could not fetch integration for provider ${providerName}:`, fallbackError);
          continue;
        }
        
        integration = fallbackIntegration;
      }

      if (integrationError && !integration) {
        console.warn(`[GetAgentTools] Could not fetch integration for provider ${providerName}:`, integrationError);
        continue;
      }

      if (!integration) {
        console.warn(`[GetAgentTools] No integration found for provider: ${providerName}`);
        continue;
      }

      console.log(`[GetAgentTools] Found integration: ${integration.name} with ${integration.integration_capabilities?.length || 0} capabilities`);
      console.log(`[GetAgentTools] Agent allowed scopes:`, allowedScopes);
      console.log(`[GetAgentTools] Integration capabilities:`, integration.integration_capabilities?.map(c => c.capability_key));

      // Generate tools from integration capabilities (capability_key IS the tool name)
      const capabilities = integration.integration_capabilities || [];
      for (const capability of capabilities) {
        console.log(`[GetAgentTools] Checking capability: ${capability.capability_key} against scopes:`, allowedScopes);
        const isAllowed = isScopeAllowed(capability.capability_key, allowedScopes, providerName);
        console.log(`[GetAgentTools] Capability ${capability.capability_key} allowed: ${isAllowed}`);
        // Check if this capability is allowed by the agent's scopes (with mapping)
        if (isAllowed) {
          const toolName = `${providerName}_${capability.capability_key}`; // Prefix with provider name
          
          // Avoid duplicates
          if (toolNamesSeen.has(toolName)) {
            continue;
          }
          
          // Create enhanced tool definition with status
          const tool: ToolDefinition = {
            name: toolName,
            description: capability.display_label || `${toolName} via ${integration.name}`,
            parameters: generateParametersForCapability(toolName),
            status: credentialStatus.status,
            error_message: credentialStatus.error_message,
            provider_name: provider.name,
            connection_name: credential.connection_name
          };

          tools.push(tool);
          toolNamesSeen.add(toolName);
          console.log(`[GetAgentTools] Added tool: ${toolName} (Status: ${credentialStatus.status})`);
        }
      }

      providersProcessed.add(provider.display_name);
    }

    // =============================================
    // STEP 2: Add Internal Tools (Media Library MCP Tools)
    // =============================================
    
    console.log(`[GetAgentTools] Checking for internal tools (Media Library)...`);
    
    // Check if agent has any assigned media documents
    const { data: assignedMedia, error: mediaError } = await supabase
      .from('agent_media_assignments')
      .select('id')
      .eq('agent_id', agent_id)
      .eq('user_id', user_id)
      .eq('is_active', true)
      .limit(1);
    
    if (!mediaError && assignedMedia && assignedMedia.length > 0) {
      console.log(`[GetAgentTools] Agent has ${assignedMedia.length} assigned documents, adding Media Library MCP tools`);
      
      // Add Media Library MCP tools
      const mediaLibraryTools = [
        {
          name: 'search_documents',
          description: 'Search through your assigned documents using semantic or keyword search. Returns document IDs (UUIDs) that can be used with get_document_content',
          parameters: {
            type: 'object' as const,
            properties: {
              query: { type: 'string', description: 'Search query to find relevant documents' },
              search_type: { type: 'string', enum: ['semantic', 'keyword', 'exact'], description: 'Type of search to perform' },
              category: { type: 'string', description: 'Filter by document category (optional)' },
              limit: { type: 'number', description: 'Maximum number of results to return (default: 10)' }
            },
            required: ['query']
          },
          status: 'active' as const,
          provider_name: 'Media Library',
          connection_name: 'Internal'
        },
        {
          name: 'get_document_content',
          description: 'Retrieve the full content of a specific assigned document',
          parameters: {
            type: 'object' as const,
            properties: {
              document_id: { type: 'string', description: 'UUID of the document to retrieve (use the "id" field from list_assigned_documents, not the title or filename)' },
              include_metadata: { type: 'boolean', description: 'Include document metadata (default: true)' }
            },
            required: ['document_id']
          },
          status: 'active' as const,
          provider_name: 'Media Library',
          connection_name: 'Internal'
        },
        {
          name: 'list_assigned_documents',
          description: 'List all documents assigned to you. Returns document IDs (UUIDs) that can be used with get_document_content',
          parameters: {
            type: 'object' as const,
            properties: {
              category: { type: 'string', description: 'Filter by document category (optional)' },
              assignment_type: { type: 'string', enum: ['training_data', 'reference', 'sop', 'knowledge_base'], description: 'Filter by assignment type (optional)' },
              include_archived: { type: 'boolean', description: 'Include archived documents (default: false)' }
            },
            required: []
          },
          status: 'active' as const,
          provider_name: 'Media Library',
          connection_name: 'Internal'
        },
        {
          name: 'get_document_summary',
          description: 'Get AI-generated summary of a specific document',
          parameters: {
            type: 'object' as const,
            properties: {
              document_id: { type: 'string', description: 'UUID of the document to summarize (use the "id" field from list_assigned_documents, not the title or filename)' },
              summary_type: { type: 'string', enum: ['brief', 'detailed'], description: 'Type of summary (default: brief)' }
            },
            required: ['document_id']
          },
          status: 'active' as const,
          provider_name: 'Media Library',
          connection_name: 'Internal'
        },
        {
          name: 'find_related_documents',
          description: 'Find documents related to a topic or another document. Returns document IDs (UUIDs) that can be used with get_document_content',
          parameters: {
            type: 'object' as const,
            properties: {
              topic: { type: 'string', description: 'Topic or query to find related documents for' },
              reference_document_id: { type: 'string', description: 'UUID of document to find related documents for (use the "id" field from list_assigned_documents, optional)' },
              limit: { type: 'number', description: 'Maximum number of results to return (default: 5)' }
            },
            required: []
          },
          status: 'active' as const,
          provider_name: 'Media Library',
          connection_name: 'Internal'
        }
      ];
      
      // Add media library tools to the main tools array
      tools.push(...mediaLibraryTools);
      providersProcessed.add('Media Library');
      
      console.log(`[GetAgentTools] Added ${mediaLibraryTools.length} Media Library MCP tools`);
    } else {
      console.log(`[GetAgentTools] No assigned documents found, skipping Media Library MCP tools`);
    }

    console.log(`[GetAgentTools] Retrieved ${tools.length} tools from ${providersProcessed.size} providers`);
    console.log(`[GetAgentTools] Providers: ${Array.from(providersProcessed).join(', ')}`);
    console.log(`[GetAgentTools] Tools: ${tools.map(t => t.name).join(', ')}`);

    const response: AgentToolsResponse = {
      success: true,
      tools,
      metadata: {
        agent_id,
        user_id,
        provider_count: providersProcessed.size,
        total_tools: tools.length,
        cached: false
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GetAgentTools] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}` 
      }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    );
  }
});
