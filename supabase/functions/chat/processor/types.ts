// Processor Types
// Shared types for the message processor system

import type { AdvancedChatMessage } from '../types/message.types.ts';

export interface ProcessingContext {
  request_id: string;
  agent_id: string;
  user_id?: string;
  conversation_id?: string;
  session_id?: string;
  workspace_id?: string;
  channel_id?: string;
  request_options?: any;
}

export interface ProcessedMessage {
  message: AdvancedChatMessage;
  context: ProcessingContext;
  metrics: ProcessingMetrics;
}

export interface ProcessingMetrics {
  start_time: number;
  end_time?: number;
  stages: Record<string, number>;
  tokens_used: number;
  memory_searches: number;
  tool_executions: number;
  
  // Enhanced metrics for detailed tracking
  prompt_tokens?: number;
  completion_tokens?: number;
  cost_usd?: number;
  model_used?: string;
  context_tokens?: number;
  compression_ratio?: number;
  
  // Memory operation details
  episodic_memory?: {
    status: 'searched' | 'disabled' | 'disconnected' | 'error';
    results_count: number;
    relevance_scores: number[];
    memories_used: any[];
    search_time_ms: number;
    memories?: Array<{
      id: string;
      content: any;
      relevance_score?: number;
      created_at: string;
      importance?: number;
    }>;
  };
  semantic_memory?: {
    status: 'searched' | 'disabled' | 'disconnected' | 'error';
    results_count: number;
    relevance_scores: number[];
    concepts_retrieved: string[];
    search_time_ms: number;
    memories?: Array<{
      id?: string;
      content: any;
      relevance_score?: number;
      source?: string;
    }>;
  };
  procedural_memory?: {
    searched: boolean;
    patterns_matched: number;
    procedures_activated: string[];
  };
  working_memory?: {
    capacity_used: number;
    items_retained: number;
    items_discarded: number;
  };
  
  // Context operation details
  context_sources?: string[];
  context_optimization?: boolean;
  compression_applied?: boolean;
  context_quality_score?: number;
  
  // Tool operation details
  tool_details?: Array<{
    name: string;
    execution_time_ms: number;
    success: boolean;
    input_params: any;
    output_result: any;
    error?: string;
  }>;
  
  // Discovered tools (available but not necessarily used)
  discovered_tools?: Array<{
    name: string;
    description?: string;
  }>;
  
  // Reasoning chain details
  reasoning_steps?: Array<{
    step: number;
    type: 'analysis' | 'synthesis' | 'decision' | 'validation';
    description: string;
    confidence: number;
    time_ms: number;
  }>;
  
  // Chat history details
  history_length?: number;
  relevance_filtering?: boolean;
  
  // Performance details
  stage_timings?: Record<string, number>;
  bottlenecks?: string[];
  cache_hits?: number;
  cache_misses?: number;
  
  // Reasoning metadata (for CoT)
  reasoning?: {
    score: number;
    enabled: boolean;
    style?: string;
    reason?: string;
  };
  
  // LLM call tracking for debug modal (temporary, in-memory only)
  llm_calls?: Array<{
    stage: string;
    description: string;
    request: any;
    response: any;
    timestamp?: string;
    duration_ms?: number;
  }>;
}

export interface ProcessingOptions {
  stream?: boolean;
  validate?: boolean;
  timeout?: number;
  max_retries?: number;
}

export interface StreamEvent {
  event: 'message_start' | 'content_delta' | 'message_complete' | 'error';
  message_id?: string;
  role?: string;
  timestamp?: string;
  delta?: string;
  index?: number;
  finish_reason?: 'stop' | 'length' | 'tool_calls';
  message?: AdvancedChatMessage;
  metrics?: {
    processing_time_ms: number;
    tokens: { prompt: number; completion: number; total: number; cost_usd?: number };
    model: string;
    memory_searches?: number;
    tool_executions?: number;
    context_size?: number;
    compression_ratio?: number;
  };
  error?: any;
  recoverable?: boolean;
}
