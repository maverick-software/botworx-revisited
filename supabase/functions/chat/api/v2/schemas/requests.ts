// API v2 Request Schemas
// Type definitions for all API request payloads

import {
  MessageRole,
  MessageContent,
  MessageMetadata,
  ToolCall,
  MemoryType,
} from '../../../types/index.ts';

// ============================
// Base Request Types
// ============================

export interface BaseRequest {
  version: '2.0.0';
  request_id?: string;
}

// ============================
// Chat Request Schemas
// ============================

export interface CreateMessageRequest extends BaseRequest {
  // Message content
  message: {
    role: MessageRole;
    content: MessageContent;
    metadata?: Partial<MessageMetadata>;
    tools?: ToolCall[];
    memory_refs?: string[];
  };
  
  // Context
  context: {
    conversation_id?: string;
    session_id?: string;
    agent_id?: string;
    channel_id?: string;
    workspace_id?: string;
  };
  
  // Options
  options?: MessageOptions;
}

export interface MessageOptions {
  // Memory options
  memory?: {
    enabled: boolean;
    types: MemoryType[];
    max_results: number;
    min_relevance: number;
    include_expired?: boolean;
  };
  
  // State options
  state?: {
    save_checkpoint: boolean;
    include_shared: boolean;
    checkpoint_type?: 'automatic' | 'manual';
  };
  
  // Response options
  response?: {
    stream: boolean;
    include_metadata: boolean;
    include_metrics: boolean;
    max_tokens?: number;
    temperature?: number;
    model?: string;
  };
  
  // Tool options
  tools?: {
    enabled: boolean;
    parallel_execution: boolean;
    timeout_ms: number;
    max_retries?: number;
    allowed_tools?: string[];
  };
  
  // Context options
  context?: {
    max_messages?: number;
    token_limit?: number;
    compression_enabled?: boolean;
    include_system_messages?: boolean;
  };
}

export interface BatchMessageRequest extends BaseRequest {
  // Multiple messages for processing
  messages: Array<{
    id: string; // Client-provided ID for correlation
    message: CreateMessageRequest['message'];
    context: CreateMessageRequest['context'];
    options?: CreateMessageRequest['options'];
  }>;
  
  // Batch options
  batch_options: {
    parallel_processing: boolean;
    stop_on_error: boolean;
    max_concurrent: number;
    timeout_ms?: number;
  };
}

export interface UpdateMessageMetadataRequest {
  metadata: Partial<MessageMetadata>;
  merge?: boolean; // If true, merge with existing metadata
}

// ============================
// Conversation Request Schemas
// ============================

export interface CreateConversationRequest extends BaseRequest {
  // Conversation setup
  title?: string;
  description?: string;
  
  // Participants
  participants: {
    user_id?: string;
    agent_id?: string;
    team_ids?: string[];
  };
  
  // Settings
  settings?: {
    context_window_size?: number;
    token_limit?: number;
    auto_summarize?: boolean;
    retention_days?: number;
  };
  
  // Initial context
  initial_context?: {
    system_message?: string;
    memories?: string[];
    files?: string[];
  };
}

export interface UpdateConversationRequest {
  title?: string;
  description?: string;
  settings?: Partial<CreateConversationRequest['settings']>;
  metadata?: Record<string, any>;
}

export interface CloseConversationRequest {
  reason?: 'completed' | 'abandoned' | 'error' | 'timeout';
  summary?: string;
  preserve_memory?: boolean;
}

// ============================
// Memory Request Schemas
// ============================

export interface CreateMemoryRequest extends BaseRequest {
  memory_type: MemoryType;
  content: Record<string, any>; // Type-specific content
  
  // Optional fields
  importance?: number;
  tags?: string[];
  source?: {
    type: 'message' | 'system' | 'user' | 'import';
    message_id?: string;
    timestamp?: string;
  };
  
  // Relationships
  related_memories?: string[];
  
  // Expiration
  expires_at?: string;
}

export interface SearchMemoriesRequest extends BaseRequest {
  // Search query
  query: string;
  
  // Filters
  filters?: {
    memory_types?: MemoryType[];
    importance_min?: number;
    created_after?: string;
    created_before?: string;
    tags?: string[];
    exclude_expired?: boolean;
  };
  
  // Search options
  options?: {
    max_results?: number;
    min_relevance?: number;
    include_embeddings?: boolean;
    group_by?: 'type' | 'tag' | 'source';
  };
}

export interface UpdateMemoryImportanceRequest {
  importance: number;
  reason?: string;
}

export interface ConsolidateMemoriesRequest extends BaseRequest {
  // Selection criteria
  criteria: {
    memory_type?: MemoryType;
    older_than?: string;
    importance_below?: number;
    access_count_below?: number;
  };
  
  // Consolidation options
  options: {
    strategy: 'merge' | 'summarize' | 'abstract';
    preserve_originals?: boolean;
    max_chunk_size?: number;
  };
}

// ============================
// State Request Schemas
// ============================

export interface UpdateStateRequest {
  // State updates
  updates: {
    local_state?: Record<string, any>;
    shared_state?: Record<string, any>;
    session_state?: Record<string, any>;
    persistent_state?: Record<string, any>;
  };
  
  // Update options
  options?: {
    merge?: boolean; // Merge vs replace
    validate?: boolean; // Validate against schema
    create_checkpoint?: boolean;
  };
}

export interface CreateCheckpointRequest extends BaseRequest {
  checkpoint_type: 'manual' | 'automatic' | 'error_recovery' | 'milestone';
  description?: string;
  
  // What to include
  include: {
    state?: boolean;
    memories?: boolean;
    context?: boolean;
  };
  
  // Retention
  retention_policy: 'temporary' | 'permanent' | 'archive';
  expires_at?: string;
}

export interface RestoreStateRequest extends BaseRequest {
  // Source of restore
  source: {
    checkpoint_id?: string;
    state_id?: string;
    timestamp?: string;
  };
  
  // What to restore
  restore: {
    state?: boolean;
    memories?: boolean;
    context?: boolean;
  };
  
  // Options
  options?: {
    preserve_current?: boolean; // Create checkpoint of current state
    merge?: boolean; // Merge vs replace
  };
}

// ============================
// Context Request Schemas
// ============================

export interface CreateContextTemplateRequest extends BaseRequest {
  name: string;
  description?: string;
  
  // Template definition
  segments: Array<{
    type: 'system' | 'memory' | 'history' | 'custom';
    priority: number;
    content?: string;
    config?: Record<string, any>;
  }>;
  
  // Variables that can be substituted
  variables?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array';
    default?: any;
    required?: boolean;
  }>;
  
  // Applicability
  use_cases?: string[];
  agent_types?: string[];
}

export interface ApplyContextTemplateRequest extends BaseRequest {
  template_id: string;
  
  // Variable substitutions
  variables?: Record<string, any>;
  
  // Options
  options?: {
    merge?: boolean; // Merge with existing context
    override_priority?: boolean;
  };
}

export interface OptimizeContextRequest extends BaseRequest {
  // Optimization goals
  goals: {
    target_tokens?: number;
    preserve_recent?: number; // Number of recent messages
    preserve_important?: boolean;
  };
  
  // Strategies
  strategies?: Array<'summarize' | 'compress' | 'remove_redundant' | 'prioritize'>;
  
  // Options
  options?: {
    preview?: boolean; // Return preview without applying
    aggressive?: boolean; // More aggressive optimization
  };
}

// ============================
// System Request Schemas
// ============================

export interface MigrateRequest extends BaseRequest {
  from_version: string;
  
  // What to migrate
  scope: {
    conversation_ids?: string[];
    agent_ids?: string[];
    user_ids?: string[];
    date_range?: {
      start: string;
      end: string;
    };
  };
  
  // Options
  options: {
    dry_run?: boolean;
    batch_size?: number;
    preserve_originals?: boolean;
  };
}

// ============================
// Query Parameters
// ============================

export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface TimeRangeParams {
  since?: string;
  until?: string;
}

export interface SortParams {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FilterParams extends PaginationParams, TimeRangeParams, SortParams {
  // Common filters
  status?: string;
  search?: string;
  tags?: string[];
}

// ============================
// Validation Helpers
// ============================

export function validateRequest<T extends BaseRequest>(
  request: any,
  schema: any
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check version
  if (!request.version || request.version !== '2.0.0') {
    errors.push(`Invalid version: ${request.version}`);
  }
  
  // Additional validation would go here
  // This is a simplified example
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================
// Request Builders
// ============================

export class RequestBuilder {
  static createMessage(
    role: MessageRole,
    content: string,
    options?: Partial<CreateMessageRequest>
  ): CreateMessageRequest {
    return {
      version: '2.0.0',
      message: {
        role,
        content: { type: 'text', text: content },
        ...options?.message,
      },
      context: options?.context || {},
      options: options?.options,
    };
  }
  
  static searchMemories(
    query: string,
    agentId: string,
    options?: Partial<SearchMemoriesRequest>
  ): SearchMemoriesRequest {
    return {
      version: '2.0.0',
      query,
      filters: options?.filters,
      options: {
        max_results: 10,
        min_relevance: 0.7,
        ...options?.options,
      },
    };
  }
}