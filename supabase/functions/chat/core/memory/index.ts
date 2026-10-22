// Memory Module Exports
// Central export point for all memory management functionality

export { MemoryManager } from './memory_manager.ts';
export { MemoryFactory } from './memory_factory.ts';
export { EpisodicMemoryManager } from './episodic_memory.ts';
export { SemanticMemoryManager } from './semantic_memory.ts';
export { MemoryConsolidationManager } from './memory_consolidation.ts';

// Export interfaces and types
export type {
  MemoryQuery,
  MemorySearchResult,
  ConsolidationCriteria,
  ConsolidationResult,
  DecayResult,
} from './memory_manager.ts';

export type {
  ToolResult,
  ConversationSummary,
  DetectedPattern,
  MemoryCreationOptions,
} from './memory_factory.ts';

export type {
  EpisodicQuery,
  ConversationThread,
  MemoryTimeline,
} from './episodic_memory.ts';

export type {
  ConceptRelationship,
  KnowledgeGraph,
  ConceptQuery,
  KnowledgeExtraction,
} from './semantic_memory.ts';

export type {
  ConsolidationStrategy,
  ConsolidationTrigger,
  ConsolidationRule,
  ConsolidationJob,
  ConsolidationMetrics,
} from './memory_consolidation.ts';