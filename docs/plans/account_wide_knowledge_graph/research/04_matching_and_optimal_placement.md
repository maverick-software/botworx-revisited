# Research: Matching & Optimal Placement Strategy

## Current Deduplication Patterns Analysis
From semantic_memory.ts consolidation methods (L354-414):

### Existing Similarity Matching
Current system uses embedding-based consolidation:
```typescript
// L354: consolidateConcepts with similarity_threshold = 0.8
async consolidateConcepts(agent_id: string, similarity_threshold: number = 0.8): Promise<{
  consolidated_count: number;
  removed_ids: string[];
}> {
  // Fetches concepts, computes pairwise similarities
  // Merges concepts above threshold
}
```

### Current Deduplication Logic (L390-413)
- Pairwise similarity computation using embeddings
- Threshold-based merging (default 0.8)
- Evidence consolidation from multiple sources
- Related memory updates

## Enhanced Matching Architecture (Including Concepts/Conclusions)

### Multi-Stage Candidate Generation
```typescript
interface MatchingCandidate {
  existing_node_id: string;
  similarity_scores: {
    name_similarity: number;      // String similarity (0-1)
    alias_overlap: number;        // Jaccard similarity of aliases
    property_similarity: number;  // Property overlap score
    embedding_similarity: number; // Vector cosine similarity
    neighborhood_similarity: number; // Shared connections
    temporal_proximity: number;   // Time-based relevance
  };
  composite_score: number;        // Weighted combination
  confidence: number;             // Match confidence
}

class EntityMatcher {
  async findCandidates(newEntity: ExtractedEntity, accountGraphId: string): Promise<MatchingCandidate[]> {
    const candidates: MatchingCandidate[] = [];
    
    // Stage 1: Exact name/alias matches
    const exactMatches = await this.findExactMatches(newEntity, accountGraphId);
    candidates.push(...exactMatches);
    
    // Stage 2: Fuzzy string matches (Levenshtein, Jaro-Winkler)
    const fuzzyMatches = await this.findFuzzyMatches(newEntity, accountGraphId);
    candidates.push(...fuzzyMatches);
    
    // Stage 3: Embedding-based similarity (if embeddings available)
    const embeddingMatches = await this.findEmbeddingMatches(newEntity, accountGraphId);
    candidates.push(...embeddingMatches);
    
    // Stage 4: Neighborhood-based matches (shared connections)
    const neighborhoodMatches = await this.findNeighborhoodMatches(newEntity, accountGraphId);
    candidates.push(...neighborhoodMatches);
    
    return this.deduplicateAndRank(candidates);
  }
}

class ConclusionMatcher {
  async findConceptPlacement(newNode: ExtractedEntity, accountGraphId: string): Promise<MatchingCandidate[]> {
    // Favor merges with existing 'concept'/'conclusion' nodes that share supporting subgraphs
    // Score by overlap of supporting_node_ids/edge_ids + neighborhood similarity
    // Fall back to entity matching if no provenance provided
    return [];
  }
}
```

### Advanced Similarity Scoring

#### String Similarity Algorithms
```typescript
// Jaro-Winkler for name similarity (better for person names)
function jaroWinklerSimilarity(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2);
  
  // Boost score if strings have common prefix
  const prefix = commonPrefixLength(s1, s2, 4);
  return jaro + (0.1 * prefix * (1 - jaro));
}

// Combined string similarity with type-specific weights
function computeNameSimilarity(entity1: string, entity2: string, entityType: string): number {
  const jw = jaroWinklerSimilarity(entity1, entity2);
  const lev = normalizedLevenshtein(entity1, entity2);
  
  // Person names favor Jaro-Winkler, organizations favor Levenshtein
  const jwWeight = entityType === 'person' ? 0.7 : 0.3;
  const levWeight = 1 - jwWeight;
  
  return (jw * jwWeight) + (lev * levWeight);
}
```

#### Property Overlap Scoring
```typescript
function computePropertySimilarity(props1: Record<string, any>, props2: Record<string, any>): number {
  const keys1 = new Set(Object.keys(props1));
  const keys2 = new Set(Object.keys(props2));
  
  // Jaccard similarity of property keys
  const intersection = new Set([...keys1].filter(k => keys2.has(k)));
  const union = new Set([...keys1, ...keys2]);
  const keyJaccard = intersection.size / union.size;
  
  // Value similarity for shared keys
  let valueScore = 0;
  let sharedKeys = 0;
  
  for (const key of intersection) {
    sharedKeys++;
    const val1 = props1[key];
    const val2 = props2[key];
    
    if (typeof val1 === 'string' && typeof val2 === 'string') {
      valueScore += normalizedLevenshtein(val1, val2);
    } else if (val1 === val2) {
      valueScore += 1;
    }
  }
  
  const avgValueSimilarity = sharedKeys > 0 ? valueScore / sharedKeys : 0;
  
  // Combine key overlap and value similarity
  return (keyJaccard * 0.4) + (avgValueSimilarity * 0.6);
}
```

### Composite Scoring & Decision Logic

#### Three-Tier Decision Framework
```typescript
interface MatchingThresholds {
  merge_threshold: number;      // Auto-merge above this score
  create_threshold: number;     // Create new below this score  
  review_threshold: number;     // Human review between merge and create
}

// Configurable per account, with sensible defaults
const DEFAULT_THRESHOLDS: MatchingThresholds = {
  merge_threshold: 0.85,   // High confidence merge
  create_threshold: 0.30,  // Low confidence = new entity
  review_threshold: 0.60   // Medium confidence = review queue
};

enum MatchingDecision {
  MERGE = 'merge',
  CREATE_NEW = 'create_new', 
  QUEUE_FOR_REVIEW = 'queue_for_review'
}

function makeMatchingDecision(
  bestCandidate: MatchingCandidate | null,
  thresholds: MatchingThresholds
): { decision: MatchingDecision; candidate?: MatchingCandidate } {
  
  if (!bestCandidate || bestCandidate.composite_score < thresholds.create_threshold) {
    return { decision: MatchingDecision.CREATE_NEW };
  }
  
  if (bestCandidate.composite_score >= thresholds.merge_threshold) {
    return { decision: MatchingDecision.MERGE, candidate: bestCandidate };
  }
  
  return { decision: MatchingDecision.QUEUE_FOR_REVIEW, candidate: bestCandidate };
}
```

## Transactional Processing & Consistency

### Atomic Upsert Operations
```typescript
class GraphUpsertManager {
  async processEntityMatch(
    newEntity: ExtractedEntity,
    decision: { decision: MatchingDecision; candidate?: MatchingCandidate },
    accountGraphId: string,
    sourceInfo: { source_kind: string; source_id: string; agent_id?: string }
  ): Promise<string> {
    
    return await this.supabase.rpc('atomic_entity_upsert', {
      account_graph_id: accountGraphId,
      entity_data: newEntity,
      matching_decision: decision.decision,
      existing_node_id: decision.candidate?.existing_node_id,
      source_info: sourceInfo
    });
  }
}
```

### Idempotency & Conflict Resolution
```typescript
// Ensure idempotent processing via content hashing
function generateEntityId(entity: ExtractedEntity, context: ExtractionContext): string {
  const hashInput = {
    canonical_label: entity.label.toLowerCase().trim(),
    type: entity.type,
    source_id: context.source_id,
    agent_id: context.agent_id
  };
  
  return crypto.createHash('sha256')
    .update(JSON.stringify(hashInput))
    .digest('hex')
    .substring(0, 16); // 16-char hex ID
}

// Handle concurrent processing conflicts
async function handleConflictResolution(
  conflictingNodes: string[],
  accountGraphId: string
): Promise<string> {
  // Merge strategy: keep node with highest confidence, merge properties
  const nodes = await fetchNodesByIds(conflictingNodes, accountGraphId);
  const primaryNode = nodes.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );
  
  // Merge properties and aliases from other nodes
  const mergedProperties = nodes.reduce((merged, node) => ({
    ...merged,
    ...node.properties
  }), {});
  
  const mergedAliases = [...new Set(nodes.flatMap(n => n.aliases))];
  
  return primaryNode.id;
}
```

## Integration with Current Architecture

### Extension Points in memory_manager.ts
Current consolidation happens in semantic memory (L354):
```typescript
// Enhanced: Add graph-aware entity matching before semantic storage
async createFromConversation(messages: any[], auto_consolidate: boolean = true): Promise<string[]> {
  // ... existing episodic creation ...
  
  // NEW: Extract entities/relations for graph
  const extractionResults = await this.extractForGraphAndSemantic(agent_id, messages);
  
  // NEW: Process entities through matching pipeline
  const graphResults = await this.processGraphEntities(extractionResults, agent_id);
  
  // Continue with existing semantic storage (now graph-aware)
  const semanticIds = await this.storeSemanticMemories(extractionResults.concepts, graphResults);
  
  return [...episodicIds, ...semanticIds];
}
```

### Quality Metrics & Monitoring
```typescript
interface MatchingMetrics {
  total_processed: number;
  auto_merged: number;
  created_new: number;
  queued_for_review: number;
  avg_processing_time_ms: number;
  confidence_distribution: Record<string, number>;
}

// Track matching quality over time
class MatchingQualityTracker {
  async recordMatchingDecision(
    decision: MatchingDecision,
    confidence: number,
    processingTimeMs: number
  ): Promise<void> {
    await this.supabase
      .from('matching_quality_metrics')
      .insert({
        decision,
        confidence,
        processing_time_ms: processingTimeMs,
        recorded_at: new Date().toISOString()
      });
  }
}
```

## Performance Considerations

### Caching Strategy
- Cache matching results for frequently processed entities
- Redis-based candidate caching with TTL
- Precompute embeddings for common entity types

### Batch Processing
- Process multiple entities in parallel with controlled concurrency
- Batch database operations for efficiency
- Queue-based processing for non-blocking operation

### Quality Assurance
- A/B test different matching thresholds
- User feedback integration for match quality
- Periodic review queue processing
- Confidence calibration based on historical accuracy