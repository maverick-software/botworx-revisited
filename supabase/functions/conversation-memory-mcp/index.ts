/**
 * Conversation Memory MCP Tools Edge Function
 * 
 * Provides tools for AI agents to search and retrieve conversation context:
 * - Search working memory chunks (recent conversation context)
 * - Search conversation summaries (historical context)
 * - Get conversation summary board (current state)
 * 
 * Part of the Working Memory System (Phase 2)
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

interface MCPToolRequest {
  action: string;
  agent_id: string;
  user_id: string;
  params: Record<string, any>;
  tool_name?: string;
}

interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    tool_name: string;
    execution_time_ms: number;
    [key: string]: any;
  };
}

interface SearchWorkingMemoryParams {
  query: string;
  conversation_id: string;
  similarity_threshold?: number;
  match_count?: number;
}

interface SearchSummariesParams {
  query: string;
  start_date?: string;
  end_date?: string;
  match_count?: number;
}

interface GetSummaryBoardParams {
  conversation_id: string;
}

/**
 * Generate embedding for a query using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Search working memory chunks using vector similarity
 */
async function handleSearchWorkingMemory(
  supabase: any,
  params: SearchWorkingMemoryParams,
  agentId: string,
  userId: string
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const {
      query,
      conversation_id,
      similarity_threshold = 0.7,
      match_count = 5
    } = params;

    if (!query) {
      return {
        success: false,
        error: 'Query parameter is required',
        metadata: {
          tool_name: 'search_working_memory',
          execution_time_ms: Date.now() - startTime
        }
      };
    }

    if (!conversation_id) {
      return {
        success: false,
        error: 'conversation_id parameter is required',
        metadata: {
          tool_name: 'search_working_memory',
          execution_time_ms: Date.now() - startTime
        }
      };
    }

    // Generate embedding for the query
    console.log(`[ConversationMemory] Generating embedding for query: "${query}"`);
    const queryEmbedding = await generateEmbedding(query);

    // Call RPC function to search working memory chunks
    const { data, error } = await supabase.rpc('search_working_memory', {
      p_query: query,
      p_conversation_id: conversation_id,
      p_user_id: userId,
      p_agent_id: agentId,
      p_similarity_threshold: similarity_threshold,
      p_match_count: match_count
    });

    if (error) {
      console.error('[ConversationMemory] Error searching working memory:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
        metadata: {
          tool_name: 'search_working_memory',
          execution_time_ms: Date.now() - startTime
        }
      };
    }

    console.log(`[ConversationMemory] Found ${data?.length || 0} working memory chunks`);

    return {
      success: true,
      data: {
        chunks: data || [],
        query: query,
        conversation_id: conversation_id,
        match_count: data?.length || 0
      },
      metadata: {
        tool_name: 'search_working_memory',
        execution_time_ms: Date.now() - startTime,
        results_count: data?.length || 0
      }
    };

  } catch (error: any) {
    console.error('[ConversationMemory] Error in handleSearchWorkingMemory:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      metadata: {
        tool_name: 'search_working_memory',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

/**
 * Search conversation summaries using vector similarity
 */
async function handleSearchSummaries(
  supabase: any,
  params: SearchSummariesParams,
  agentId: string,
  userId: string
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const {
      query,
      start_date,
      end_date,
      match_count = 5
    } = params;

    if (!query) {
      return {
        success: false,
        error: 'Query parameter is required',
        metadata: {
          tool_name: 'search_conversation_summaries',
          execution_time_ms: Date.now() - startTime
        }
      };
    }

    // Generate embedding for the query
    console.log(`[ConversationMemory] Generating embedding for summary search: "${query}"`);
    const queryEmbedding = await generateEmbedding(query);

    // Call RPC function to search conversation summaries
    const { data, error } = await supabase.rpc('search_conversation_summaries', {
      p_agent_id: agentId,
      p_user_id: userId,
      p_query_embedding: JSON.stringify(queryEmbedding),
      p_start_date: start_date || null,
      p_end_date: end_date || null,
      p_match_count: match_count
    });

    if (error) {
      console.error('[ConversationMemory] Error searching summaries:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
        metadata: {
          tool_name: 'search_conversation_summaries',
          execution_time_ms: Date.now() - startTime
        }
      };
    }

    console.log(`[ConversationMemory] Found ${data?.length || 0} conversation summaries`);

    return {
      success: true,
      data: {
        summaries: data || [],
        query: query,
        match_count: data?.length || 0
      },
      metadata: {
        tool_name: 'search_conversation_summaries',
        execution_time_ms: Date.now() - startTime,
        results_count: data?.length || 0
      }
    };

  } catch (error: any) {
    console.error('[ConversationMemory] Error in handleSearchSummaries:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      metadata: {
        tool_name: 'search_conversation_summaries',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

/**
 * Get the current summary board for a conversation
 */
async function handleGetSummaryBoard(
  supabase: any,
  params: GetSummaryBoardParams,
  agentId: string,
  userId: string
): Promise<MCPToolResponse> {
  const startTime = Date.now();
  
  try {
    const { conversation_id } = params;

    if (!conversation_id) {
      return {
        success: false,
        error: 'conversation_id parameter is required',
        metadata: {
          tool_name: 'get_conversation_summary_board',
          execution_time_ms: Date.now() - startTime
        }
      };
    }

    // Get summary board from database
    const { data, error } = await supabase
      .from('conversation_summary_boards')
      .select('*')
      .eq('conversation_id', conversation_id)
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[ConversationMemory] Error fetching summary board:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
        metadata: {
          tool_name: 'get_conversation_summary_board',
          execution_time_ms: Date.now() - startTime
        }
      };
    }

    if (!data) {
      return {
        success: true,
        data: {
          message: 'No summary board found for this conversation yet. It will be created after 5 messages.',
          conversation_id: conversation_id
        },
        metadata: {
          tool_name: 'get_conversation_summary_board',
          execution_time_ms: Date.now() - startTime
        }
      };
    }

    console.log(`[ConversationMemory] Retrieved summary board for conversation ${conversation_id}`);

    return {
      success: true,
      data: {
        summary: data.current_summary,
        important_facts: data.important_facts || [],
        action_items: data.action_items || [],
        pending_questions: data.pending_questions || [],
        context_notes: data.context_notes,
        message_count: data.message_count,
        last_updated: data.last_updated,
        conversation_id: conversation_id
      },
      metadata: {
        tool_name: 'get_conversation_summary_board',
        execution_time_ms: Date.now() - startTime
      }
    };

  } catch (error: any) {
    console.error('[ConversationMemory] Error in handleGetSummaryBoard:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      metadata: {
        tool_name: 'get_conversation_summary_board',
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

/**
 * List available tools
 */
async function handleListTools(): Promise<MCPToolResponse> {
  return {
    success: true,
    data: {
      tools: [
        {
          name: 'search_working_memory',
          description: 'Search recent conversation context using semantic similarity. Returns relevant chunks from the current conversation.',
          parameters: {
            query: {
              type: 'string',
              description: 'The search query to find relevant conversation context',
              required: true
            },
            conversation_id: {
              type: 'string',
              description: 'The conversation ID to search within',
              required: true
            },
            similarity_threshold: {
              type: 'number',
              description: 'Minimum similarity score (0-1). Default: 0.7',
              required: false
            },
            match_count: {
              type: 'number',
              description: 'Maximum number of results to return. Default: 5',
              required: false
            }
          }
        },
        {
          name: 'search_conversation_summaries',
          description: 'Search historical conversation summaries across all conversations. Useful for finding past discussions on specific topics.',
          parameters: {
            query: {
              type: 'string',
              description: 'The search query to find relevant conversation summaries',
              required: true
            },
            start_date: {
              type: 'string',
              description: 'Filter summaries after this date (ISO 8601 format)',
              required: false
            },
            end_date: {
              type: 'string',
              description: 'Filter summaries before this date (ISO 8601 format)',
              required: false
            },
            match_count: {
              type: 'number',
              description: 'Maximum number of results to return. Default: 5',
              required: false
            }
          }
        },
        {
          name: 'get_conversation_summary_board',
          description: 'Get the current summary board for a conversation, including key facts, action items, and pending questions.',
          parameters: {
            conversation_id: {
              type: 'string',
              description: 'The conversation ID to get the summary board for',
              required: true
            }
          }
        }
      ]
    },
    metadata: {
      tool_name: 'list_tools',
      execution_time_ms: 0
    }
  };
}

/**
 * Main request handler
 */
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData: MCPToolRequest = await req.json();
    
    const { action, agent_id, user_id, params } = requestData;

    console.log(`[ConversationMemory] Received request - action: ${action}, agent: ${agent_id}`);

    let response: MCPToolResponse;

    // Route to appropriate handler
    switch (action) {
      case 'search_working_memory':
        response = await handleSearchWorkingMemory(supabase, params, agent_id, user_id);
        break;
      
      case 'search_conversation_summaries':
        response = await handleSearchSummaries(supabase, params, agent_id, user_id);
        break;
      
      case 'get_conversation_summary_board':
        response = await handleGetSummaryBoard(supabase, params, agent_id, user_id);
        break;
      
      case 'list_tools':
        response = await handleListTools();
        break;
      
      default:
        response = {
          success: false,
          error: `Unknown action: ${action}`,
          metadata: {
            tool_name: action,
            execution_time_ms: 0
          }
        };
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.success ? 200 : 400
      }
    );

  } catch (error: any) {
    console.error('[ConversationMemory] Unhandled error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        metadata: {
          tool_name: 'unknown',
          execution_time_ms: 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
