/**
 * Advanced Message Types for JSON-based Chat System
 * Version: 1.0.0
 * 
 * These types define the structure for all messages in the advanced chat system,
 * supporting comprehensive metadata, context management, and extensibility.
 */

// ============================
// Core Message Types
// ============================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AdvancedChatMessage {
  // Identification
  id: string;                          // UUID v4
  version: string;                     // Semantic versioning (e.g., "1.0.0")
  
  // Core Properties
  role: MessageRole;
  content: MessageContent;
  
  // Temporal Information
  timestamp: string;                   // ISO 8601 with timezone
  created_at: string;                  // Database timestamp
  updated_at?: string;                 // For message edits
  
  // Metadata
  metadata: MessageMetadata;
  
  // Context Information
  context: MessageContext;
  
  // Optional Components
  tools?: ToolCall[];
  memory?: MemoryReference[];
  state?: StateSnapshot;
  
  // Compliance & Audit
  audit?: AuditInformation;
}

// ============================
// Content Types
// ============================

export type ContentType = 'text' | 'structured' | 'multimodal' | 'tool_result';
export type ContentFormat = 'plain' | 'markdown' | 'html' | 'json';

export interface MessageContent {
  type: ContentType;
  text?: string;
  structured?: Record<string, any>;
  parts?: ContentPart[];
  format?: ContentFormat;
  language?: string;                   // ISO 639-1 code
}

export interface ContentPart {
  type: 'text' | 'image' | 'code' | 'data' | 'reference';
  content: string | object;
  metadata?: Record<string, any>;
}

// ============================
// Metadata Types
// ============================

export interface MessageMetadata {
  // Model Information
  model?: string;                      // e.g., "gpt-4"
  model_version?: string;
  temperature?: number;
  max_tokens?: number;
  
  // Performance Metrics
  tokens?: TokenUsage;
  latency?: LatencyMetrics;
  
  // Quality Metrics
  confidence?: number;                 // 0.0 - 1.0
  quality_score?: number;
  
  // Source Information
  source?: 'api' | 'ui' | 'automation' | 'system';
  client_id?: string;
  request_id?: string;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface LatencyMetrics {
  inference_ms: number;
  total_ms: number;
  breakdown?: {
    context_building_ms?: number;
    memory_retrieval_ms?: number;
    tool_execution_ms?: number;
  };
}

// ============================
// Context Types
// ============================

export interface MessageContext {
  // Conversation Context
  conversation_id: string;
  session_id: string;
  thread_id?: string;
  parent_message_id?: string;
  
  // User/Agent Context
  user_id?: string;
  agent_id?: string;
  workspace_id?: string;
  channel_id?: string;
  
  // Semantic Context
  intent?: string;
  topics?: string[];
  entities?: Entity[];
  sentiment?: SentimentAnalysis;
  
  // Memory Context
  relevant_memories?: string[];        // Memory IDs
  memory_score?: number;               // Relevance score
  
  // State Context
  state_version?: string;
  state_delta?: StateDelta;
  
  // Reasoning Context (Advanced Reasoning System)
  reasoning?: {
    session_id?: string;
    iterations: number;
    final_confidence: number;
    conclusion: string;
    insights: string[];
    steps: Array<{
      step: number;
      state: string;
      hypothesis?: string;
      confidence: number;
      timestamp: string;
    }>;
    critiques?: Array<{
      type: string;
      severity: number;
      description: string;
      suggestion: string;
    }>;
    alternative_perspectives?: Array<{
      perspective: string;
      reasoning: string;
      confidence: number;
      supporting_points: string[];
    }>;
    reconsideration_cycles?: number;
    reasoning_style?: 'inductive' | 'deductive' | 'abductive' | 'analogical' | 'causal' | 'probabilistic';
  };
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
  position?: {
    start: number;
    end: number;
  };
}

export interface SentimentAnalysis {
  score: number;                       // -1.0 to 1.0
  magnitude: number;                   // 0.0 to 1.0
  label: 'positive' | 'negative' | 'neutral' | 'mixed';
}

// ============================
// Tool Types
// ============================

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string | Record<string, any>;
  };
  status?: 'pending' | 'executing' | 'completed' | 'failed';
  result?: ToolResult;
}

export interface ToolResult {
  success: boolean;
  output?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  execution_time_ms: number;
}

// ============================
// Memory Reference Types
// ============================

export interface MemoryReference {
  memory_id: string;
  memory_type: 'episodic' | 'semantic' | 'procedural';
  relevance_score: number;
  context?: string;                    // How this memory relates to current message
}

// ============================
// State Types
// ============================

export interface StateSnapshot {
  version: string;
  timestamp: string;
  checksum: string;
  data: Record<string, any>;
}

export interface StateDelta {
  previous_version: string;
  new_version: string;
  changes: StateChange[];
}

export interface StateChange {
  path: string;                        // JSON path to changed field
  operation: 'add' | 'update' | 'delete';
  previous_value?: any;
  new_value?: any;
}

// ============================
// Audit Types
// ============================

export interface AuditInformation {
  action: string;
  actor: {
    type: 'user' | 'agent' | 'system';
    id: string;
    name?: string;
  };
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  compliance_flags?: string[];         // e.g., ['gdpr', 'hipaa']
}

// ============================
// Request/Response Types
// ============================

export interface ChatRequestV2 {
  version: '2.0.0';
  message: Partial<AdvancedChatMessage>;
  // Top-level context for routing and retrieval
  context?: {
    conversation_id?: string;
    session_id?: string;
    agent_id?: string;
    channel_id?: string;
    workspace_id?: string;
    user_id?: string;
  };

  options?: ChatOptions;
  
  // Optional request identifier
  request_id?: string;
}

export interface ChatOptions {
  // Memory Options
  memory?: MemoryOptions;
  
  // State Options
  state?: StateOptions;
  
  // Context Options
  context?: ContextOptions;
  
  // Response Options
  response?: ResponseOptions;
}

export interface MemoryOptions {
  retrieve: boolean;
  store: boolean;
  types: ('episodic' | 'semantic' | 'procedural')[];
  max_results: number;
  similarity_threshold?: number;
}

export interface StateOptions {
  include_previous: boolean;
  checkpoint: boolean;
  merge_strategy: 'override' | 'merge' | 'append';
}

export interface ContextOptions {
  window_size: number;
  compression_enabled: boolean;
  include_tools: boolean;
  include_knowledge: boolean;
  priority_hints?: string[];           // Hints for context prioritization
}

export interface ResponseOptions {
  format: 'json' | 'text' | 'structured';
  include_metadata: boolean;
  include_reasoning: boolean;
  stream: boolean;
  max_tokens?: number;
}

export interface ChatResponseV2 {
  version: '2.0.0';
  message: AdvancedChatMessage;
  
  // Performance Metrics
  metrics: PerformanceMetrics;
  
  // Memory Updates
  memory_updates?: MemoryUpdateInfo;
  
  // State Changes
  state_delta?: StateDelta;
  
  // Debugging Information
  debug?: DebugInfo;
  
  // Error Information (if applicable)
  error?: ErrorInfo;
}

export interface PerformanceMetrics {
  total_duration_ms: number;
  llm_duration_ms: number;
  memory_retrieval_ms: number;
  state_sync_ms: number;
  tool_execution_ms?: number;
}

export interface MemoryUpdateInfo {
  created: string[];                   // New memory IDs
  updated: string[];                   // Updated memory IDs
  relevance_scores: Record<string, number>;
}

export interface DebugInfo {
  context_size: number;
  compression_ratio: number;
  memory_hits: number;
  tool_calls: number;
  truncated_content?: boolean;
}

export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  recovery_suggestions?: string[];
}

// ============================
// Validation Helpers
// ============================

export const MESSAGE_SCHEMA_VERSION = '1.0.0';

export function isValidMessageRole(role: string): role is MessageRole {
  return ['system', 'user', 'assistant', 'tool'].includes(role);
}

export function isValidContentType(type: string): type is ContentType {
  return ['text', 'structured', 'multimodal', 'tool_result'].includes(type);
}

export function createEmptyMessage(role: MessageRole): Partial<AdvancedChatMessage> {
  return {
    id: '', // Should be generated
    version: MESSAGE_SCHEMA_VERSION,
    role,
    content: {
      type: 'text',
      text: ''
    },
    metadata: {},
    context: {
      conversation_id: '',
      session_id: ''
    }
  };
}