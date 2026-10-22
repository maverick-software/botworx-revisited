import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import OpenAI from 'npm:openai@4.28.0';
import { RateLimiter } from 'npm:limiter@3.0.0';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';
import { MCPManager } from './manager.ts';
import { MCPServerConfig, AgentopiaContextData, AggregatedMCPResults } from './types.ts';
import { ContextBuilder, ChatMessage, WorkspaceDetails as ImportedWorkspaceDetails, ContextSettings, BasicWorkspaceMember } from './context_builder.ts';

// Import extracted modules
import { getVectorSearchResults } from './vector_search.ts';
import { prepareMCPContext, processMCPContext } from './mcp_integration.ts';
import { getWorkspaceDetails, createContextSettings } from './workspace_manager.ts';
import { getRelevantChatHistory, saveUserMessage, saveAgentResponse } from './chat_history.ts';
import { 
  handleCORS, 
  authenticateUser, 
  checkRateLimit, 
  validateRequestBody, 
  createErrorResponse, 
  createSuccessResponse 
} from './auth_handler.ts';
import { FunctionCallingManager, OpenAIFunction, OpenAIToolCall, processFunctionCalls } from './function_calling.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    text: string;
    source?: string;
    timestamp?: string;
  };
}

// Rate limiter: 30 requests per minute
const limiter = new RateLimiter({
  tokensPerInterval: 30,
  interval: 'minute',
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
});

/**
 * Fetches agent details from the database
 * @param agentId - The ID of the agent to fetch
 * @returns Agent data or null if not found
 */
async function getAgentDetails(agentId: string) {
  const { data: agent, error: agentError } = await supabaseClient
    .from('agents')
    .select('id, name, system_instructions, assistant_instructions, personality') 
    .eq('id', agentId)
    .single();
    
  if (agentError || !agent) { 
    console.error('Agent fetch error:', agentError);
    return null;
  }

  return agent;
}

/**
 * Handles user-only messages (no agent target)
 * @param channelId - Channel where message was sent
 * @param userMessageContent - Content of the user message
 * @param userId - ID of the user sending the message
 * @param workspaceId - ID of the workspace
 */
async function handleUserOnlyMessage(
  channelId: string | null,
  userMessageContent: string,
  userId: string,
  workspaceId: string | undefined
): Promise<Response> {
  console.log(`Handling user-only message for channel: ${channelId} in workspace: ${workspaceId}`);
  
  if (!userMessageContent || !channelId) {
    return createErrorResponse('Message content and Channel ID are required.', 400);
  }

  const saveResult = await saveUserMessage(channelId, userMessageContent, userId, supabaseClient);
  
  if (!saveResult.success) {
    console.error('Error saving user-only message');
    return createErrorResponse(saveResult.error || 'Failed to save message.', 500);
  }

  return createSuccessResponse({ success: true, message: "Message saved." });
}

/**
 * Handles messages targeting an agent
 * @param agentId - ID of the target agent
 * @param userMessageContent - Content of the user message
 * @param userId - ID of the user sending the message
 * @param channelId - Channel where message was sent
 * @param workspaceId - ID of the workspace
 * @param authToken - JWT auth token for calling other functions
 */
async function handleAgentMessage(
  agentId: string,
  userMessageContent: string,
  userId: string,
    channelId: string | null, 
  workspaceId: string | undefined,
  authToken: string
): Promise<Response> {
  console.log(`Handling message for agent: ${agentId} in workspace: ${workspaceId} channel: ${channelId}`);

  // Fetch agent details
  const agent = await getAgentDetails(agentId);
  if (!agent) {
    return createErrorResponse('Target agent not found or error fetching agent', 404);
  }

  // Fetch workspace details and create context settings
  let workspaceDetails = null;
    if (workspaceId) {
    workspaceDetails = await getWorkspaceDetails(workspaceId, supabaseClient);
      if (!workspaceDetails) {
        console.warn(`Could not fetch details for workspace ${workspaceId}. Proceeding without workspace context.`);
      }
    } else {
        console.log('No workspaceId provided, assuming non-workspace chat context.');
  }

  const contextSettings = createContextSettings(workspaceDetails);
    console.log(`[chat] Using context settings - Window Size: ${contextSettings.messageLimit}, Token Limit: ${contextSettings.tokenLimit}`);

  // Fetch context components in parallel for performance
  const [vectorContextStr, historyMessages, mcpResourceContextStr] = await Promise.all([
    getVectorSearchResults(userMessageContent, agentId, supabaseClient, openai),
    getRelevantChatHistory(channelId, userId, agentId, contextSettings.messageLimit, supabaseClient),
    processMCPContext(agentId, await prepareMCPContext([], agent.id, agent.name ?? 'Agent', '', agent.system_instructions, agent.assistant_instructions), supabaseClient)
  ]);

  // Create Context Builder
      const contextBuilder = new ContextBuilder(contextSettings)
        .addSystemInstruction(agent.system_instructions || '');

      // Add agent identity and personality
      if (agent.name) {
        contextBuilder.addSystemInstruction(`You are ${agent.name}, a helpful AI assistant with access to a suite of tools. You are not just a language model; you can perform actions on behalf of the user when they ask you to.`);
        if (agent.personality) {
          contextBuilder.addSystemInstruction(`Your personality: ${agent.personality}. Always maintain this persona.`);
        }
      }

      // Add assistant instructions
      if (agent.assistant_instructions) {
        contextBuilder.addAssistantInstruction(`Follow these instructions carefully: ${agent.assistant_instructions}`);
      }
      
      // Add a directive to use tools
      contextBuilder.addSystemInstruction("When a user asks you to perform an action that corresponds to one of your available tools, you must use that tool. Do not refuse or claim you are unable to perform the action. If you have the tool, use it.");
      
      // Add vector search results if available
      if (vectorContextStr) {
        contextBuilder.addVectorMemories(vectorContextStr);
      }

      // Add MCP context if available
      if (mcpResourceContextStr) {
        contextBuilder.addMCPContext(mcpResourceContextStr);
      }

      // Set chat history with agent names
      contextBuilder.setHistory(historyMessages);

      // Set the user's current message
      contextBuilder.setUserInput(userMessageContent);

      // Build the final context
      let messages = contextBuilder.buildContext();

      console.log(`[chat] Final context built - ${messages.length} messages, approximately ${contextBuilder.getTotalTokenCount()} tokens`);
      
      // Add a "thinking" step log
      console.log('[ReAct] Thinking: Does the user want me to use a tool? Reviewing available tools and user request.');

  // Initialize function calling manager with auth token
      const functionCallingManager = new FunctionCallingManager(supabaseClient, authToken);
      
      // Get available tools for the agent
      const availableTools = await functionCallingManager.getAvailableTools(agentId, userId);
      console.log(`[chat] Found ${availableTools.length} available tools for agent ${agentId}`);
      console.log(`[chat] Available tools:`, availableTools.map(t => t.name));
      
      // Add available tool names to the context to ensure AI uses correct names
      if (availableTools.length > 0) {
        const toolInfo = availableTools.map(t => `• ${t.name}: ${t.description}`).join('\n');
        contextBuilder.addSystemInstruction(`\nYou have access to the following tools:\n${toolInfo}\n\nCRITICAL INSTRUCTION - READ CAREFULLY:\nYou MUST use the EXACT tool names as listed above. The function names are case-sensitive and must match exactly.\n\nFor Gmail operations:\n- To send an email, the function name is EXACTLY "send_email" (NOT "gmail_send_message", NOT "gmail_send", NOT anything else)\n- To read emails, the function name is EXACTLY "read_emails"\n- To search emails, the function name is EXACTLY "search_emails"\n\nIMPORTANT: The function "gmail_send_message" DOES NOT EXIST and will fail. You must use "send_email" instead.\n\nWhen calling a function, use this exact format:\n{"name": "send_email", "arguments": {...}}\n\nDO NOT use any prefix like "gmail_" before the function names.`);
        
        // Add another reminder right before the user message
        contextBuilder.addSystemInstruction(`FINAL REMINDER: When sending an email, call the function "send_email". The function "gmail_send_message" does not exist and will cause an error.`);
        
        // Rebuild messages after adding tool info
        messages = contextBuilder.buildContext();
      }

  // Get Response from LLM with function calling
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        tools: availableTools.length > 0 ? availableTools.map(tool => ({
          type: 'function',
          function: tool,
        })) : undefined,
        tool_choice: availableTools.length > 0 ? 'auto' : undefined,
      });

  // Handle function calls if present
      let completionContent = completion.choices[0].message.content;
      const toolCalls = completion.choices[0].message.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        console.log(`[chat] Agent requested ${toolCalls.length} function calls`);
        
        // Correct any wrong tool names
        const correctedToolCalls = toolCalls.map((toolCall: OpenAIToolCall) => {
          let functionName = toolCall.function.name;
          
          // Map incorrect Gmail tool names to correct ones
          const toolNameCorrections: Record<string, string> = {
            'gmail_send_message': 'send_email',
            'gmail_send': 'send_email',
            'gmail_read_messages': 'read_emails',
            'gmail_search': 'search_emails',
            'gmail_search_messages': 'search_emails',
            'gmail_email_actions': 'email_actions',
          };
          
          if (toolNameCorrections[functionName]) {
            console.log(`[chat] CORRECTING TOOL NAME: "${functionName}" -> "${toolNameCorrections[functionName]}"`);
            functionName = toolNameCorrections[functionName];
          }
          
          return {
            ...toolCall,
            function: {
              ...toolCall.function,
              name: functionName
            }
          };
        });
        
        // Execute function calls with corrected names
        const functionResults = await Promise.all(
          correctedToolCalls.map(async (toolCall: OpenAIToolCall) => {
            const functionName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments);
            
            console.log(`[chat] Executing function ${functionName} with parameters:`, parameters);
            
            return await functionCallingManager.executeFunction(
              agentId,
              userId,
              functionName,
              parameters
            );
          })
        );

        // Format function responses (use corrected tool calls)
        const functionResponses = processFunctionCalls(correctedToolCalls, functionResults, functionCallingManager);
        
        // Create follow-up messages for OpenAI
        const followUpMessages = [
          ...messages,
          {
            role: 'assistant',
            content: completionContent,
            tool_calls: toolCalls,
          },
          ...functionResponses.map(response => ({
            role: 'tool',
            tool_call_id: response.tool_call_id,
            content: response.content,
          })),
        ];

        console.log(`[chat] Making follow-up request with function results`);
        
        // Get final response with function results
        const followUpCompletion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: followUpMessages,
          temperature: 0.7,
        });

        completionContent = followUpCompletion.choices[0].message.content;
        
        console.log(`[chat] Function calls completed. Final response generated.`);
      } else {
        console.log(`[chat] No function calls requested by agent`);
      }

  // Extract assistant response

      // Save agent response in the database
  const saveResult = await saveAgentResponse(channelId, completionContent, agentId, supabaseClient);
  if (!saveResult.success) {
    console.error('Error saving agent response');
        // Note: We still return the response to the client even if saving fails
      }

  return createSuccessResponse({
          message: completionContent,
          agent: { id: agent.id, name: agent.name },
  });
}

/**
 * Main Deno.serve handler - orchestrates the chat functionality
 */
Deno.serve(async (req) => {
  try {
    // Handle CORS preflight requests
    const corsResponse = handleCORS(req);
    if (corsResponse) return corsResponse;

    // Authentication
    const authResult = await authenticateUser(req, supabaseClient);
    if (!authResult.success) {
      return createErrorResponse(authResult.error!, authResult.statusCode!);
    }
    const userId = authResult.userId!;
    
    // Extract the auth token for passing to other functions
    const authToken = req.headers.get('Authorization')?.replace('Bearer ', '') || '';

    // Rate Limiting
    if (!checkRateLimit(limiter)) {
      return createErrorResponse('Rate limit exceeded', 429);
    }

    // Parse and validate request body
    const validationResult = await validateRequestBody(req);
    if (!validationResult.success) {
      return createErrorResponse(validationResult.error!, validationResult.statusCode!);
    }
    
    const reqData = validationResult.data!;
    const userMessageContent = reqData.message?.trim();
    const targetAgentId = reqData.agentId;
    const channelId = reqData.channelId;
    const workspaceId = reqData.workspaceId;

    // Route to appropriate handler based on target
    if (!targetAgentId) {
      // Handle User-Only Message
      return await handleUserOnlyMessage(channelId || null, userMessageContent, userId, workspaceId);
    } else {
      // Handle Message Targeting an Agent
      return await handleAgentMessage(targetAgentId, userMessageContent, userId, channelId || null, workspaceId, authToken);
    }

  } catch (error) {
    console.error('Critical Chat Function Error:', error);
    return createErrorResponse('Internal server error', 500);
  }
});