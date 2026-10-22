// Memory Consolidation System
// Handles automatic consolidation, cleanup, and optimization of agent memories

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import {
  AgentMemory,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  WorkingMemory,
  MemoryType,
} from '../../types/memory.types.ts';
import { EpisodicMemoryManager } from './episodic_memory.ts';
import { SemanticMemoryManager } from './semantic_memory.ts';
import { generateTimestamp, generateMemoryId } from '../../types/utils.ts';

// ============================
// Interfaces
// ============================

export interface ConsolidationStrategy {
  name: string;
  description: string;
  triggers: ConsolidationTrigger[];
  rules: ConsolidationRule[];
  priority: number;
}

export interface ConsolidationTrigger {
  type: 'memory_count' | 'time_based' | 'similarity' | 'importance' | 'manual';
  condition: any;
  threshold: number;
}

export interface ConsolidationRule {
  source_types: MemoryType[];
  target_type: MemoryType;
  method: 'merge' | 'summarize' | 'abstract' | 'hierarchical';
  conditions: {
    min_similarity?: number;
    min_age_hours?: number;
    max_importance?: number;
    min_access_count?: number;
  };
}

export interface ConsolidationJob {
  id: string;
  agent_id: string;
  strategy: ConsolidationStrategy;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  memories_processed: number;
  memories_consolidated: number;
  memories_removed: number;
  error_message?: string;
  result_summary: string;
}

export interface ConsolidationMetrics {
  total_memories_before: number;
  total_memories_after: number;
  consolidation_ratio: number;
  storage_saved_bytes: number;
  processing_time_ms: number;
  strategies_applied: string[];
  errors_encountered: number;
}

// ============================
// Memory Consolidation Manager
// ============================

export class MemoryConsolidationManager {
  private strategies: Map<string, ConsolidationStrategy> = new Map();
  
  constructor(
    private supabase: SupabaseClient,
    private episodicManager: EpisodicMemoryManager,
    private semanticManager: SemanticMemoryManager | null
  ) {
    this.initializeDefaultStrategies();
  }
  
  /**
   * Run consolidation for an agent
   */
  async consolidateAgent(
    agent_id: string,
    options: {
      strategy_names?: string[];
      force_run?: boolean;
      max_processing_time_ms?: number;
    } = {}
  ): Promise<ConsolidationMetrics> {
    const startTime = Date.now();
    const maxTime = options.max_processing_time_ms || 300000; // 5 minutes default
    
    // Get current memory statistics
    const beforeStats = await this.getMemoryStatistics(agent_id);
    
    // Determine which strategies to run
    const strategiesToRun = options.strategy_names 
      ? options.strategy_names.map(name => this.strategies.get(name)!).filter(Boolean)
      : await this.selectStrategies(agent_id, options.force_run);
    
    const appliedStrategies: string[] = [];
    let errorsEncountered = 0;
    
    // Run each strategy
    for (const strategy of strategiesToRun) {
      const remainingTime = maxTime - (Date.now() - startTime);
      if (remainingTime <= 0) {
        console.warn(`Consolidation timeout reached for agent ${agent_id}`);
        break;
      }
      
      const job = await this.createJob(agent_id, strategy);
      
      try {
        await this.executeStrategy(job, remainingTime);
        appliedStrategies.push(strategy.name);
      } catch (error) {
        console.error(`Strategy ${strategy.name} failed for agent ${agent_id}:`, error);
        errorsEncountered++;
        
        await this.updateJob(job.id, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    // Get final statistics
    const afterStats = await this.getMemoryStatistics(agent_id);
    const processingTime = Date.now() - startTime;
    
    return {
      total_memories_before: beforeStats.total_count,
      total_memories_after: afterStats.total_count,
      consolidation_ratio: beforeStats.total_count > 0 
        ? (beforeStats.total_count - afterStats.total_count) / beforeStats.total_count
        : 0,
      storage_saved_bytes: beforeStats.estimated_size - afterStats.estimated_size,
      processing_time_ms: processingTime,
      strategies_applied: appliedStrategies,
      errors_encountered: errorsEncountered,
    };
  }
  
  /**
   * Schedule automatic consolidation
   */
  async scheduleConsolidation(
    agent_id: string,
    schedule: 'hourly' | 'daily' | 'weekly' | 'on_threshold'
  ): Promise<void> {
    // In a production system, this would integrate with a job scheduler
    // For now, we'll store the schedule preference
    
    await this.supabase
      .from('agent_settings')
      .upsert({
        agent_id,
        setting_key: 'consolidation_schedule',
        setting_value: { schedule, enabled: true },
        updated_at: generateTimestamp(),
      });
  }
  
  /**
   * Check if consolidation is needed
   */
  async checkConsolidationNeeded(agent_id: string): Promise<{
    needed: boolean;
    urgency: 'low' | 'medium' | 'high';
    reasons: string[];
    recommended_strategies: string[];
  }> {
    const stats = await this.getMemoryStatistics(agent_id);
    const reasons: string[] = [];
    const recommendedStrategies: string[] = [];
    let urgency: 'low' | 'medium' | 'high' = 'low';
    
    // Check memory count thresholds
    if (stats.total_count > 1000) {
      reasons.push('High memory count');
      recommendedStrategies.push('episodic_temporal_compression');
      urgency = 'high';
    } else if (stats.total_count > 500) {
      reasons.push('Moderate memory count');
      recommendedStrategies.push('semantic_concept_merging');
      urgency = 'medium';
    }
    
    // Check for old, low-importance memories
    const oldMemoryCount = await this.countOldMemories(agent_id, 30); // 30 days
    if (oldMemoryCount > 100) {
      reasons.push('Many old memories');
      recommendedStrategies.push('low_importance_cleanup');
      urgency = urgency === 'low' ? 'medium' : urgency;
    }
    
    // Check for similar memories
    const duplicateGroups = await this.findDuplicateGroups(agent_id);
    if (duplicateGroups.length > 10) {
      reasons.push('Similar memories detected');
      recommendedStrategies.push('similarity_based_merging');
      urgency = urgency === 'low' ? 'medium' : urgency;
    }
    
    // Check working memory overflow
    const workingMemories = await this.getWorkingMemoryCount(agent_id);
    if (workingMemories > 20) {
      reasons.push('Working memory overflow');
      recommendedStrategies.push('working_memory_consolidation');
      urgency = 'high';
    }
    
    return {
      needed: reasons.length > 0,
      urgency,
      reasons,
      recommended_strategies: [...new Set(recommendedStrategies)],
    };
  }
  
  /**
   * Get consolidation history
   */
  async getConsolidationHistory(
    agent_id: string,
    limit: number = 10
  ): Promise<ConsolidationJob[]> {
    const { data, error } = await this.supabase
      .from('consolidation_jobs')
      .select('*')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to fetch consolidation history: ${error.message}`);
    }
    
    return (data || []) as ConsolidationJob[];
  }
  
  /**
   * Manually trigger specific consolidation
   */
  async manualConsolidation(
    agent_id: string,
    memory_ids: string[],
    method: 'merge' | 'summarize' | 'abstract' = 'merge'
  ): Promise<{
    success: boolean;
    consolidated_memory_id?: string;
    error?: string;
  }> {
    try {
      // Fetch memories
      const { data: memories, error } = await this.supabase
        .from('agent_memories')
        .select('*')
        .in('id', memory_ids);
      
      if (error || !memories) {
        throw new Error(`Failed to fetch memories: ${error?.message}`);
      }
      
      // Group by type
      const episodic = memories.filter(m => m.memory_type === 'episodic') as EpisodicMemory[];
      const semantic = memories.filter(m => m.memory_type === 'semantic') as SemanticMemory[];
      
      let consolidatedId: string | undefined;
      
      // Apply method based on memory types
      if (episodic.length > 0) {
        consolidatedId = await this.consolidateEpisodic(episodic, method);
      } else if (semantic.length > 0) {
        consolidatedId = await this.consolidateSemantic(semantic, method);
      }
      
      // Remove original memories
      await this.supabase
        .from('agent_memories')
        .delete()
        .in('id', memory_ids);
      
      return {
        success: true,
        consolidated_memory_id: consolidatedId,
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private initializeDefaultStrategies(): void {
    // Episodic temporal compression
    this.strategies.set('episodic_temporal_compression', {
      name: 'episodic_temporal_compression',
      description: 'Consolidate old episodic memories by time periods',
      triggers: [
        {
          type: 'memory_count',
          condition: { memory_type: 'episodic' },
          threshold: 200,
        },
      ],
      rules: [
        {
          source_types: ['episodic'],
          target_type: 'semantic',
          method: 'summarize',
          conditions: {
            min_age_hours: 168, // 1 week
            max_importance: 0.5,
          },
        },
      ],
      priority: 1,
    });
    
    // Semantic concept merging
    this.strategies.set('semantic_concept_merging', {
      name: 'semantic_concept_merging',
      description: 'Merge similar semantic concepts',
      triggers: [
        {
          type: 'similarity',
          condition: { memory_type: 'semantic' },
          threshold: 0.8,
        },
      ],
      rules: [
        {
          source_types: ['semantic'],
          target_type: 'semantic',
          method: 'merge',
          conditions: {
            min_similarity: 0.8,
          },
        },
      ],
      priority: 2,
    });
    
    // Low importance cleanup
    this.strategies.set('low_importance_cleanup', {
      name: 'low_importance_cleanup',
      description: 'Remove or consolidate low-importance memories',
      triggers: [
        {
          type: 'importance',
          condition: { max_importance: 0.2 },
          threshold: 50,
        },
      ],
      rules: [
        {
          source_types: ['episodic', 'semantic'],
          target_type: 'semantic',
          method: 'abstract',
          conditions: {
            max_importance: 0.2,
            min_age_hours: 72, // 3 days
            min_access_count: 2,
          },
        },
      ],
      priority: 3,
    });
    
    // Working memory consolidation
    this.strategies.set('working_memory_consolidation', {
      name: 'working_memory_consolidation',
      description: 'Convert working memory to episodic or remove expired items',
      triggers: [
        {
          type: 'memory_count',
          condition: { memory_type: 'working' },
          threshold: 15,
        },
      ],
      rules: [
        {
          source_types: ['working'],
          target_type: 'episodic',
          method: 'hierarchical',
          conditions: {
            min_age_hours: 1,
          },
        },
      ],
      priority: 0, // Highest priority
    });
    
    // Similarity-based merging
    this.strategies.set('similarity_based_merging', {
      name: 'similarity_based_merging',
      description: 'Merge highly similar memories across types',
      triggers: [
        {
          type: 'similarity',
          condition: {},
          threshold: 0.9,
        },
      ],
      rules: [
        {
          source_types: ['episodic', 'semantic'],
          target_type: 'semantic',
          method: 'merge',
          conditions: {
            min_similarity: 0.9,
          },
        },
      ],
      priority: 2,
    });
  }
  
  private async selectStrategies(
    agent_id: string,
    forceRun: boolean
  ): Promise<ConsolidationStrategy[]> {
    const check = await this.checkConsolidationNeeded(agent_id);
    
    if (!check.needed && !forceRun) {
      return [];
    }
    
    // Get recommended strategies
    const recommended = check.recommended_strategies
      .map(name => this.strategies.get(name)!)
      .filter(Boolean);
    
    // Add urgent strategies if needed
    if (check.urgency === 'high' || forceRun) {
      const allStrategies = Array.from(this.strategies.values());
      recommended.push(...allStrategies);
    }
    
    // Remove duplicates and sort by priority
    const unique = [...new Map(recommended.map(s => [s.name, s])).values()];
    return unique.sort((a, b) => a.priority - b.priority);
  }
  
  private async createJob(
    agent_id: string,
    strategy: ConsolidationStrategy
  ): Promise<ConsolidationJob> {
    const job: ConsolidationJob = {
      id: generateMemoryId(),
      agent_id,
      strategy,
      status: 'pending',
      created_at: generateTimestamp(),
      memories_processed: 0,
      memories_consolidated: 0,
      memories_removed: 0,
      result_summary: '',
    };
    
    // Store job in database
    await this.supabase
      .from('consolidation_jobs')
      .insert({
        id: job.id,
        agent_id: job.agent_id,
        strategy_name: strategy.name,
        status: job.status,
        created_at: job.created_at,
        memories_processed: job.memories_processed,
        memories_consolidated: job.memories_consolidated,
        memories_removed: job.memories_removed,
        result_summary: job.result_summary,
      });
    
    return job;
  }
  
  private async updateJob(
    job_id: string,
    updates: Partial<ConsolidationJob>
  ): Promise<void> {
    await this.supabase
      .from('consolidation_jobs')
      .update({
        ...updates,
        updated_at: generateTimestamp(),
      })
      .eq('id', job_id);
  }
  
  private async executeStrategy(
    job: ConsolidationJob,
    maxTimeMs: number
  ): Promise<void> {
    const startTime = Date.now();
    
    await this.updateJob(job.id, {
      status: 'running',
      started_at: generateTimestamp(),
    });
    
    try {
      // Apply each rule in the strategy
      for (const rule of job.strategy.rules) {
        if (Date.now() - startTime > maxTimeMs) {
          throw new Error('Strategy execution timeout');
        }
        
        await this.applyRule(job, rule);
      }
      
      await this.updateJob(job.id, {
        status: 'completed',
        completed_at: generateTimestamp(),
        result_summary: `Processed ${job.memories_processed} memories, consolidated ${job.memories_consolidated}, removed ${job.memories_removed}`,
      });
      
    } catch (error) {
      throw error;
    }
  }
  
  private async applyRule(
    job: ConsolidationJob,
    rule: ConsolidationRule
  ): Promise<void> {
    // Find memories matching the rule conditions
    const candidates = await this.findRuleCandidates(job.agent_id, rule);
    
    job.memories_processed += candidates.length;
    
    if (candidates.length === 0) return;
    
    // Group candidates for consolidation
    const groups = await this.groupCandidates(candidates, rule);
    
    // Apply consolidation method to each group
    for (const group of groups) {
      if (group.length < 2) continue;
      
      try {
        await this.consolidateGroup(group, rule);
        job.memories_consolidated++;
        job.memories_removed += group.length - 1; // All but the consolidated one
      } catch (error) {
        console.error('Failed to consolidate group:', error);
      }
    }
  }
  
  private async findRuleCandidates(
    agent_id: string,
    rule: ConsolidationRule
  ): Promise<AgentMemory[]> {
    let query = this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', agent_id)
      .in('memory_type', rule.source_types);
    
    // Apply conditions
    if (rule.conditions.max_importance !== undefined) {
      query = query.lte('importance', rule.conditions.max_importance);
    }
    
    if (rule.conditions.min_access_count !== undefined) {
      query = query.gte('access_count', rule.conditions.min_access_count);
    }
    
    if (rule.conditions.min_age_hours !== undefined) {
      const cutoffTime = new Date(Date.now() - rule.conditions.min_age_hours * 60 * 60 * 1000);
      query = query.lte('created_at', cutoffTime.toISOString());
    }
    
    const { data, error } = await query.limit(100);
    
    if (error) {
      throw new Error(`Failed to find rule candidates: ${error.message}`);
    }
    
    return (data || []) as AgentMemory[];
  }
  
  private async groupCandidates(
    candidates: AgentMemory[],
    rule: ConsolidationRule
  ): Promise<AgentMemory[][]> {
    const groups: AgentMemory[][] = [];
    
    if (rule.method === 'merge' && rule.conditions.min_similarity) {
      // Group by similarity
      const used = new Set<string>();
      
      for (const candidate of candidates) {
        if (used.has(candidate.id)) continue;
        
        const group = [candidate];
        used.add(candidate.id);
        
        // Find similar candidates
        for (const other of candidates) {
          if (used.has(other.id)) continue;
          
          const similarity = await this.calculateSimilarity(candidate, other);
          if (similarity >= rule.conditions.min_similarity) {
            group.push(other);
            used.add(other.id);
          }
        }
        
        groups.push(group);
      }
    } else {
      // Group by other criteria (e.g., temporal, type-based)
      groups.push(candidates);
    }
    
    return groups.filter(group => group.length >= 2);
  }
  
  private async consolidateGroup(
    group: AgentMemory[],
    rule: ConsolidationRule
  ): Promise<void> {
    const memoryType = group[0].memory_type;
    
    if (memoryType === 'episodic') {
      await this.consolidateEpisodic(group as EpisodicMemory[], rule.method);
    } else if (memoryType === 'semantic') {
      await this.consolidateSemantic(group as SemanticMemory[], rule.method);
    } else {
      // Handle other types or mixed consolidation
      await this.consolidateMixed(group, rule);
    }
  }
  
  private async consolidateEpisodic(
    memories: EpisodicMemory[],
    method: string
  ): Promise<string> {
    // Use episodic manager for consolidation
    return await this.episodicManager.consolidateRelatedMemories(
      memories.map(m => m.id)
    );
  }
  
  private async consolidateSemantic(
    memories: SemanticMemory[],
    method: string
  ): Promise<string> {
    // Use semantic manager for consolidation
    const result = await this.semanticManager.consolidateConcepts(
      memories[0].agent_id,
      0.8
    );
    
    return result.removed_ids[0] || '';
  }
  
  private async consolidateMixed(
    memories: AgentMemory[],
    rule: ConsolidationRule
  ): Promise<void> {
    // Handle mixed-type consolidation
    // This is a complex operation that would require careful design
    console.log(`Mixed consolidation not yet implemented for ${memories.length} memories`);
  }
  
  private async calculateSimilarity(
    memory1: AgentMemory,
    memory2: AgentMemory
  ): Promise<number> {
    // Simple similarity calculation
    // In production, this would use embeddings or more sophisticated methods
    
    if (memory1.memory_type !== memory2.memory_type) {
      return 0.0; // Different types are not similar
    }
    
    const content1 = JSON.stringify(memory1.content).toLowerCase();
    const content2 = JSON.stringify(memory2.content).toLowerCase();
    
    const words1 = new Set(content1.split(/\s+/));
    const words2 = new Set(content2.split(/\s+/));
    
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    
    return union > 0 ? intersection / union : 0;
  }
  
  private async getMemoryStatistics(agent_id: string): Promise<{
    total_count: number;
    by_type: Record<MemoryType, number>;
    estimated_size: number;
  }> {
    const { data, error } = await this.supabase
      .rpc('get_memory_stats', { agent_uuid: agent_id });
    
    if (error) {
      throw new Error(`Failed to get memory statistics: ${error.message}`);
    }
    
    const stats = data || [];
    const byType: Record<string, number> = {};
    let totalCount = 0;
    
    for (const stat of stats) {
      byType[stat.memory_type] = stat.count;
      totalCount += stat.count;
    }
    
    return {
      total_count: totalCount,
      by_type: byType as Record<MemoryType, number>,
      estimated_size: totalCount * 1024, // Rough estimate
    };
  }
  
  private async countOldMemories(
    agent_id: string,
    days: number
  ): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const { count, error } = await this.supabase
      .from('agent_memories')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .lte('created_at', cutoffDate.toISOString());
    
    if (error) {
      throw new Error(`Failed to count old memories: ${error.message}`);
    }
    
    return count || 0;
  }
  
  private async findDuplicateGroups(agent_id: string): Promise<string[][]> {
    // This would be a complex query to find potential duplicates
    // For now, return empty array
    return [];
  }
  
  private async getWorkingMemoryCount(agent_id: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('agent_memories')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .eq('memory_type', 'working');
    
    if (error) {
      throw new Error(`Failed to count working memories: ${error.message}`);
    }
    
    return count || 0;
  }
}