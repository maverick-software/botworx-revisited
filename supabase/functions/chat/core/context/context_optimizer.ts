// Context Optimizer - Token Budget and Priority Management
// Optimizes context selection within token constraints while maximizing quality

import {
  ContextCandidate,
  ContextPriority,
  RelevanceScore,
} from './context_retriever.ts';

// ============================
// Interfaces
// ============================

export enum OptimizationGoal {
  MAXIMIZE_RELEVANCE = 'maximize_relevance',
  MAXIMIZE_DIVERSITY = 'maximize_diversity',
  MAXIMIZE_FRESHNESS = 'maximize_freshness',
  MINIMIZE_TOKENS = 'minimize_tokens',
  BALANCE_ALL = 'balance_all',
}

export interface OptimizationStrategy {
  goal: OptimizationGoal;
  weight: number;
}

export interface OptimizationResult {
  selected_candidates: ContextCandidate[];
  total_tokens: number;
  budget_utilization: number;
  quality_score: number;
  optimization_metrics: OptimizationMetrics;
}

export interface OptimizationMetrics {
  relevance_score: number;
  diversity_score: number;
  freshness_score: number;
  priority_coverage: Record<ContextPriority, number>;
  source_distribution: Record<string, number>;
}

// ============================
// Context Optimizer Implementation
// ============================

export class ContextOptimizer {
  /**
   * Select optimal context candidates within token budget
   */
  async selectOptimal(
    candidates: ContextCandidate[],
    tokenBudget: number,
    goals: OptimizationGoal[]
  ): Promise<ContextCandidate[]> {
    if (candidates.length === 0) {
      return [];
    }
    
    // Default to balanced optimization if no goals specified
    const optimizationGoals = goals.length > 0 ? goals : [OptimizationGoal.BALANCE_ALL];
    
    // Apply different optimization strategies based on goals
    if (optimizationGoals.includes(OptimizationGoal.BALANCE_ALL)) {
      return this.balancedOptimization(candidates, tokenBudget);
    }
    
    if (optimizationGoals.includes(OptimizationGoal.MAXIMIZE_RELEVANCE)) {
      return this.relevanceOptimization(candidates, tokenBudget);
    }
    
    if (optimizationGoals.includes(OptimizationGoal.MAXIMIZE_DIVERSITY)) {
      return this.diversityOptimization(candidates, tokenBudget);
    }
    
    if (optimizationGoals.includes(OptimizationGoal.MAXIMIZE_FRESHNESS)) {
      return this.freshnessOptimization(candidates, tokenBudget);
    }
    
    // Default fallback
    return this.greedyOptimization(candidates, tokenBudget);
  }
  
  /**
   * Balanced optimization considering multiple factors
   */
  private balancedOptimization(
    candidates: ContextCandidate[],
    tokenBudget: number
  ): ContextCandidate[] {
    // Multi-criteria scoring
    const scoredCandidates = candidates.map(candidate => ({
      ...candidate,
      optimization_score: this.calculateBalancedScore(candidate),
    }));
    
    // Sort by optimization score
    scoredCandidates.sort((a, b) => b.optimization_score - a.optimization_score);
    
    // Ensure critical contexts are included first
    const selected: ContextCandidate[] = [];
    let usedTokens = 0;
    
    // First pass: Include all critical priority items
    for (const candidate of scoredCandidates) {
      if (candidate.priority === ContextPriority.CRITICAL && 
          usedTokens + candidate.token_count <= tokenBudget) {
        selected.push(candidate);
        usedTokens += candidate.token_count;
      }
    }
    
    // Second pass: Fill remaining budget with best candidates
    for (const candidate of scoredCandidates) {
      if (candidate.priority !== ContextPriority.CRITICAL && 
          !selected.includes(candidate) &&
          usedTokens + candidate.token_count <= tokenBudget) {
        selected.push(candidate);
        usedTokens += candidate.token_count;
      }
    }
    
    return selected;
  }
  
  /**
   * Optimize for maximum relevance
   */
  private relevanceOptimization(
    candidates: ContextCandidate[],
    tokenBudget: number
  ): ContextCandidate[] {
    // Sort by relevance score
    const sorted = candidates.sort((a, b) => 
      b.relevance.composite_score - a.relevance.composite_score
    );
    
    return this.greedySelection(sorted, tokenBudget);
  }
  
  /**
   * Optimize for maximum diversity
   */
  private diversityOptimization(
    candidates: ContextCandidate[],
    tokenBudget: number
  ): ContextCandidate[] {
    const selected: ContextCandidate[] = [];
    const remaining = [...candidates];
    let usedTokens = 0;
    
    // Diversified selection algorithm
    while (remaining.length > 0 && usedTokens < tokenBudget) {
      // Find candidate that maximizes diversity
      let bestCandidate: ContextCandidate | null = null;
      let bestDiversityScore = -1;
      
      for (const candidate of remaining) {
        if (usedTokens + candidate.token_count <= tokenBudget) {
          const diversityScore = this.calculateDiversityScore(candidate, selected);
          if (diversityScore > bestDiversityScore) {
            bestDiversityScore = diversityScore;
            bestCandidate = candidate;
          }
        }
      }
      
      if (!bestCandidate) break;
      
      selected.push(bestCandidate);
      usedTokens += bestCandidate.token_count;
      remaining.splice(remaining.indexOf(bestCandidate), 1);
    }
    
    return selected;
  }
  
  /**
   * Optimize for maximum freshness
   */
  private freshnessOptimization(
    candidates: ContextCandidate[],
    tokenBudget: number
  ): ContextCandidate[] {
    // Sort by temporal relevance
    const sorted = candidates.sort((a, b) => 
      b.relevance.temporal_relevance - a.relevance.temporal_relevance
    );
    
    return this.greedySelection(sorted, tokenBudget);
  }
  
  /**
   * Simple greedy optimization by composite score
   */
  private greedyOptimization(
    candidates: ContextCandidate[],
    tokenBudget: number
  ): ContextCandidate[] {
    // Sort by composite relevance score
    const sorted = candidates.sort((a, b) => 
      b.relevance.composite_score - a.relevance.composite_score
    );
    
    return this.greedySelection(sorted, tokenBudget);
  }
  
  /**
   * Greedy selection within token budget
   */
  private greedySelection(
    sortedCandidates: ContextCandidate[],
    tokenBudget: number
  ): ContextCandidate[] {
    const selected: ContextCandidate[] = [];
    let usedTokens = 0;
    
    for (const candidate of sortedCandidates) {
      if (usedTokens + candidate.token_count <= tokenBudget) {
        selected.push(candidate);
        usedTokens += candidate.token_count;
      }
    }
    
    return selected;
  }
  
  /**
   * Calculate balanced optimization score
   */
  private calculateBalancedScore(candidate: ContextCandidate): number {
    const relevance = candidate.relevance;
    const priorityWeight = this.getPriorityWeight(candidate.priority || ContextPriority.MEDIUM);
    
    // Weighted combination of factors
    const score = (
      relevance.semantic_similarity * 0.25 +
      relevance.temporal_relevance * 0.15 +
      relevance.contextual_fit * 0.20 +
      relevance.user_preference * 0.15 +
      priorityWeight * 0.25
    );
    
    // Adjust for token efficiency
    const tokenEfficiency = 1 / Math.log(candidate.token_count + 1);
    
    return score * (1 + tokenEfficiency * 0.1);
  }
  
  /**
   * Calculate diversity score for a candidate relative to already selected
   */
  private calculateDiversityScore(
    candidate: ContextCandidate,
    selected: ContextCandidate[]
  ): number {
    if (selected.length === 0) {
      return candidate.relevance.composite_score;
    }
    
    // Calculate minimum similarity to selected items
    let minSimilarity = 1.0;
    
    for (const selectedCandidate of selected) {
      const similarity = this.calculateSimilarity(candidate, selectedCandidate);
      minSimilarity = Math.min(minSimilarity, similarity);
    }
    
    // Higher diversity score for items less similar to selected
    const diversityBonus = 1 - minSimilarity;
    
    return candidate.relevance.composite_score * (1 + diversityBonus);
  }
  
  /**
   * Calculate similarity between two candidates
   */
  private calculateSimilarity(
    candidate1: ContextCandidate,
    candidate2: ContextCandidate
  ): number {
    // Source similarity
    const sourceSimilarity = candidate1.source === candidate2.source ? 1.0 : 0.0;
    
    // Content similarity (simplified)
    const content1 = typeof candidate1.content === 'string' 
      ? candidate1.content 
      : JSON.stringify(candidate1.content);
    const content2 = typeof candidate2.content === 'string' 
      ? candidate2.content 
      : JSON.stringify(candidate2.content);
    
    const contentSimilarity = this.calculateTextSimilarity(content1, content2);
    
    // Weighted combination
    return sourceSimilarity * 0.3 + contentSimilarity * 0.7;
  }
  
  /**
   * Calculate text similarity using simple word overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Get priority weight for optimization
   */
  private getPriorityWeight(priority: ContextPriority): number {
    switch (priority) {
      case ContextPriority.CRITICAL:
        return 1.0;
      case ContextPriority.HIGH:
        return 0.8;
      case ContextPriority.MEDIUM:
        return 0.6;
      case ContextPriority.LOW:
        return 0.4;
      case ContextPriority.OPTIONAL:
        return 0.2;
      default:
        return 0.6;
    }
  }
  
  /**
   * Calculate optimization metrics for selected candidates
   */
  calculateOptimizationMetrics(selected: ContextCandidate[]): OptimizationMetrics {
    if (selected.length === 0) {
      return {
        relevance_score: 0,
        diversity_score: 0,
        freshness_score: 0,
        priority_coverage: {
          [ContextPriority.CRITICAL]: 0,
          [ContextPriority.HIGH]: 0,
          [ContextPriority.MEDIUM]: 0,
          [ContextPriority.LOW]: 0,
          [ContextPriority.OPTIONAL]: 0,
        },
        source_distribution: {},
      };
    }
    
    // Calculate average relevance
    const relevanceScore = selected.reduce((sum, c) => 
      sum + c.relevance.composite_score, 0) / selected.length;
    
    // Calculate freshness
    const freshnessScore = selected.reduce((sum, c) => 
      sum + c.relevance.temporal_relevance, 0) / selected.length;
    
    // Calculate diversity (average minimum similarity)
    let totalDiversity = 0;
    for (let i = 0; i < selected.length; i++) {
      let minSimilarity = 1.0;
      for (let j = 0; j < selected.length; j++) {
        if (i !== j) {
          const similarity = this.calculateSimilarity(selected[i], selected[j]);
          minSimilarity = Math.min(minSimilarity, similarity);
        }
      }
      totalDiversity += (1 - minSimilarity);
    }
    const diversityScore = totalDiversity / selected.length;
    
    // Calculate priority coverage
    const priorityCoverage: Record<ContextPriority, number> = {
      [ContextPriority.CRITICAL]: 0,
      [ContextPriority.HIGH]: 0,
      [ContextPriority.MEDIUM]: 0,
      [ContextPriority.LOW]: 0,
      [ContextPriority.OPTIONAL]: 0,
    };
    
    selected.forEach(candidate => {
      const priority = candidate.priority || ContextPriority.MEDIUM;
      priorityCoverage[priority]++;
    });
    
    // Calculate source distribution
    const sourceDistribution: Record<string, number> = {};
    selected.forEach(candidate => {
      sourceDistribution[candidate.source] = (sourceDistribution[candidate.source] || 0) + 1;
    });
    
    return {
      relevance_score: relevanceScore,
      diversity_score: diversityScore,
      freshness_score: freshnessScore,
      priority_coverage: priorityCoverage,
      source_distribution: sourceDistribution,
    };
  }
}