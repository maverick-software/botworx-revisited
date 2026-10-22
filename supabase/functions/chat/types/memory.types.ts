/**
 * Memory System Types for Advanced Chat System
 * Version: 1.0.0
 * 
 * These types define the memory architecture supporting episodic, semantic,
 * procedural, and working memory for AI agents.
 */

// ============================
// Core Memory Types
// ============================

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working';

export interface MemoryBank {
  agent_id: string;
  version: string;
  memories: {
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
    procedural: ProceduralMemory[];
    working: WorkingMemory;
  };
  indexes: MemoryIndexes;
  metadata: MemoryMetadata;
}

// ============================
// Episodic Memory
// ============================

export interface EpisodicMemory {
  id: string;
  type: 'episodic';
  content: EpisodicContent;
  temporal: TemporalInfo;
  importance: number;                  // 0.0 - 1.0
  decay_rate: number;                  // Memory decay over time
  access_count: number;
  last_accessed: string;
  embeddings?: number[];               // Vector representation
  tags?: string[];
  related_memories?: string[];         // IDs of related memories
}

export interface EpisodicContent {
  event: string;                       // What happened
  context: Record<string, any>;        // Contextual information
  participants: string[];              // User/Agent IDs involved
  outcome?: string;                    // Result or conclusion
  emotions?: EmotionalContext;
  location?: string;                   // Virtual or semantic location
}

export interface TemporalInfo {
  timestamp: string;                   // When it happened
  duration_ms?: number;                // How long it lasted
  sequence_number: number;             // Order in conversation
  time_context?: 'past' | 'present' | 'future';
}

export interface EmotionalContext {
  valence: number;                     // -1.0 to 1.0 (negative to positive)
  arousal: number;                     // 0.0 to 1.0 (calm to excited)
  dominance: number;                   // 0.0 to 1.0 (submissive to dominant)
}

// ============================
// Semantic Memory
// ============================

export interface SemanticMemory {
  id: string;
  type: 'semantic';
  content: SemanticContent;
  source: KnowledgeSource;
  embeddings?: number[];
  usage_frequency: number;
  confidence: number;                  // 0.0 - 1.0
  last_verified?: string;
  expires_at?: string;                 // For time-sensitive knowledge
}

export interface SemanticContent {
  concept: string;                     // Main concept or fact
  definition: string;                  // Detailed explanation
  relationships: Relationship[];       // Connections to other concepts
  attributes: Record<string, any>;     // Properties and characteristics
  examples?: string[];                 // Concrete examples
  category?: string;                   // Taxonomic category
}

export interface Relationship {
  type: RelationshipType;
  target_concept: string;
  strength: number;                    // 0.0 - 1.0
  bidirectional: boolean;
  context?: string;
}

export type RelationshipType = 
  | 'is_a'           // Inheritance
  | 'part_of'        // Composition
  | 'related_to'     // Association
  | 'causes'         // Causation
  | 'preceded_by'    // Temporal
  | 'located_in'     // Spatial
  | 'similar_to'     // Similarity
  | 'opposite_of'    // Opposition
  | 'used_for'       // Functional
  | 'example_of';    // Instance

export interface KnowledgeSource {
  origin: 'learned' | 'configured' | 'extracted' | 'inferred';
  references: string[];                // URLs, document IDs, etc.
  confidence: number;
  timestamp: string;
  verified: boolean;
}

// ============================
// Procedural Memory
// ============================

export interface ProceduralMemory {
  id: string;
  type: 'procedural';
  content: ProceduralContent;
  performance: PerformanceMetrics;
  optimization: OptimizationInfo;
  prerequisites?: string[];            // Required knowledge/skills
  version: number;                     // Skill version as it improves
}

export interface ProceduralContent {
  skill: string;                       // Name of the procedure
  description: string;                 // What it accomplishes
  steps: ProcedureStep[];              // Ordered steps
  parameters?: ParameterDefinition[];  // Input parameters
  outcomes: string[];                  // Expected results
  exceptions?: ExceptionHandler[];     // Error handling
}

export interface ProcedureStep {
  id: string;
  action: string;
  description: string;
  conditions?: StepCondition[];        // When to execute
  dependencies?: string[];             // Previous step IDs
  tools_required?: string[];           // Tool names needed
  estimated_duration_ms?: number;
  retry_policy?: RetryPolicy;
}

export interface StepCondition {
  type: 'if' | 'while' | 'unless';
  expression: string;                  // Condition to evaluate
  true_path?: string;                  // Next step if true
  false_path?: string;                 // Next step if false
}

export interface ParameterDefinition {
  name: string;
  type: string;
  required: boolean;
  default_value?: any;
  validation?: string;                 // Regex or validation rule
}

export interface ExceptionHandler {
  error_type: string;
  recovery_strategy: string;
  fallback_procedure?: string;         // Alternative procedure ID
}

export interface PerformanceMetrics {
  success_rate: number;                // 0.0 - 1.0
  average_duration_ms: number;
  last_execution: string;
  execution_count: number;
  failure_reasons?: Record<string, number>; // Reason -> count
}

export interface OptimizationInfo {
  learned_shortcuts: LearnedShortcut[];
  error_patterns: ErrorPattern[];
  improvement_suggestions?: string[];
}

export interface LearnedShortcut {
  condition: string;
  original_steps: string[];            // Step IDs
  optimized_action: string;
  time_saved_ms: number;
  confidence: number;
}

export interface ErrorPattern {
  pattern: string;                     // Error signature
  frequency: number;
  last_occurrence: string;
  mitigation: string;
}

export interface RetryPolicy {
  max_attempts: number;
  backoff_strategy: 'linear' | 'exponential' | 'fixed';
  initial_delay_ms: number;
  max_delay_ms?: number;
}

// ============================
// Working Memory
// ============================

export interface WorkingMemory {
  capacity: number;                    // Token limit
  usage: number;                       // Current tokens used
  items: WorkingMemoryItem[];
  priority_queue: string[];            // Ordered item IDs by priority
  compression_enabled: boolean;
  last_cleanup: string;
}

export interface WorkingMemoryItem {
  id: string;
  content: any;                        // Can be any memory type content
  type: MemoryType;
  priority: number;                    // 0.0 - 1.0
  tokens: number;                      // Size in tokens
  created_at: string;
  last_accessed: string;
  access_count: number;
  ttl?: number;                        // Time to live in seconds
  compressed?: boolean;
  original_size?: number;              // If compressed
}

// ============================
// Memory Indexes and Metadata
// ============================

export interface MemoryIndexes {
  temporal_index: TemporalIndex;
  semantic_index: SemanticIndex;
  importance_index: ImportanceIndex;
  frequency_index: FrequencyIndex;
}

export interface TemporalIndex {
  earliest_memory: string;
  latest_memory: string;
  timeline: TimelineEntry[];
}

export interface TimelineEntry {
  timestamp: string;
  memory_ids: string[];
  event_summary?: string;
}

export interface SemanticIndex {
  concepts: Record<string, string[]>;  // Concept -> Memory IDs
  embeddings_indexed: boolean;
  vector_dimension?: number;
  index_type?: 'flat' | 'hnsw' | 'ivf';
}

export interface ImportanceIndex {
  high_importance: string[];           // Memory IDs with importance > 0.8
  medium_importance: string[];         // 0.5 - 0.8
  low_importance: string[];            // < 0.5
}

export interface FrequencyIndex {
  most_accessed: string[];             // Top 10% by access count
  recently_accessed: string[];         // Accessed in last 24h
  rarely_accessed: string[];           // Bottom 10% by access count
}

export interface MemoryMetadata {
  total_memories: number;
  total_tokens: number;
  compression_ratio: number;
  last_consolidation: string;          // When memories were consolidated
  last_pruning: string;                // When old memories were removed
  version: string;
}

// ============================
// Memory Operations
// ============================

export interface MemoryQuery {
  query: string;
  memory_types?: MemoryType[];
  max_results?: number;
  similarity_threshold?: number;
  time_range?: {
    start: string;
    end: string;
  };
  importance_threshold?: number;
  include_related?: boolean;
}

export interface MemorySearchResult {
  memory_id: string;
  memory_type: MemoryType;
  relevance_score: number;
  content: any;                        // Type-specific content
  metadata: {
    created_at: string;
    importance: number;
    access_count: number;
  };
  highlights?: string[];               // Relevant excerpts
}

export interface MemoryUpdate {
  memory_id: string;
  updates: Partial<EpisodicMemory | SemanticMemory | ProceduralMemory>;
  reason: string;                      // Why the update is being made
}

export interface MemoryConsolidation {
  source_memories: string[];           // IDs to consolidate
  consolidated_memory: any;            // New consolidated memory
  consolidation_type: 'merge' | 'summarize' | 'abstract';
  tokens_saved: number;
}

// ============================
// Memory Management
// ============================

export interface MemoryPruningPolicy {
  max_age_days?: number;
  max_total_tokens?: number;
  importance_threshold?: number;
  access_threshold?: number;           // Min access count to keep
  decay_function: 'linear' | 'exponential' | 'step';
}

export interface MemoryStats {
  by_type: Record<MemoryType, {
    count: number;
    tokens: number;
    average_importance: number;
    average_access_count: number;
  }>;
  total_embeddings: number;
  index_health: {
    fragmentation: number;             // 0.0 - 1.0
    query_performance_ms: number;
    last_optimization: string;
  };
}

// ============================
// Helper Functions
// ============================

export function isValidMemoryType(type: string): type is MemoryType {
  return ['episodic', 'semantic', 'procedural', 'working'].includes(type);
}

export function calculateMemoryImportance(
  recency: number,      // 0.0 - 1.0
  frequency: number,    // 0.0 - 1.0
  utility: number       // 0.0 - 1.0
): number {
  // Weighted importance calculation
  return (recency * 0.3) + (frequency * 0.3) + (utility * 0.4);
}

export function estimateMemoryTokens(memory: any): number {
  // Rough estimation based on JSON string length
  // In production, use proper tokenizer
  const jsonString = JSON.stringify(memory);
  return Math.ceil(jsonString.length / 4);
}