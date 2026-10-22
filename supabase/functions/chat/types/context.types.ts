/**
 * Context Management Types for Advanced Chat System
 * Version: 1.0.0
 * 
 * These types define the context window management, optimization,
 * and compression strategies for efficient token usage.
 */

import { MemoryType } from './memory.types.ts';
import { MessageRole } from './message.types.ts';

// ============================
// Core Context Types
// ============================

export interface ContextWindow {
  // Window Configuration
  max_tokens: number;
  current_tokens: number;
  compression_ratio: number;
  
  // Content Organization
  segments: ContextSegment[];
  priority_scores: Record<string, number>;
  
  // Optimization Metrics
  relevance_threshold: number;
  diversity_score: number;
  coherence_score: number;
  
  // Meta Information
  created_at: string;
  last_optimized: string;
  optimization_count: number;
}

export interface ContextSegment {
  id: string;
  type: ContextSegmentType;
  content: any;
  
  // Metrics
  tokens: number;
  priority: number;                    // 0.0 - 1.0
  relevance: number;                   // 0.0 - 1.0
  recency: number;                     // 0.0 - 1.0
  
  // Compression
  compressed: boolean;
  compression_method?: CompressionMethod;
  original_tokens?: number;
  
  // Metadata
  source?: string;                     // Where this segment came from
  dependencies?: string[];             // Other segment IDs this depends on
  can_be_removed?: boolean;
  lock_in_context?: boolean;           // Prevent removal during optimization
}

export type ContextSegmentType = 
  | 'system_instruction'
  | 'memory'
  | 'conversation_history'
  | 'tool_definition'
  | 'knowledge'
  | 'state'
  | 'user_input'
  | 'workspace_context';

export type CompressionMethod = 
  | 'summary'
  | 'extraction'
  | 'encoding'
  | 'reference'
  | 'hybrid';

// ============================
// Context Building
// ============================

export interface ContextBuilderConfig {
  // Size Constraints
  max_tokens: number;
  reserved_tokens: number;             // Reserved for response
  
  // Content Priorities
  priorities: ContextPriorities;
  
  // Optimization Settings
  optimization: OptimizationSettings;
  
  // Compression Settings
  compression: CompressionSettings;
}

export interface ContextPriorities {
  system_instructions: number;         // 0.0 - 1.0
  recent_messages: number;
  relevant_memories: number;
  tool_definitions: number;
  workspace_context: number;
  state_information: number;
  knowledge_base: number;
}

export interface OptimizationSettings {
  strategy: OptimizationStrategy;
  relevance_algorithm: 'cosine' | 'semantic' | 'hybrid';
  diversity_weight: number;            // 0.0 - 1.0
  recency_decay: number;               // Decay factor for older content
  deduplication: boolean;
  clustering: boolean;
}

export type OptimizationStrategy = 
  | 'greedy'                          // Highest priority first
  | 'balanced'                        // Balance all factors
  | 'adaptive'                        // Adapt based on conversation
  | 'user_focused'                    // Prioritize user needs
  | 'task_oriented';                  // Focus on current task

export interface CompressionSettings {
  enabled: boolean;
  auto_compress_threshold: number;     // Token count to trigger compression
  methods: CompressionMethod[];
  quality_threshold: number;           // Min quality after compression
  preserve_keywords: boolean;
  preserve_entities: boolean;
}

// ============================
// Context Components
// ============================

export interface SystemContext {
  instructions: SystemInstruction[];
  personality?: PersonalityContext;
  capabilities?: CapabilityContext;
  constraints?: ConstraintContext;
}

export interface SystemInstruction {
  content: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  mutable: boolean;                    // Can be modified by learning
}

export interface PersonalityContext {
  traits: Record<string, number>;      // Trait name -> strength (0.0-1.0)
  communication_style: string;
  example_responses?: string[];
}

export interface CapabilityContext {
  available_tools: string[];
  skill_levels: Record<string, number>;
  learned_capabilities: string[];
  restrictions?: string[];
}

export interface ConstraintContext {
  ethical_guidelines: string[];
  legal_constraints: string[];
  business_rules: string[];
  security_policies: string[];
}

export interface ConversationContext {
  history: ConversationEntry[];
  current_turn: number;
  conversation_style: string;
  detected_intent?: string;
  topic_progression: TopicNode[];
}

export interface ConversationEntry {
  turn_number: number;
  role: MessageRole;
  content: string;
  timestamp: string;
  tokens: number;
  importance: number;                  // For selective history
  can_summarize: boolean;
  summary?: string;                    // If summarized
}

export interface TopicNode {
  topic: string;
  start_turn: number;
  end_turn?: number;
  subtopics?: TopicNode[];
  importance: number;
}

export interface MemoryContext {
  retrieved_memories: RetrievedMemory[];
  memory_summary?: string;
  total_memories_found: number;
  retrieval_strategy: string;
}

export interface RetrievedMemory {
  memory_id: string;
  memory_type: MemoryType;
  content: any;                        // Memory-specific content
  relevance_score: number;
  included_in_context: boolean;
  reason_for_inclusion?: string;
  compressed_representation?: string;
}

export interface ToolContext {
  available_tools: ToolDefinition[];
  recently_used_tools: string[];
  tool_preferences?: ToolPreference[];
  execution_history?: ToolExecution[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required_parameters: string[];
  token_cost: number;                  // Tokens needed for definition
  priority: number;
  category?: string;
}

export interface ToolPreference {
  tool_name: string;
  preference_score: number;            // 0.0 - 1.0
  conditions?: string[];               // When to prefer this tool
}

export interface ToolExecution {
  tool_name: string;
  execution_time: string;
  success: boolean;
  tokens_used: number;
}

export interface KnowledgeContext {
  facts: KnowledgeFact[];
  definitions: KnowledgeDefinition[];
  rules: KnowledgeRule[];
  total_tokens: number;
}

export interface KnowledgeFact {
  fact: string;
  confidence: number;
  source: string;
  relevance: number;
  tokens: number;
}

export interface KnowledgeDefinition {
  term: string;
  definition: string;
  context_specific: boolean;
  tokens: number;
}

export interface KnowledgeRule {
  rule: string;
  conditions: string[];
  priority: number;
  tokens: number;
}

// ============================
// Context Optimization
// ============================

export interface ContextOptimizer {
  optimize(window: ContextWindow): OptimizedContext;
  compress(segment: ContextSegment): CompressedSegment;
  prioritize(segments: ContextSegment[]): ContextSegment[];
  deduplicate(segments: ContextSegment[]): ContextSegment[];
}

export interface OptimizedContext {
  window: ContextWindow;
  optimization_report: OptimizationReport;
  quality_metrics: QualityMetrics;
}

export interface OptimizationReport {
  original_tokens: number;
  optimized_tokens: number;
  compression_ratio: number;
  segments_removed: number;
  segments_compressed: number;
  time_taken_ms: number;
  strategies_applied: string[];
}

export interface QualityMetrics {
  information_retention: number;       // 0.0 - 1.0
  coherence_score: number;
  relevance_score: number;
  diversity_score: number;
  completeness_score: number;
}

export interface CompressedSegment extends ContextSegment {
  compression_report: CompressionReport;
  decompression_strategy?: string;
  quality_score: number;
}

export interface CompressionReport {
  original_content: string;
  compressed_content: string;
  method_used: CompressionMethod;
  tokens_saved: number;
  information_loss: number;            // 0.0 - 1.0
  key_points_preserved: string[];
}

// ============================
// Context Strategies
// ============================

export interface CompressionStrategy {
  method: CompressionMethod;
  settings: CompressionStrategySettings;
  
  // Functions
  compress: (content: string) => CompressedContent;
  decompress?: (compressed: CompressedContent) => string;
  estimateQuality: (original: string, compressed: string) => number;
}

export interface CompressionStrategySettings {
  target_ratio: number;                // Target compression ratio
  quality_threshold: number;           // Min acceptable quality
  preserve_entities: boolean;
  preserve_keywords: string[];
  preserve_structure: boolean;
  max_iterations: number;              // For iterative compression
}

export interface CompressedContent {
  content: string;
  method: CompressionMethod;
  ratio: number;
  metadata?: Record<string, any>;
}

export interface SelectionStrategy {
  name: string;
  description: string;
  
  select: (
    segments: ContextSegment[],
    limit: number
  ) => ContextSegment[];
  
  score: (segment: ContextSegment) => number;
}

export interface PrioritizationStrategy {
  name: string;
  
  prioritize: (
    segments: ContextSegment[],
    context: PrioritizationContext
  ) => ContextSegment[];
}

export interface PrioritizationContext {
  user_intent?: string;
  current_task?: string;
  conversation_phase?: string;
  user_preferences?: Record<string, any>;
  historical_importance?: Record<string, number>;
}

// ============================
// Context Templates
// ============================

export interface ContextTemplate {
  name: string;
  description: string;
  segments: TemplateSegment[];
  total_tokens: number;
  use_cases: string[];
}

export interface TemplateSegment {
  type: ContextSegmentType;
  content_template: string;
  variables: TemplateVariable[];
  optional: boolean;
  conditions?: string[];               // When to include
}

export interface TemplateVariable {
  name: string;
  type: string;
  source: string;                      // Where to get the value
  default_value?: any;
  transformer?: (value: any) => any;
}

// ============================
// Context Analytics
// ============================

export interface ContextAnalytics {
  usage_patterns: UsagePattern[];
  optimization_history: OptimizationEvent[];
  performance_metrics: ContextPerformanceMetrics;
  recommendations: ContextRecommendation[];
}

export interface UsagePattern {
  pattern_type: string;
  frequency: number;
  segments_involved: string[];
  average_tokens: number;
  success_correlation: number;
}

export interface OptimizationEvent {
  timestamp: string;
  trigger: string;
  before_tokens: number;
  after_tokens: number;
  quality_impact: number;
  strategies_used: string[];
}

export interface ContextPerformanceMetrics {
  average_tokens_used: number;
  compression_effectiveness: number;
  relevance_accuracy: number;
  optimization_frequency: number;
  cache_hit_rate: number;
}

export interface ContextRecommendation {
  type: 'compression' | 'prioritization' | 'caching' | 'restructuring';
  description: string;
  expected_improvement: number;
  implementation_effort: 'low' | 'medium' | 'high';
}

// ============================
// Helper Functions
// ============================

export function calculateSegmentPriority(
  segment: ContextSegment,
  weights: {
    relevance: number;
    recency: number;
    importance: number;
  }
): number {
  return (
    segment.relevance * weights.relevance +
    segment.recency * weights.recency +
    segment.priority * weights.importance
  ) / (weights.relevance + weights.recency + weights.importance);
}

export function estimateTokens(content: string): number {
  // Rough estimation - replace with proper tokenizer
  return Math.ceil(content.length / 4);
}

export function createContextWindow(maxTokens: number): ContextWindow {
  return {
    max_tokens: maxTokens,
    current_tokens: 0,
    compression_ratio: 1.0,
    segments: [],
    priority_scores: {},
    relevance_threshold: 0.5,
    diversity_score: 0.0,
    coherence_score: 1.0,
    created_at: new Date().toISOString(),
    last_optimized: new Date().toISOString(),
    optimization_count: 0
  };
}

// ============================
// Compression Implementations
// ============================

export interface SummaryCompressor {
  summarize(text: string, targetRatio: number): string;
  extractKeyPoints(text: string, maxPoints: number): string[];
  generateAbstract(text: string, maxLength: number): string;
}

export interface ExtractionCompressor {
  extractEntities(text: string): string[];
  extractKeywords(text: string, count: number): string[];
  extractMainIdea(text: string): string;
}

export interface ReferenceCompressor {
  createReference(content: any): string;
  resolveReference(reference: string): any;
  isResolvable(reference: string): boolean;
}