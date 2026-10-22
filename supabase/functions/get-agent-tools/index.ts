/**
 * Get Agent Tools Edge Function (Refactored)
 * 
 * Returns all authorized MCP tools for an agent based on:
 * - Agent permissions (agent_integration_permissions)  
 * - User credentials (user_integration_credentials)
 * - Service providers (service_providers) - CURRENT APPROACH
 * 
 * Uses direct scope-to-tool mapping instead of deprecated database-driven discovery
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Import modular components
import { ToolDefinition, AgentToolsResponse } from './types.ts';
import { mapScopeToCapability, isScopeAllowed, normalizeToolName } from './scope-mapper.ts';
import { getCredentialStatus } from './credential-utils.ts';
import { generateParametersForCapability } from './tool-generator.ts';
import { 
  getAgentPermissions, 
  getServiceProviders,
  hasAgentDocuments,
  hasTemporaryChatLinksEnabled,
  hasAdvancedReasoningEnabled,
  getToolSettings,
  supabase
} from './database-service.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get parameters from request body (Edge functions receive params in body)
    const { agent_id, user_id } = await req.json();
    
    if (!agent_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: agent_id and user_id' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[GetAgentTools] Fetching tools for agent ${agent_id}, user ${user_id}`);

    // Get agent permissions with user credentials
    let authorizedTools;
    try {
      authorizedTools = await getAgentPermissions(agent_id, user_id);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Database error: ${error.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique service provider IDs and fetch their details
    const serviceProviderIds = [...new Set(authorizedTools.map(tool => 
      tool.user_integration_credentials?.oauth_provider_id
    ).filter(Boolean))];
    
    let serviceProviders;
    try {
      serviceProviders = await getServiceProviders(serviceProviderIds);
    } catch (error: any) {
      console.error('[GetAgentTools] Service providers error:', error);
      serviceProviders = [];
    }
    
    // Create a map for quick lookup
    const serviceProviderMap = new Map();
    serviceProviders?.forEach(sp => {
      serviceProviderMap.set(sp.id, sp);
    });

    const tools: ToolDefinition[] = [];
    const providersProcessed = new Set<string>();

    // Get all tool settings from agent metadata
    const toolSettings = await getToolSettings(agent_id, user_id);
    console.log(`[GetAgentTools] Tool settings:`, toolSettings);

    // Map provider names to their tool setting keys
    const providerToSettingMap: Record<string, string> = {
      'serper_api': 'web_search_enabled',
      'elevenlabs': 'voice_enabled',
      'internal_system': 'reasoning_enabled',  // For reasoning tools
      // OCR and document creation are checked differently (via scopes/capabilities)
    };

    // Process each authorized tool to generate MCP tools
    for (const toolData of authorizedTools) {
      if (!toolData.user_integration_credentials) {
        console.warn(`[GetAgentTools] Missing user_integration_credentials for tool data`);
        continue;
      }

      const credential = toolData.user_integration_credentials;
      const providerId = credential.oauth_provider_id;
      const provider = serviceProviderMap.get(providerId);
      
      if (!provider) {
        console.warn(`[GetAgentTools] Service provider not found for ID: ${providerId}`);
        continue;
      }

      const providerName = provider.name;
      const allowedScopes = toolData.allowed_scopes || [];

      // Skip if already processed this provider
      if (providersProcessed.has(providerName)) {
        continue;
      }

      // Check if this provider requires a tool setting to be enabled
      const requiredSetting = providerToSettingMap[providerName];
      if (requiredSetting && !toolSettings[requiredSetting]) {
        console.log(`[GetAgentTools] Skipping ${provider.display_name} (${providerName}) - ${requiredSetting} is disabled`);
        continue;
      }

      console.log(`[GetAgentTools] Processing ${provider.display_name} (${providerName}) with ${allowedScopes.length} scopes`);

      // Get credential status
      const credentialStatus = getCredentialStatus(credential);

      // Generate tools directly from scopes using scope mapper
      for (const scope of allowedScopes) {
        const mappedCapabilities = mapScopeToCapability(scope, providerName);
        
        for (const capability of mappedCapabilities) {
          // Create provider-prefixed tool name (e.g., gmail_send_email)
          // But don't double-prefix if capability already has provider prefix
          // Special case for outlook which uses different prefix than provider name
          const providerPrefixedName = (providerName === 'microsoft-outlook' && capability.startsWith('outlook_'))
            ? capability  // Already has outlook_ prefix, use as-is
            : (providerName === 'clicksend_sms' && capability.startsWith('clicksend_'))
              ? capability  // ClickSend capabilities already have clicksend_ prefix
            : (providerName === 'contact_management')
              ? capability  // Contact management tools don't need prefix (search_contacts, get_contact_details)
            : capability.includes('_') && capability.startsWith(providerName.split('-')[0]) 
              ? capability  // Already has provider prefix
              : `${providerName}_${capability}`;  // Add provider prefix
          
          // Normalize tool name to be OpenAI-compatible (removes dots, etc.)
          const normalizedToolName = normalizeToolName(providerPrefixedName);
          
          // Generate tool parameters
          const parameters = generateParametersForCapability(normalizedToolName);
          
          tools.push({
            name: normalizedToolName,
            description: `${capability} - ${provider.display_name}`,
            parameters,
            status: credentialStatus.status,
            error_message: credentialStatus.error_message,
            provider_name: provider.display_name || providerName,
            connection_name: credential.connection_name || 'Default Connection'
          });
        }
      }

      providersProcessed.add(providerName);
    }

    // Check for internal tools (Media Library)
    console.log(`[GetAgentTools] Checking for internal tools (Media Library)...`);
    
    let hasDocuments = false;
    try {
      hasDocuments = await hasAgentDocuments(agent_id, user_id);
    } catch (error) {
      console.warn(`[GetAgentTools] Error checking for agent media assignments:`, error);
    }

    // Only add Media Library tools if agent has documents AND Read Documents is enabled
    if (hasDocuments && !toolSettings['ocr_processing_enabled']) {
      console.log(`[GetAgentTools] Agent has assigned documents but Read Documents is disabled - skipping Media Library tools`);
    }
    
    if (hasDocuments && toolSettings['ocr_processing_enabled']) {
      console.log(`[GetAgentTools] Agent has assigned documents and Read Documents enabled, adding Media Library MCP tools`);
      
      const mediaLibraryTools = [
        'search_documents',
        'get_document_content', 
        'list_assigned_documents',
        'get_document_summary',
        'find_related_documents',
        'reprocess_document'
      ];

      console.log(`[GetAgentTools] Tools: ${mediaLibraryTools.join(', ')}`);
      console.log(`[GetAgentTools] Added ${mediaLibraryTools.length} Media Library MCP tools`);
      console.log(`[GetAgentTools] Providers: Media Library`);

      for (const toolName of mediaLibraryTools) {
        const parameters = generateParametersForCapability(toolName);
        
        tools.push({
          name: toolName,
          description: `${toolName} - Media Library`,
          parameters,
          status: 'active',
          provider_name: 'Media Library',
          connection_name: 'Internal'
        });
      }

      providersProcessed.add('Media Library');
    }

    // Check for internal tools (Temporary Chat Links)
    console.log(`[GetAgentTools] Checking for internal tools (Temporary Chat Links)...`);
    
    let hasTempChatEnabled = false;
    try {
      hasTempChatEnabled = await hasTemporaryChatLinksEnabled(agent_id, user_id);
    } catch (error) {
      console.warn(`[GetAgentTools] Error checking for temporary chat links setting:`, error);
    }

    if (hasTempChatEnabled) {
      console.log(`[GetAgentTools] Agent has temporary chat links enabled, adding Temporary Chat MCP tools`);
      
      const tempChatTools = [
        'create_temporary_chat_link',
        'list_temporary_chat_links',
        'update_temporary_chat_link',
        'delete_temporary_chat_link',
        'get_temporary_chat_analytics',
        'manage_temporary_chat_session'
      ];

      console.log(`[GetAgentTools] Tools: ${tempChatTools.join(', ')}`);
      console.log(`[GetAgentTools] Added ${tempChatTools.length} Temporary Chat MCP tools`);
      console.log(`[GetAgentTools] Providers: Temporary Chat Links`);

      for (const toolName of tempChatTools) {
        const parameters = generateParametersForCapability(toolName);
        
        tools.push({
          name: toolName,
          description: `${toolName} - Temporary Chat Links`,
          parameters,
          status: 'active',
          provider_name: 'Temporary Chat Links',
          connection_name: 'Internal'
        });
      }

      providersProcessed.add('Temporary Chat Links');
    }

    // Check for internal tools (Artifacts - Document Creation)
    console.log(`[GetAgentTools] Checking for internal tools (Artifacts)...`);
    
    // Artifacts are available when Document Creation is enabled
    if (toolSettings['document_creation_enabled']) {
      console.log(`[GetAgentTools] Agent has document creation enabled, adding Artifact MCP tools`);
      
      const artifactTools = [
        'create_artifact',
        'update_artifact',
        'list_artifacts',
        'get_artifact',
        'get_version_history',
        'delete_artifact'
      ];

      console.log(`[GetAgentTools] Tools: ${artifactTools.join(', ')}`);
      console.log(`[GetAgentTools] Added ${artifactTools.length} Artifact MCP tools`);
      console.log(`[GetAgentTools] Providers: Artifacts`);

      for (const toolName of artifactTools) {
        const parameters = generateParametersForCapability(toolName);
        
        tools.push({
          name: toolName,
          description: `${toolName} - Artifacts`,
          parameters,
          status: 'active',
          provider_name: 'Artifacts',
          connection_name: 'Internal'
        });
      }

      providersProcessed.add('Artifacts');
    }

    // Contact Management tools are now handled through the standard integration system
    // They will be processed automatically with other integrations above

    // ============================================
    // CHECK FOR SYSTEM-LEVEL API KEY TOOLS
    // ============================================
    console.log(`[GetAgentTools] Checking for system-level API key tools...`);
    
    try {
      const { data: systemKeys, error: systemKeysError } = await supabase
        .from('system_api_keys')
        .select('provider_name, display_name, is_active')
        .eq('is_active', true);
      
      if (systemKeysError) {
        console.error('[GetAgentTools] Error fetching system API keys:', systemKeysError);
      } else if (systemKeys && systemKeys.length > 0) {
        console.log(`[GetAgentTools] Found ${systemKeys.length} active system API keys`);
        
        // Map of provider names to their tool definitions
        // NOTE: Only includes simple API-key-only services
        // Services requiring per-user configuration (SMTP, ClickSend) remain user-level
        const systemProviderTools: Record<string, Array<{ name: string; description: string; capability: string }>> = {
          'mistral_ai': [
            { name: 'mistral_chat_completion', description: 'Chat completion using Mistral AI', capability: 'chat_completion' },
            { name: 'mistral_text_generation', description: 'Text generation using Mistral AI', capability: 'text_generation' },
          ],
          'serper_api': [
            { name: 'serper_web_search', description: 'Perform web search using Serper API', capability: 'web_search' },
            { name: 'serper_news_search', description: 'Search news using Serper API', capability: 'news_search' },
          ],
        };
        
        for (const systemKey of systemKeys) {
          const providerName = systemKey.provider_name;
          const providerTools = systemProviderTools[providerName];
          
          if (providerTools && !providersProcessed.has(providerName)) {
            console.log(`[GetAgentTools] Adding system-level tools for ${providerName}`);
            
            for (const tool of providerTools) {
              const parameters = generateParametersForCapability(tool.capability);
              
              tools.push({
                name: tool.name,
                description: tool.description + ' (System)',
                parameters,
                status: 'active',
                provider_name: systemKey.display_name || providerName,
                connection_name: 'System'
              });
            }
            
            providersProcessed.add(providerName);
          }
        }
        
        console.log(`[GetAgentTools] Added system-level API key tools`);
      } else {
        console.log(`[GetAgentTools] No system API keys found`);
      }
    } catch (systemKeysError) {
      console.warn(`[GetAgentTools] Error checking for system API keys:`, systemKeysError);
    }

    // Check for Zapier MCP tools
    console.log(`[GetAgentTools] Checking for Zapier MCP tools...`);
    
    try {
      const { data: mcpTools, error: mcpError } = await supabase
        .rpc('get_agent_mcp_tools', { p_agent_id: agent_id });

      if (mcpError) {
        console.warn(`[GetAgentTools] Error fetching MCP tools:`, mcpError);
      } else if (mcpTools && mcpTools.length > 0) {
        console.log(`[GetAgentTools] Found ${mcpTools.length} MCP tools for agent ${agent_id}`);
        
        // Check for stale schemas (> 7 days old)
        const uniqueConnectionIds = new Set<string>();
        for (const mcpTool of mcpTools) {
          if (mcpTool.connection_id) {
            uniqueConnectionIds.add(mcpTool.connection_id);
          }
        }
        
        // Check each connection for staleness and trigger background refresh if needed
        for (const connectionId of uniqueConnectionIds) {
          try {
            const { data: isStale } = await supabase
              .rpc('is_mcp_schema_stale', { p_connection_id: connectionId });
            
            if (isStale) {
              console.warn(`[GetAgentTools] ⚠️ Schema stale for connection ${connectionId} - triggering background refresh`);
              
              // Trigger background refresh (non-blocking)
              supabase.functions.invoke('refresh-mcp-tools', {
                body: { connectionId }
              }).then(({ data, error }) => {
                if (error) {
                  console.error(`[GetAgentTools] Background refresh failed for ${connectionId}:`, error);
                } else {
                  console.log(`[GetAgentTools] ✅ Background refresh completed for ${connectionId}:`, data);
                }
              }).catch(err => {
                console.error(`[GetAgentTools] Background refresh error for ${connectionId}:`, err);
              });
            }
          } catch (staleCheckError) {
            console.warn(`[GetAgentTools] Failed to check schema staleness:`, staleCheckError);
          }
        }
        
        for (const mcpTool of mcpTools) {
          if (mcpTool.openai_schema && mcpTool.tool_name) {
            // Build enhanced description with successful parameter examples
            let enhancedDescription = mcpTool.openai_schema.description || `${mcpTool.tool_name} - MCP Tool`;
            
            // Add tool-specific guidance for common API issues
            if (mcpTool.tool_name.includes('quickbooks_online_api_request')) {
              enhancedDescription += `\n\n⚠️ **IMPORTANT - HTTPS & REALM ID REQUIREMENTS:**

1. The 'url' parameter MUST be a FULL HTTPS URL, not a relative path.
   ✅ CORRECT: "https://quickbooks.api.intuit.com/v3/company/REALM_ID_HERE/reports/ProfitAndLoss"
   ❌ WRONG: "/reports/profit_and_loss"
   ✅ CORRECT: replace the REALM_ID_HERE with the actual QuickBooks Company ID (realm ID).
   ✅ CORRECT: https://quickbooks.api.intuit.com/v3/company/9130346988354456/reports/ProfitAndLoss?start_date=2025-01-01&end_date=2025-03-31

2. The {realmId} placeholder is NOT automatically replaced by Zapier.
   You MUST provide the actual QuickBooks Company ID (realm ID).
   
3. For reports, use query parameters for date ranges:
   Example: "?start_date=2025-01-01&end_date=2025-03-31"

⚠️ **LIMITATION:** This tool requires the actual QuickBooks Company ID which may not be available.
For most QuickBooks operations, use the specific tools like:
- quickbooks_online_find_invoice
- quickbooks_online_find_customer
- quickbooks_online_create_invoice
etc.

Only use this API Request tool if the specific operation is not available as a dedicated tool.`;
            }
            
            // Add successful parameters guidance if available
            if (mcpTool.successful_parameters && Array.isArray(mcpTool.successful_parameters) && mcpTool.successful_parameters.length > 0) {
              const latestSuccess = mcpTool.successful_parameters[mcpTool.successful_parameters.length - 1];
              const paramKeys = Object.keys(latestSuccess);
              
              if (paramKeys.length > 0) {
                enhancedDescription += `\n\n✅ **Successful Parameter Example:**\n${JSON.stringify(latestSuccess, null, 2)}`;
                enhancedDescription += `\n\n📊 Success Count: ${mcpTool.success_count || 0} executions`;
                
                if (mcpTool.last_successful_call) {
                  enhancedDescription += `\nLast Success: ${new Date(mcpTool.last_successful_call).toISOString()}`;
                }
              }
            }
            
            // Enhance the parameter schema for url parameters in API tools
            let enhancedParameters = mcpTool.openai_schema.parameters || {};
            if (mcpTool.tool_name.includes('api_request') && enhancedParameters.properties && enhancedParameters.properties.url) {
              enhancedParameters = {
                ...enhancedParameters,
                properties: {
                  ...enhancedParameters.properties,
                  url: {
                    ...enhancedParameters.properties.url,
                    description: (enhancedParameters.properties.url.description || 'API endpoint URL') + ' (MUST be a full HTTPS URL with protocol and domain, not a relative path)'
                  }
                }
              };
            }
            
            // Check if this tool requires user input before execution
            let requiresUserInput = null;
            if (mcpTool.tool_name.includes('quickbooks_online_api_request')) {
              requiresUserInput = {
                reason: 'QuickBooks API requests require your Company ID (Realm ID)',
                fields: [
                  {
                    name: 'quickbooks_realm_id',
                    label: 'QuickBooks Company ID',
                    description: 'Find this in your QuickBooks URL when logged in: https://app.qbo.intuit.com/app/homepage?realmId=YOUR_ID_HERE',
                    type: 'text',
                    required: true,
                    placeholder: '9130346988354456',
                    validation: '^[0-9]{10,20}$'
                  }
                ],
                save_for_session: true // Remember this value for the entire conversation
              };
            }
            
            tools.push({
              name: mcpTool.tool_name,
              description: enhancedDescription,
              parameters: enhancedParameters,
              status: 'active',
              provider_name: 'Zapier MCP',
              connection_name: mcpTool.connection_name || 'MCP Server',
              requires_user_input: requiresUserInput,
              _mcp_metadata: {
                successful_parameters: mcpTool.successful_parameters || [],
                success_count: mcpTool.success_count || 0,
                last_successful_call: mcpTool.last_successful_call
              }
            });
          }
        }

        console.log(`[GetAgentTools] Added ${mcpTools.length} Zapier MCP tools`);
        console.log(`[GetAgentTools] MCP Tools: ${mcpTools.map(t => t.tool_name).join(', ')}`);
        providersProcessed.add('Zapier MCP');
      } else {
        console.log(`[GetAgentTools] No MCP tools found for agent ${agent_id}`);
      }
    } catch (mcpError) {
      console.warn(`[GetAgentTools] Error checking for MCP tools:`, mcpError);
    }

    console.log(`[GetAgentTools] Retrieved ${tools.length} tools from ${providersProcessed.size} providers`);
    console.log(`[GetAgentTools] Providers: ${Array.from(providersProcessed).join(', ')}`);

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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`[GetAgentTools] Unexpected error: ${error.message}`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${error.message}` 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
