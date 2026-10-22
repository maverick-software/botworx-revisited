// API v2 Response Schemas
// Type definitions for all API response payloads

import {
  AdvancedChatMessage,
  AgentMemory,
  AgentState,
  ContextSnapshot,
} from '../../../types/index.ts';

// ============================
// Base Response Types
// ============================

export interface BaseResponse {
  version: '2.0.0';
  status: 'success' | 'error' | 'partial';
  request_id?: string;
  timestamp: string;
}

export interface SuccessResponse<T> extends BaseResponse {
  status: 'success';
  data: T;
  metadata?: ResponseMetadata;
  links?: ResponseLinks;
}

export interface ErrorResponse extends BaseResponse {
  status: 'error';
  error: ErrorDetails;
}

export interface ResponseMetadata {
  processing_time_ms: number;
  server_version?: string;
  deprecations?: string[];
}

export interface ResponseLinks {
  self: string;
  next?: string;
  prev?: string;
  related?: Record<string, string>;
}

// ============================
// Chat Response Schemas
// ============================

export interface MessageResponse extends SuccessResponse<{
  message: AdvancedChatMessage;
  conversation: ConversationInfo;
  session: SessionInfo;
}> {
  metrics?: MessageMetrics;
  processing_details?: any;
}

export interface ConversationInfo {
  id: string;
  message_count: number;
  participant_count: number;
  created_at: string;
  updated_at: string;
  status: 'active' | 'paused' | 'closed';
}

export interface SessionInfo {
  id: string;
  active: boolean;
  duration_ms: number;
  message_count: number;
  tool_call_count: number;
}

export interface MessageMetrics {
  processing_time_ms: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
    cost_usd?: number;
  };
  model: string;
  memory_searches?: number;
  tool_executions?: number;
  context_size?: number;
  compression_ratio?: number;
}

export interface BatchMessageResponse extends SuccessResponse<{
  results: Array<{
    id: string;
    status: 'success' | 'error';
    message?: AdvancedChatMessage;
    error?: ErrorDetails;
    metrics?: MessageMetrics;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    processing_time_ms: number;
  };
}> {}

// ============================
// Streaming Response Events
// ============================

export type StreamEvent = 
  | MessageStartEvent
  | ContentDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | MessageCompleteEvent
  | ErrorEvent;

export interface MessageStartEvent {
  event: 'message_start';
  message_id: string;
  role: string;
  timestamp: string;
}

export interface ContentDeltaEvent {
  event: 'content_delta';
  delta: string;
  index: number;
  finish_reason?: 'stop' | 'length' | 'tool_calls';
}

export interface ToolCallEvent {
  event: 'tool_call';
  tool: string;
  call_id: string;
  status: 'executing' | 'completed' | 'failed';
  arguments?: Record<string, any>;
}

export interface ToolResultEvent {
  event: 'tool_result';
  tool: string;
  call_id: string;
  result?: any;
  error?: string;
}

export interface MessageCompleteEvent {
  event: 'message_complete';
  message: AdvancedChatMessage;
  metrics: MessageMetrics;
}

export interface ErrorEvent {
  event: 'error';
  error: ErrorDetails;
  recoverable: boolean;
}

// ============================
// Conversation Response Schemas
// ============================

export interface ConversationResponse extends SuccessResponse<{
  conversation: {
    id: string;
    title?: string;
    description?: string;
    participants: Array<{
      type: 'user' | 'agent' | 'team';
      id: string;
      name?: string;
      role?: string;
    }>;
    settings: {
      context_window_size: number;
      token_limit: number;
      auto_summarize: boolean;
      retention_days: number;
    };
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
    status: 'active' | 'paused' | 'closed';
  };
  stats?: {
    message_count: number;
    total_tokens: number;
    active_sessions: number;
    last_activity: string;
  };
}> {}

export interface ConversationListResponse extends SuccessResponse<{
  conversations: Array<ConversationResponse['data']['conversation']>;
  pagination: PaginationInfo;
}> {}

export interface ConversationMessagesResponse extends SuccessResponse<{
  messages: AdvancedChatMessage[];
  pagination: PaginationInfo;
  summary?: {
    total_messages: number;
    date_range: {
      start: string;
      end: string;
    };
  };
}> {}

// ============================
// Memory Response Schemas
// ============================

export interface MemoryResponse extends SuccessResponse<{
  memory: AgentMemory;
  usage?: {
    access_count: number;
    last_accessed: string;
    relevance_score?: number;
  };
}> {}

export interface MemorySearchResponse extends SuccessResponse<{
  results: Array<{
    memory: AgentMemory;
    relevance_score: number;
    highlight?: string;
  }>;
  search_metrics: {
    total_searched: number;
    processing_time_ms: number;
    strategy: string;
  };
  facets?: {
    by_type: Record<string, number>;
    by_tag: Record<string, number>;
  };
}> {}

export interface MemoryConsolidationResponse extends SuccessResponse<{
  consolidation: {
    id: string;
    source_count: number;
    result_count: number;
    tokens_saved: number;
    strategy: string;
  };
  consolidated_memories: AgentMemory[];
  removed_memories?: string[];
}> {}

// ============================
// State Response Schemas
// ============================

export interface StateResponse extends SuccessResponse<{
  state: AgentState;
  metadata: {
    version: string;
    modification_count: number;
    size_bytes: number;
    last_checkpoint?: string;
  };
}> {}

export interface CheckpointResponse extends SuccessResponse<{
  checkpoint: {
    id: string;
    agent_id: string;
    state_id: string;
    checkpoint_type: string;
    description?: string;
    size_bytes: number;
    retention_policy: string;
    expires_at?: string;
    created_at: string;
  };
}> {}

export interface StateHistoryResponse extends SuccessResponse<{
  history: Array<{
    state_id: string;
    version: string;
    valid_from: string;
    valid_until?: string;
    modification_count: number;
    trigger?: string;
  }>;
  pagination: PaginationInfo;
}> {}

// ============================
// Context Response Schemas
// ============================

export interface ContextSnapshotResponse extends SuccessResponse<{
  snapshot: ContextSnapshot;
  analysis: {
    total_tokens: number;
    segment_distribution: Record<string, number>;
    compression_opportunities: number;
  };
}> {}

export interface ContextTemplateResponse extends SuccessResponse<{
  template: {
    id: string;
    name: string;
    description?: string;
    segments: any[];
    variables: Record<string, any>;
    use_count: number;
    created_at: string;
    updated_at: string;
  };
}> {}

export interface ContextOptimizationResponse extends SuccessResponse<{
  optimization: {
    original_tokens: number;
    optimized_tokens: number;
    reduction_percentage: number;
    strategies_applied: string[];
  };
  preview?: {
    before: ContextSnapshot;
    after: ContextSnapshot;
  };
  applied: boolean;
}> {}

// ============================
// System Response Schemas
// ============================

export interface HealthResponse extends SuccessResponse<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: HealthCheck;
    vector_store: HealthCheck;
    llm_provider: HealthCheck;
    memory: HealthCheck;
  };
  version: string;
  uptime_seconds: number;
}> {}

export interface HealthCheck {
  status: 'ok' | 'warning' | 'error';
  latency_ms: number;
  message?: string;
}

export interface MigrationResponse extends SuccessResponse<{
  migration: {
    id: string;
    from_version: string;
    to_version: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    dry_run: boolean;
  };
  progress: {
    total_items: number;
    processed_items: number;
    failed_items: number;
    percentage: number;
  };
  estimated_completion?: string;
}> {}

export interface MigrationStatusResponse extends SuccessResponse<{
  status: {
    v1_active: boolean;
    v2_active: boolean;
    dual_write_enabled: boolean;
  };
  metrics: {
    v1_requests_24h: number;
    v2_requests_24h: number;
    migration_progress: number;
    total_messages: number;
    migrated_messages: number;
  };
  timeline: {
    migration_started?: string;
    estimated_completion?: string;
    deprecation_date?: string;
  };
}> {}

// ============================
// Error Response Details
// ============================

export interface ErrorDetails {
  // RFC 7807 fields
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  
  // Extensions
  error_code: ErrorCode;
  timestamp: string;
  request_id?: string;
  
  // Additional context
  extensions?: ErrorExtensions;
}

export interface ErrorExtensions {
  // Validation errors
  validation_errors?: Array<{
    field: string;
    message: string;
    code: string;
    value?: any;
  }>;
  
  // Rate limit info
  rate_limit?: {
    limit: number;
    remaining: number;
    reset: number;
    window: string;
  };
  
  // Retry info
  retry?: {
    should_retry: boolean;
    after_seconds?: number;
    max_attempts?: number;
  };
  
  // Suggested actions
  suggestions?: string[];
  
  // Help links
  documentation?: string;
  support?: string;
}

export enum ErrorCode {
  // Client errors (4xx)
  INVALID_REQUEST = 'invalid_request',
  INVALID_MESSAGE_FORMAT = 'invalid_message_format',
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  INVALID_API_VERSION = 'invalid_api_version',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  QUOTA_EXCEEDED = 'quota_exceeded',
  AUTHENTICATION_FAILED = 'authentication_failed',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  CONFLICT = 'conflict',
  PRECONDITION_FAILED = 'precondition_failed',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'internal_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  DEPENDENCY_ERROR = 'dependency_error',
  TIMEOUT = 'timeout',
  
  // Business logic errors
  AGENT_NOT_FOUND = 'agent_not_found',
  CONVERSATION_CLOSED = 'conversation_closed',
  MEMORY_LIMIT_EXCEEDED = 'memory_limit_exceeded',
  STATE_CORRUPTION = 'state_corruption',
  TOOL_EXECUTION_FAILED = 'tool_execution_failed',
  CONTEXT_TOO_LARGE = 'context_too_large',
  INVALID_MEMORY_TYPE = 'invalid_memory_type',
  CHECKPOINT_NOT_FOUND = 'checkpoint_not_found',
}

// ============================
// Pagination
// ============================

export interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
  cursor?: string;
}

// ============================
// Response Builders
// ============================

export class ResponseBuilder {
  static success<T>(data: T, metadata?: Partial<ResponseMetadata>): SuccessResponse<T> {
    return {
      version: '2.0.0',
      status: 'success',
      timestamp: new Date().toISOString(),
      data,
      metadata: {
        processing_time_ms: 0,
        ...metadata,
      },
    };
  }
  
  static error(
    code: ErrorCode,
    detail: string,
    status: number,
    extensions?: ErrorExtensions
  ): ErrorResponse {
    return {
      version: '2.0.0',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        type: `/errors/${code}`,
        title: code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status,
        detail,
        instance: '',
        error_code: code,
        timestamp: new Date().toISOString(),
        extensions,
      },
    };
  }
  
  static stream(event: StreamEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
  }
}