// Contact MCP Tools Edge Function
// Purpose: Provide MCP tool endpoints for agent contact access
// Dependencies: contact database functions and tables
// File: supabase/functions/contact-mcp-tools/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types for MCP tool responses
interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    tool_name: string;
    agent_id?: string;
    user_id?: string;
  };
}

interface SearchContactsParams {
  agent_id: string;
  user_id: string;
  query?: string;
  contact_type?: string;
  group_id?: string;
  channel_type?: string;
  tags?: string[];
  phone_pattern?: string;
  email_pattern?: string;
  organization_filter?: string;
  job_title_filter?: string;
  limit?: number;
  offset?: number;
}

interface GetContactDetailsParams {
  agent_id: string;
  user_id: string;
  contact_id: string;
}

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Enhanced query parser for natural language contact searches
function parseContactQuery(query: string): {
  parsedQuery: string;
  phonePattern?: string;
  emailPattern?: string;
  contactType?: string;
  organizationFilter?: string;
  jobTitleFilter?: string;
  channelType?: string;
  specialInstructions?: string[];
} {
  if (!query) return { parsedQuery: '' };
  
  const lowerQuery = query.toLowerCase().trim();
  const result: any = {
    parsedQuery: query,
    specialInstructions: []
  };

  // Handle "list all contacts" type requests
  if (lowerQuery.includes('list all contacts') || 
      lowerQuery.includes('show all contacts') ||
      lowerQuery.includes('all contacts') ||
      lowerQuery === 'list contacts' ||
      lowerQuery === 'show contacts' ||
      lowerQuery === '*' ||
      lowerQuery === '' ||
      lowerQuery === 'all') {
    result.parsedQuery = '';
    result.specialInstructions.push('list_all');
    return result;
  }

  // Phone number pattern matching
  const phonePatterns = [
    /(?:phone|number|tel).*?(?:starts? with|beginning with|starting)\s*([0-9]{3})/i,
    /(?:starts? with|beginning with|starting)\s*([0-9]{3}).*?(?:phone|number|tel)/i,
    /([0-9]{3})\s*(?:area code|prefix)/i,
    /phone.*?([0-9]{3})/i,
    /number.*?([0-9]{3})/i
  ];
  
  for (const pattern of phonePatterns) {
    const match = query.match(pattern);
    if (match) {
      result.phonePattern = match[1];
      result.specialInstructions.push('phone_search');
      // Remove the phone pattern from the main query
      result.parsedQuery = query.replace(pattern, '').trim();
      break;
    }
  }

  // Email pattern matching
  const emailPatterns = [
    /email.*?(?:contains|includes|has)\s*([a-zA-Z0-9@.-]+)/i,
    /(?:contains|includes|has).*?email.*?([a-zA-Z0-9@.-]+)/i,
    /@([a-zA-Z0-9.-]+)/i
  ];
  
  for (const pattern of emailPatterns) {
    const match = query.match(pattern);
    if (match) {
      result.emailPattern = match[1];
      result.specialInstructions.push('email_search');
      result.parsedQuery = query.replace(pattern, '').trim();
      break;
    }
  }

  // Contact type detection
  const contactTypeMap: { [key: string]: string } = {
    'internal': 'internal',
    'employee': 'internal',
    'staff': 'internal',
    'team member': 'internal',
    'external': 'external',
    'client': 'customer',
    'customer': 'customer',
    'vendor': 'vendor',
    'supplier': 'vendor',
    'partner': 'partner',
    'prospect': 'prospect',
    'lead': 'prospect'
  };

  for (const [keyword, type] of Object.entries(contactTypeMap)) {
    if (lowerQuery.includes(keyword)) {
      result.contactType = type;
      result.specialInstructions.push('type_filter');
      break;
    }
  }

  // Organization detection
  const orgPatterns = [
    /(?:at|from|works at|employed by)\s+([a-zA-Z0-9\s&.-]+?)(?:\s|$|,)/i,
    /company.*?([a-zA-Z0-9\s&.-]+?)(?:\s|$|,)/i,
    /organization.*?([a-zA-Z0-9\s&.-]+?)(?:\s|$|,)/i
  ];

  for (const pattern of orgPatterns) {
    const match = query.match(pattern);
    if (match && match[1].trim().length > 2) {
      result.organizationFilter = match[1].trim();
      result.specialInstructions.push('organization_filter');
      result.parsedQuery = query.replace(pattern, '').trim();
      break;
    }
  }

  // Job title detection
  const jobPatterns = [
    /(?:title|role|position|job).*?([a-zA-Z\s]+?)(?:\s|$|,)/i,
    /(manager|director|ceo|cto|developer|engineer|analyst|coordinator|specialist)/i
  ];

  for (const pattern of jobPatterns) {
    const match = query.match(pattern);
    if (match && match[1].trim().length > 2) {
      result.jobTitleFilter = match[1].trim();
      result.specialInstructions.push('job_title_filter');
      result.parsedQuery = query.replace(pattern, '').trim();
      break;
    }
  }

  // Channel type detection
  const channelMap: { [key: string]: string } = {
    'phone': 'phone',
    'mobile': 'mobile',
    'email': 'email',
    'whatsapp': 'whatsapp',
    'telegram': 'telegram',
    'slack': 'slack',
    'discord': 'discord',
    'sms': 'sms'
  };

  for (const [keyword, channel] of Object.entries(channelMap)) {
    if (lowerQuery.includes(`with ${keyword}`) || 
        lowerQuery.includes(`have ${keyword}`) ||
        lowerQuery.includes(`has ${keyword}`)) {
      result.channelType = channel;
      result.specialInstructions.push('channel_filter');
      break;
    }
  }

  // Clean up the parsed query
  result.parsedQuery = result.parsedQuery
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

  return result;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
      },
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for POST requests
    let body: any = {};
    if (method === 'POST') {
      try {
        body = await req.json();
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Route based on action in request body (for edge function invocation)
    let response: MCPToolResponse;
    const action = body.action;
    
    console.log(`[Contact MCP Tools] Processing action: ${action}, method: ${method}`);
    
    if (method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed - only POST requests supported' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'search_contacts':
        response = await handleSearchContacts(supabase, body as SearchContactsParams);
        break;

      case 'get_contact_details':
        response = await handleGetContactDetails(supabase, body as GetContactDetailsParams);
        break;

      case 'list_tools':
        response = await handleListTools();
        break;

      default:
        console.error(`[Contact MCP Tools] Unknown action: ${action}`);
        return new Response(
          JSON.stringify({ 
            error: `Unknown action: ${action}. Supported actions: search_contacts, get_contact_details, list_tools` 
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify(response), {
      status: response.success ? 200 : 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error: any) {
    console.error('[Contact MCP Tools] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        metadata: {
          execution_time_ms: 0,
          tool_name: 'unknown',
        },
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  }
});

// Handler for search_contacts MCP tool
async function handleSearchContacts(
  supabase: any,
  params: SearchContactsParams
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const {
      agent_id,
      user_id,
      query,
      contact_type,
      group_id,
      channel_type,
      tags,
      phone_pattern,
      email_pattern,
      organization_filter,
      job_title_filter,
      limit = 20,
      offset = 0
    } = params;

    // Validate required parameters
    if (!agent_id || !user_id) {
      throw new Error('Missing required parameters: agent_id and user_id are required');
    }

    console.log(`[Contact MCP Tools] Searching contacts for agent ${agent_id}, user ${user_id}, query: "${query}"`);
    console.log(`[Contact MCP Tools] Raw parameters:`, { agent_id, user_id, query, contact_type, channel_type });

    // Parse the query for intelligent parameter extraction
    let parsedParams = {
      query: query || '',
      contact_type: contact_type,
      channel_type: channel_type,
      organization_filter: organization_filter,
      job_title_filter: job_title_filter,
      phone_pattern: phone_pattern,
      email_pattern: email_pattern
    };

    // If we have a natural language query, parse it
    if (query && !contact_type && !channel_type && !phone_pattern && !email_pattern) {
      const parsed = parseContactQuery(query);
      console.log(`[Contact MCP Tools] Parsed query:`, parsed);
      
      parsedParams = {
        query: parsed.parsedQuery,
        contact_type: parsed.contactType || contact_type,
        channel_type: parsed.channelType || channel_type,
        organization_filter: parsed.organizationFilter || organization_filter,
        job_title_filter: parsed.jobTitleFilter || job_title_filter,
        phone_pattern: parsed.phonePattern || phone_pattern,
        email_pattern: parsed.emailPattern || email_pattern
      };
    }

    // Call the enhanced database function
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_contacts_for_agent_enhanced', {
        p_agent_id: agent_id,
        p_user_id: user_id,
        p_query: parsedParams.query,
        p_contact_type: parsedParams.contact_type,
        p_group_id: group_id,
        p_channel_type: parsedParams.channel_type,
        p_organization_filter: parsedParams.organization_filter,
        p_job_title_filter: parsedParams.job_title_filter,
        p_phone_pattern: parsedParams.phone_pattern,
        p_email_pattern: parsedParams.email_pattern,
        p_tags: tags,
        p_limit: limit,
        p_offset: offset
      });

    if (searchError) {
      console.error('[Contact MCP Tools] Search error:', searchError);
      throw new Error(`Contact search failed: ${searchError.message}`);
    }

    console.log(`[Contact MCP Tools] Database returned ${searchResults?.length || 0} results`);
    if (searchResults && searchResults.length > 0) {
      console.log(`[Contact MCP Tools] First result:`, searchResults[0]);
    }

    // Format results for MCP tool response
    const formattedResults = (searchResults || []).map((contact: any) => ({
      id: contact.contact_id,
      name: contact.display_name,
      first_name: contact.first_name,
      last_name: contact.last_name,
      organization: contact.organization,
      job_title: contact.job_title,
      contact_type: contact.contact_type,
      contact_status: contact.contact_status,
      primary_email: contact.primary_email,
      primary_phone: contact.primary_phone,
      tags: contact.tags || [],
      last_contacted: contact.last_contacted_at,
      created_at: contact.created_at,
      interaction_count: contact.interaction_count || 0,
      has_requested_channel: contact.has_channel
    }));

    // Create summary for the agent
    const resultCount = formattedResults.length;
    const totalWithChannel = formattedResults.filter(c => c.has_requested_channel).length;
    
    let searchSummary = `Found ${resultCount} contact${resultCount !== 1 ? 's' : ''}`;
    if (query) {
      searchSummary += ` matching "${query}"`;
    }
    if (contact_type) {
      searchSummary += ` of type "${contact_type}"`;
    }
    if (channel_type) {
      searchSummary += ` with ${channel_type} (${totalWithChannel} have this channel)`;
    }
    
    if (resultCount === 0) {
      searchSummary += '. You may need to adjust your search criteria or the user may need to add more contacts.';
    } else {
      searchSummary += '. Use get_contact_details with a contact ID to get detailed information about a specific contact.';
    }

    const response = {
      success: true,
      data: {
        contacts: formattedResults,
        summary: searchSummary,
        search_params: {
          query,
          contact_type,
          channel_type,
          tags,
          limit,
          offset
        },
        pagination: {
          total_results: resultCount,
          limit,
          offset,
          has_more: resultCount === limit // Assume more if we got exactly the limit
        }
      },
      metadata: {
        execution_time_ms: Date.now() - startTime,
        tool_name: 'search_contacts',
        agent_id,
        user_id
      }
    };

    console.log(`[Contact MCP Tools] Returning response with ${formattedResults.length} contacts`);
    console.log(`[Contact MCP Tools] Summary: ${searchSummary}`);
    
    return response;

  } catch (error: any) {
    console.error('[Contact MCP Tools] Search contacts error:', error);
    
    // Build intelligent error response with guidance
    const errorMessage = error.message || 'Failed to search contacts';
    let enhancedError = errorMessage;
    let suggestions: string[] = [];
    
    // Provide specific guidance based on error type
    let shouldRetry = false;
    
    if (errorMessage.includes('agent_id') || errorMessage.includes('user_id')) {
      enhancedError = `Missing required parameters: agent_id and user_id are required for contact search.`;
      suggestions = [
        'Ensure agent_id is included in the request',
        'Ensure user_id is included in the request',
        'These parameters are automatically provided - this should not happen in normal operation'
      ];
      shouldRetry = true; // Retry - LLM might be able to fix parameter issues
    } else if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      enhancedError = `Permission denied: ${errorMessage}`;
      suggestions = [
        'Check that the agent has permission to access contacts',
        'Verify the user has appropriate role and permissions',
        'Contact management permissions may need to be enabled for this agent'
      ];
      shouldRetry = false; // Don't retry - permission issues need human intervention
    } else if (errorMessage.includes('function') || errorMessage.includes('database')) {
      enhancedError = `Database error: ${errorMessage}`;
      suggestions = [
        'The contact search function may not be properly configured',
        'Database connection or schema issue detected',
        'Contact system administrator'
      ];
      shouldRetry = false; // Don't retry - database issues need system fixes
    } else {
      // Unknown error - let LLM try to fix it
      shouldRetry = true;
    }
    
    return {
      success: false,
      error: enhancedError,
      requires_retry: shouldRetry,
      guidance: {
        suggestions,
        example_parameters: {
          query: 'John Doe',
          contact_type: 'customer',
          channel_type: 'email',
          limit: 20
        },
        available_filters: {
          query: 'Text search across name, organization, notes',
          contact_type: ['internal', 'external', 'customer', 'vendor', 'partner', 'prospect'],
          channel_type: ['phone', 'mobile', 'email', 'whatsapp', 'telegram', 'slack', 'discord', 'sms'],
          phone_pattern: 'Search phone numbers (e.g., "661" for numbers starting with 661)',
          email_pattern: 'Search emails by pattern or domain',
          organization_filter: 'Filter by company name',
          job_title_filter: 'Filter by job title or role'
        }
      },
      metadata: {
        execution_time_ms: Date.now() - startTime,
        tool_name: 'search_contacts',
        agent_id: params.agent_id,
        user_id: params.user_id,
        error_type: 'validation_error'
      }
    };
  }
}

// Handler for get_contact_details MCP tool
async function handleGetContactDetails(
  supabase: any,
  params: GetContactDetailsParams
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { agent_id, user_id, contact_id } = params;

    // Validate required parameters
    if (!agent_id || !user_id || !contact_id) {
      throw new Error('Missing required parameters: agent_id, user_id, and contact_id are required');
    }

    console.log(`[Contact MCP Tools] Getting contact details for ${contact_id}, agent: ${agent_id}`);

    // Call the database function
    const { data: contactDetails, error: detailsError } = await supabase
      .rpc('get_contact_details_for_agent', {
        p_agent_id: agent_id,
        p_user_id: user_id,
        p_contact_id: contact_id
      });

    if (detailsError) {
      console.error('[Contact MCP Tools] Get contact details error:', detailsError);
      throw new Error(`Failed to get contact details: ${detailsError.message}`);
    }

    if (!contactDetails || contactDetails.length === 0) {
      throw new Error('Contact not found or access denied');
    }

    const contact = contactDetails[0];

    // Format the response
    const formattedContact = {
      id: contact.contact_id,
      personal_info: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        display_name: contact.display_name,
        organization: contact.organization,
        job_title: contact.job_title,
        department: contact.department
      },
      contact_details: {
        contact_type: contact.contact_type,
        contact_status: contact.contact_status,
        tags: contact.tags || [],
        notes: contact.notes,
        custom_fields: contact.custom_fields || {}
      },
      communication_channels: contact.communication_channels || [],
      recent_interactions: contact.recent_interactions || [],
      groups: contact.groups || [],
      timestamps: {
        created_at: contact.created_at,
        updated_at: contact.updated_at,
        last_contacted_at: contact.last_contacted_at
      }
    };

    // Create summary
    const channelCount = formattedContact.communication_channels.length;
    const interactionCount = formattedContact.recent_interactions.length;
    const groupCount = formattedContact.groups.length;

    const summary = `Contact: ${contact.display_name}${contact.organization ? ` at ${contact.organization}` : ''}. ` +
      `${channelCount} communication channel${channelCount !== 1 ? 's' : ''}, ` +
      `${interactionCount} recent interaction${interactionCount !== 1 ? 's' : ''}, ` +
      `member of ${groupCount} group${groupCount !== 1 ? 's' : ''}.`;

    return {
      success: true,
      data: {
        contact: formattedContact,
        summary
      },
      metadata: {
        execution_time_ms: Date.now() - startTime,
        tool_name: 'get_contact_details',
        agent_id,
        user_id
      }
    };

  } catch (error: any) {
    console.error('[Contact MCP Tools] Get contact details error:', error);
    
    return {
      success: false,
      error: error.message || 'Failed to get contact details',
      metadata: {
        execution_time_ms: Date.now() - startTime,
        tool_name: 'get_contact_details',
        agent_id: params.agent_id,
        user_id: params.user_id
      }
    };
  }
}

// Handler for listing available tools
async function handleListTools(): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  const tools = [
    {
      name: 'search_contacts',
      description: 'Search and filter contacts based on various criteria',
      parameters: {
        agent_id: { type: 'string', required: true, description: 'ID of the agent making the request' },
        user_id: { type: 'string', required: true, description: 'ID of the user who owns the contacts' },
        query: { type: 'string', required: false, description: 'Search query for name, organization, or job title' },
        contact_type: { type: 'string', required: false, description: 'Filter by contact type (internal, external, partner, vendor, customer, prospect)' },
        group_id: { type: 'string', required: false, description: 'Filter by contact group membership' },
        channel_type: { type: 'string', required: false, description: 'Filter contacts that have a specific communication channel' },
        tags: { type: 'array', required: false, description: 'Filter by contact tags' },
        limit: { type: 'number', required: false, description: 'Maximum number of results to return (default: 20)' },
        offset: { type: 'number', required: false, description: 'Number of results to skip for pagination (default: 0)' }
      },
      returns: {
        contacts: 'Array of contact objects with basic information',
        summary: 'Human-readable summary of search results',
        pagination: 'Pagination information for large result sets'
      }
    },
    {
      name: 'get_contact_details',
      description: 'Get detailed information about a specific contact',
      parameters: {
        agent_id: { type: 'string', required: true, description: 'ID of the agent making the request' },
        user_id: { type: 'string', required: true, description: 'ID of the user who owns the contact' },
        contact_id: { type: 'string', required: true, description: 'ID of the contact to retrieve details for' }
      },
      returns: {
        contact: 'Detailed contact information including all communication channels and recent interactions',
        summary: 'Human-readable summary of contact information'
      }
    }
  ];

  return {
    success: true,
    data: {
      tools,
      count: tools.length,
      description: 'MCP tools for contact management and search'
    },
    metadata: {
      execution_time_ms: Date.now() - startTime,
      tool_name: 'list_tools'
    }
  };
}
