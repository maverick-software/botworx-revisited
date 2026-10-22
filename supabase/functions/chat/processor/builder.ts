// Message Builder Utilities
// Helper functions for creating and building messages

import type { 
  AdvancedChatMessage,
  ChatRequestV2,
  MessageResponse
} from '../types/message.types.ts';
import { ErrorCode } from '../api/v2/schemas/responses.ts';
import { APIError } from '../api/v2/errors.ts';
import type { ProcessingContext, ProcessingMetrics } from './types.ts';

/**
 * Create an AdvancedChatMessage from a request
 */
export function createMessage(
  request: ChatRequestV2,
  context: ProcessingContext
): AdvancedChatMessage {
  const timestamp = new Date().toISOString();
  
  return {
    id: context.request_id,
    version: request.version,
    role: request.message.role || 'user',
    content: request.message.content || { type: 'text', text: '' },
    timestamp,
    created_at: timestamp,
    metadata: {
      ...request.message.metadata,
      source: 'api',
      request_version: request.version,
    },
    context: {
      conversation_id: context.conversation_id,
      session_id: context.session_id,
      thread_id: request.message.context?.thread_id,
      parent_message_id: request.message.context?.parent_message_id,
      agent_id: context.agent_id,
      channel_id: context.channel_id,
      workspace_id: context.workspace_id,
      // carry working memory limit (0-100) if provided via options.state or options.context
      // UI will set options.context.max_messages; we pass it through as working memory limit
      ...(request.options?.context?.max_messages !== undefined ? { working_memory_limit: request.options.context.max_messages } : {}),
    },
    tools: request.message.tools,
    memory: request.message.memory_refs?.map(id => ({ memory_id: id })),
    state: request.message.state,
  };
}

/**
 * Build a success response with comprehensive details
 */
export function buildSuccessResponse(
  message: AdvancedChatMessage,
  context: ProcessingContext,
  metrics: ProcessingMetrics
): MessageResponse {
  // DEBUG: Log llm_calls before building response
  console.log('[buildSuccessResponse] 🔍 metrics.llm_calls:', {
    exists: !!metrics.llm_calls,
    count: metrics.llm_calls?.length || 0,
    stages: metrics.llm_calls?.map(c => c.stage) || [],
  });
  
  return {
    version: '2.0.0',
    status: 'success',
    timestamp: new Date().toISOString(),
    request_id: context.request_id,
    data: {
      message,
      conversation: {
        id: context.conversation_id || '',
        message_count: 1, // Would fetch from DB
        participant_count: 2,
        created_at: message.created_at,
        updated_at: message.created_at,
        status: 'active',
      },
      session: {
        id: context.session_id || '',
        active: true,
        duration_ms: metrics.end_time! - metrics.start_time,
        message_count: 1,
        tool_call_count: metrics.tool_executions,
      },
    },
    metrics: {
      processing_time_ms: metrics.end_time! - metrics.start_time,
      tokens: {
        prompt: metrics.prompt_tokens || 0,
        completion: metrics.completion_tokens || 0,
        total: metrics.tokens_used,
        cost_usd: metrics.cost_usd,
      },
      model: metrics.model_used || 'gpt-4',
      memory_searches: metrics.memory_searches,
      tool_executions: metrics.tool_executions,
      context_size: metrics.context_tokens,
      compression_ratio: metrics.compression_ratio,
    },
    // Add comprehensive processing details
    processing_details: {
      pipeline_stages: metrics.stages,
      memory_operations: {
        episodic_search: metrics.episodic_memory || null,
        semantic_search: metrics.semantic_memory || null,
        procedural_memory: metrics.procedural_memory || null,
        working_memory: metrics.working_memory || null,
      },
      context_operations: {
        retrieval_sources: metrics.context_sources || [],
        optimization_applied: metrics.context_optimization || false,
        compression_applied: metrics.compression_applied || false,
        quality_score: metrics.context_quality_score || 0,
      },
      tool_operations: metrics.tool_details || [],
      discovered_tools: (metrics as any).discovered_tools || [],
      tool_requested: (metrics as any).tool_requested || false,
      reasoning_chain: metrics.reasoning_steps || [],
      llm_calls: metrics.llm_calls || [], // ✨ Add LLM call tracking for Debug Modal
      // Reasoning summary for modal header
      reasoning: metrics.reasoning
        ? {
            type: metrics.reasoning.style || 'inductive',
            score: metrics.reasoning.score,
            reason: metrics.reasoning.enabled
              ? 'Reasoning enabled based on complexity heuristic'
              : 'Reasoning disabled by options',
          }
        : undefined,
      chat_history: {
        messages_considered: metrics.history_length || 0,
        context_window_used: metrics.context_tokens || 0,
        relevance_filtering: metrics.relevance_filtering || false,
      },
      performance: {
        stage_timings: metrics.stage_timings || {},
        bottlenecks: metrics.bottlenecks || [],
        cache_hits: metrics.cache_hits || 0,
        cache_misses: metrics.cache_misses || 0,
      },
    },
  };
}

/**
 * Convert error to response details
 */
export function errorToDetails(error: Error): any {
  if (error instanceof APIError) {
    return error.toResponse().error;
  }
  
  return {
    type: 'internal_error',
    title: 'Internal Server Error',
    status: 500,
    detail: error.message,
    error_code: ErrorCode.INTERNAL_ERROR,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Chunk text for streaming
 */
export function chunkText(text: string, chunkSize: number): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' ') + ' ');
  }
  
  return chunks;
}
