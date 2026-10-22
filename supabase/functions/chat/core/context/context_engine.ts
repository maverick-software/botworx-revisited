// Context Engine - Advanced Context Optimization
// Intelligently selects, prioritizes, compresses, and structures context for optimal AI model performance

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import {
  ContextRetriever,
  ContextCandidate,
  ConversationContext,
  ContextSource,
  ContextPriority,
} from './context_retriever.ts';
import { ContextOptimizer, OptimizationGoal } from './context_optimizer.ts';
import { ContextCompressor } from './context_compressor.ts';
import { ContextStructurer, ContextWindow, StructureType } from './context_structurer.ts';

// Generate timestamp utility
function generateTimestamp(): string {
  return new Date().toISOString();
}

export interface ContextEngineConfig {
  default_token_budget: number;
  max_candidates: number;
  relevance_threshold: number;
  compression_enabled: boolean;
  caching_enabled: boolean;
  monitoring_enabled: boolean;
}

export interface ContextBuildRequest {
  query: string;
  conversation_context: ConversationContext;
  token_budget?: number;
  optimization_goals?: OptimizationGoal[];
  priority_overrides?: Record<string, ContextPriority>;
  required_sources?: ContextSource[];
  excluded_sources?: ContextSource[];
}

export interface OptimizedContext {
  context_window: ContextWindow;
  total_tokens: number;
  budget_utilization: number;
  quality_score: number;
  sources_used: ContextSource[];
  compression_applied: boolean;
  build_time_ms: number;
  metadata: ContextMetadata;
}

export interface ContextMetadata {
  build_timestamp: string;
  retrieval_strategy: string;
  compression_ratio?: number;
  cache_hits: number;
  cache_misses: number;
  quality_metrics: ContextQualityMetrics;
}

export interface ContextQualityMetrics {
  relevance_score: number;
  coherence_score: number;
  completeness_score: number;
  diversity_score: number;
  freshness_score: number;
  token_efficiency: number;
}

export class ContextEngine {
  private retriever: ContextRetriever;
  private optimizer: ContextOptimizer;
  private compressor: ContextCompressor;
  private structurer: ContextStructurer;
  private cache: Map<string, OptimizedContext> = new Map();
  
  constructor(
    private supabase: SupabaseClient,
    private config: ContextEngineConfig = {
      default_token_budget: 32000,
      max_candidates: 100,
      relevance_threshold: 0.3,
      compression_enabled: true,
      caching_enabled: true,
      monitoring_enabled: true,
    }
  ) {
    this.retriever = new ContextRetriever(this.supabase);
    this.optimizer = new ContextOptimizer();
    this.compressor = new ContextCompressor();
    this.structurer = new ContextStructurer();
  }
  
  async buildContext(request: ContextBuildRequest): Promise<OptimizedContext> {
    const startTime = Date.now();
    const tokenBudget = request.token_budget || this.config.default_token_budget;
    
    try {
      // Check cache first
      if (this.config.caching_enabled) {
        const cacheKey = this.generateCacheKey(request);
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return {
            ...cached,
            build_time_ms: Date.now() - startTime,
            metadata: {
              ...cached.metadata,
              cache_hits: 1,
              cache_misses: 0,
            },
          };
        }
      }
      
      // 1. Retrieve candidate contexts from all sources
      const candidates = await this.retriever.retrieveAll(
        request.query,
        request.conversation_context,
        {
          max_candidates: this.config.max_candidates,
          required_sources: request.required_sources,
          excluded_sources: request.excluded_sources,
          relevance_threshold: this.config.relevance_threshold,
        }
      );
      
      // 2. Optimize selection within token budget
      const selectedCandidates = await this.optimizer.selectOptimal(
        candidates,
        tokenBudget,
        request.optimization_goals || [OptimizationGoal.BALANCE_ALL]
      );
      
      // 3. Apply compression if needed
      let finalCandidates = selectedCandidates;
      let compressionApplied = false;
      
      if (this.config.compression_enabled && this.needsCompression(selectedCandidates, tokenBudget)) {
        finalCandidates = await this.compressor.compress(selectedCandidates, tokenBudget);
        compressionApplied = true;
      }
      
      // 4. Structure context for model consumption
      const contextWindow = await this.structurer.structure(
        finalCandidates,
        request.conversation_context,
        {
          structure_type: StructureType.OPTIMIZED,
          include_metadata: false,
          add_section_markers: false,
        }
      );
      
      // 5. Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(contextWindow, finalCandidates);
      
      // 6. Build optimized context result
      const optimizedContext: OptimizedContext = {
        context_window: contextWindow,
        total_tokens: contextWindow.total_tokens,
        budget_utilization: contextWindow.total_tokens / tokenBudget,
        quality_score: this.calculateOverallQuality(qualityMetrics),
        sources_used: this.extractSourcesUsed(finalCandidates),
        compression_applied: compressionApplied,
        build_time_ms: Date.now() - startTime,
        metadata: {
          build_timestamp: generateTimestamp(),
          retrieval_strategy: 'multi_source_hybrid',
          compression_ratio: compressionApplied ? this.calculateCompressionRatio(selectedCandidates, finalCandidates) : undefined,
          cache_hits: 0,
          cache_misses: 1,
          quality_metrics: qualityMetrics,
        },
      };
      
      // 7. Cache result
      if (this.config.caching_enabled) {
        const cacheKey = this.generateCacheKey(request);
        this.cache.set(cacheKey, optimizedContext);
        
        // Simple cache size management
        if (this.cache.size > 100) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }
      
      // 8. Monitor and log
      if (this.config.monitoring_enabled) {
        await this.logContextBuild(request, optimizedContext);
      }
      
      return optimizedContext;
      
    } catch (error) {
      console.error('Context build failed:', error);
      return this.buildFallbackContext(request, startTime);
    }
  }
  
  private needsCompression(candidates: ContextCandidate[], tokenBudget: number): boolean {
    const totalTokens = candidates.reduce((sum, c) => sum + c.token_count, 0);
    return totalTokens > tokenBudget * 0.9;
  }
  
  private calculateQualityMetrics(
    contextWindow: ContextWindow,
    candidates: ContextCandidate[]
  ): ContextQualityMetrics {
    const relevanceScore = candidates.length > 0 
      ? candidates.reduce((sum, c) => sum + c.relevance.composite_score, 0) / candidates.length
      : 0;
    
    const freshnessScore = candidates.length > 0
      ? candidates.reduce((sum, c) => sum + c.relevance.temporal_relevance, 0) / candidates.length
      : 0;
    
    return {
      relevance_score: relevanceScore,
      coherence_score: 0.8, // Simplified
      completeness_score: Math.min(candidates.length / 10, 1.0), // Based on number of sources
      diversity_score: this.calculateDiversityScore(candidates),
      freshness_score: freshnessScore,
      token_efficiency: this.calculateTokenEfficiency(contextWindow, candidates),
    };
  }
  
  private calculateOverallQuality(metrics: ContextQualityMetrics): number {
    return (
      metrics.relevance_score * 0.3 +
      metrics.coherence_score * 0.2 +
      metrics.completeness_score * 0.2 +
      metrics.diversity_score * 0.1 +
      metrics.freshness_score * 0.1 +
      metrics.token_efficiency * 0.1
    );
  }
  
  private extractSourcesUsed(candidates: ContextCandidate[]): ContextSource[] {
    const sources = new Set<ContextSource>();
    candidates.forEach(c => sources.add(c.source));
    return Array.from(sources);
  }
  
  private calculateCompressionRatio(original: ContextCandidate[], compressed: ContextCandidate[]): number {
    const originalTokens = original.reduce((sum, c) => sum + c.token_count, 0);
    const compressedTokens = compressed.reduce((sum, c) => sum + c.token_count, 0);
    return originalTokens > 0 ? compressedTokens / originalTokens : 1;
  }
  
  private calculateDiversityScore(candidates: ContextCandidate[]): number {
    const sources = new Set(candidates.map(c => c.source));
    return Math.min(sources.size / 4, 1.0); // Normalize by max expected sources
  }
  
  private calculateTokenEfficiency(contextWindow: ContextWindow, candidates: ContextCandidate[]): number {
    const avgRelevance = candidates.length > 0
      ? candidates.reduce((sum, c) => sum + c.relevance.composite_score, 0) / candidates.length
      : 0;
    
    const tokenDensity = contextWindow.total_tokens > 0 ? avgRelevance / Math.log(contextWindow.total_tokens) : 0;
    return Math.min(tokenDensity, 1.0);
  }
  
  private generateCacheKey(request: ContextBuildRequest): string {
    return `${request.query}_${request.conversation_context.agent_id}_${request.token_budget || this.config.default_token_budget}`;
  }
  
  private async logContextBuild(request: ContextBuildRequest, result: OptimizedContext): Promise<void> {
    try {
      await this.supabase
        .from('context_build_logs')
        .insert({
          agent_id: request.conversation_context.agent_id,
          conversation_id: request.conversation_context.conversation_id,
          query: request.query,
          token_budget: request.token_budget || this.config.default_token_budget,
          tokens_used: result.total_tokens,
          quality_score: result.quality_score,
          build_time_ms: result.build_time_ms,
          sources_used: result.sources_used,
          compression_applied: result.compression_applied,
          created_at: generateTimestamp(),
        });
    } catch (error) {
      console.error('Failed to log context build:', error);
    }
  }
  
  private buildFallbackContext(request: ContextBuildRequest, startTime: number): OptimizedContext {
    const recentMessages = request.conversation_context.recent_messages || [];
    const fallbackContent = recentMessages
      .slice(-3)
      .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n') || 'No recent conversation history available.';
    
    const contextWindow = this.structurer.createFallbackContext(fallbackContent);
    
    return {
      context_window: contextWindow,
      total_tokens: contextWindow.total_tokens,
      budget_utilization: contextWindow.total_tokens / (request.token_budget || this.config.default_token_budget),
      quality_score: 0.3,
      sources_used: [ContextSource.CONVERSATION_HISTORY],
      compression_applied: false,
      build_time_ms: Date.now() - startTime,
      metadata: {
        build_timestamp: generateTimestamp(),
        retrieval_strategy: 'fallback',
        cache_hits: 0,
        cache_misses: 0,
        quality_metrics: {
          relevance_score: 0.5,
          coherence_score: 0.7,
          completeness_score: 0.2,
          diversity_score: 0.1,
          freshness_score: 0.9,
          token_efficiency: 0.6,
        },
      },
    };
  }
}