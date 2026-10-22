// Context Management Module Exports
// Central export point for all context optimization functionality

export { ContextEngine } from './context_engine.ts';
export type { ContextEngineConfig } from './context_engine.ts';

export { ContextRetriever } from './context_retriever.ts';
export type {
  ContextCandidate,
  RelevanceScore,
  ConversationContext,
  RetrievalOptions,
} from './context_retriever.ts';
export { ContextSource, ContextPriority } from './context_retriever.ts';

export { ContextOptimizer } from './context_optimizer.ts';
export type {
  OptimizationResult,
  OptimizationMetrics,
} from './context_optimizer.ts';
export { OptimizationGoal } from './context_optimizer.ts';

export { ContextCompressor } from './context_compressor.ts';
export type {
  CompressionOptions,
  CompressionResult,
  CompressionTemplate,
} from './context_compressor.ts';
export { CompressionStrategy } from './context_compressor.ts';

export { ContextStructurer } from './context_structurer.ts';
export type {
  ContextWindow,
  ContextSection,
  StructuringOptions,
  ContextTemplate,
} from './context_structurer.ts';
export { StructureType } from './context_structurer.ts';