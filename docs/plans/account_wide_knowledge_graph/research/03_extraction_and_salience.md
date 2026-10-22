# Research: Extraction & Salience Scoring

## Current Knowledge Extraction Analysis
From semantic_memory.ts analysis (L457-523):

### Existing LLM-Based Extraction Pattern
Current system uses structured JSON extraction:
```typescript
// L472-481: Existing extraction prompt
const extractionPrompt = `Extract factual knowledge from the conversation. Return JSON with:
{
  "concepts": [{"concept": "name", "definition": "definition", "confidence": 0.8}],
  "relationships": [{"source": "concept1", "target": "concept2", "type": "is_a", "strength": 0.7}],
  "facts": [{"fact": "statement", "confidence": 0.9, "source": "user/assistant"}]
}

Only include information that is stated as fact, not opinions or questions.`;
```

### Current Relationship Types (L22)
- `is_a`, `part_of`, `related_to`, `causes`, `contradicts`, `synonym`
- Strength scoring (0-1) with evidence arrays

### Router vs Direct OpenAI Pattern (L467-483)
- Prefers LLM router when available: `USE_LLM_ROUTER=true`
- Fallback to direct OpenAI chat completions
- Agent-scoped routing for consistent extraction

## Enhanced Entity & Relation Extraction

### Expanded Entity Types for Graph
Based on web research and business context analysis:
```typescript
export interface ExtractedEntity {
  id: string; // Computed hash for deduplication
  type: 'person' | 'organization' | 'location' | 'concept' | 'product' | 'event' | 'document' | 'skill' | 'technology';
  label: string; // Canonical name
  aliases: string[]; // Alternative names, abbreviations
  properties: {
    description?: string;
    category?: string;
    confidence: number; // 0-1
    source_evidence: string[]; // Supporting text snippets
    first_mentioned: string; // ISO timestamp
    mention_count: number;
  };
  salience_score: number; // Computed importance (0-1)
}

export interface ExtractedRelation {
  id: string;
  source_entity: string; // Entity ID
  target_entity: string; // Entity ID  
  type: 'works_at' | 'located_in' | 'mentions' | 'uses' | 'creates' | 'knows' | 'part_of' | 'similar_to' | 'depends_on';
  properties: {
    confidence: number;
    strength: number; // Relationship strength (0-1)
    temporal_context?: string; // "currently", "previously", "planning to"
    source_evidence: string[];
    first_observed: string;
    observation_count: number;
  };
  salience_score: number;
}
```

### Multi-Stage Extraction Pipeline (Two-Layer)
```typescript
// Stage 1: Named Entity Recognition + Coreference Resolution
const nerPrompt = `Extract all entities from this text. For each entity, provide:
- Type (person, organization, location, concept, product, event, document, skill, technology)
- Canonical name (resolve pronouns and abbreviations)
- All mentions/aliases found
- Brief description if provided

Text: ${content}

Return JSON array of entities.`;

// Stage 2: Relationship Extraction
const relationPrompt = `Given these entities: ${JSON.stringify(entities)}
Extract relationships between them from the text. Focus on:
- Professional relationships (works_at, manages, collaborates_with)
- Conceptual relationships (uses, creates, mentions, depends_on)
- Temporal relationships (when applicable)

Text: ${content}

Return JSON array of relationships with confidence scores.`;

// Stage 3: Fact Extraction (current pattern, enhanced)
const factPrompt = `Extract factual statements that could be useful for future reference.
Focus on: capabilities, preferences, decisions, plans, problems, solutions.
Avoid opinions unless they represent stated positions.

Text: ${content}

Return JSON with facts and confidence scores.`;

// Stage 4: Conclusion/Concept Synthesis (2nd-layer reasoning)
const conclusionPrompt = `Given the extracted entities and relationships, infer higher-level conclusions or concepts
that follow logically from 3-6 strongly connected items. Provide:
- type: 'concept' or 'conclusion'
- label: short canonical name
- justification: brief rationale referencing source entities/edges
- supporting_node_ids: IDs of entities involved
- supporting_edge_ids: IDs of relationships involved
- confidence (0..1) based on strength of connections and evidence

Constraints:
- Only include conclusions that are well-supported (avoid speculation)
- If contradictory evidence exists, lower confidence and include note in justification

Return JSON array of conclusions.`;
```

## Advanced Salience Scoring

### Multi-Factor Salience Model
Based on information retrieval research:
```typescript
interface SalienceFactors {
  tf_idf: number;        // Term frequency-inverse document frequency
  position: number;      // Position in conversation (earlier = more important)
  recency: number;       // How recent the mention (exponential decay)
  source_credibility: number; // User vs agent, verified vs unverified
  context_centrality: number; // How central to conversation topic
  entity_frequency: number;   // How often entity mentioned across sessions
  relationship_density: number; // How connected entity is in graph
}

function computeSalience(entity: ExtractedEntity, context: ExtractionContext): number {
  const factors = extractSalienceFactors(entity, context);
  
  // Weighted combination (tunable via feature flags)
  const weights = {
    tf_idf: 0.25,
    position: 0.15,
    recency: 0.20,
    source_credibility: 0.10,
    context_centrality: 0.15,
    entity_frequency: 0.10,
    relationship_density: 0.05
  };
  
  return Object.entries(weights)
    .reduce((score, [factor, weight]) => 
      score + (factors[factor] * weight), 0);
}
```

### TF-IDF Implementation for Entities
```typescript
// Compute term frequency for entity mentions
function computeEntityTF(entity: string, document: string): number {
  const mentions = [entity, ...entity.aliases].reduce((count, alias) => {
    const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi');
    return count + (document.match(regex) || []).length;
  }, 0);
  
  const totalWords = document.split(/\s+/).length;
  return mentions / totalWords;
}

// Compute inverse document frequency across user's conversation history
async function computeEntityIDF(entity: string, userId: string): Promise<number> {
  const totalDocs = await getTotalDocumentCount(userId);
  const docsWithEntity = await getDocumentCountWithEntity(entity, userId);
  
  return Math.log(totalDocs / (1 + docsWithEntity));
}
```

## Canonicalization & Deduplication

### Entity Normalization Pipeline
```typescript
function canonicalizeEntity(rawEntity: string, type: string): string {
  let canonical = rawEntity.toLowerCase().trim();
  
  // Type-specific normalization
  switch (type) {
    case 'person':
      canonical = normalizePerson(canonical);
      break;
    case 'organization':
      canonical = normalizeOrganization(canonical);
      break;
    case 'technology':
      canonical = normalizeTechnology(canonical);
      break;
  }
  
  return canonical;
}

function normalizePerson(name: string): string {
  // Remove titles, normalize spacing
  return name
    .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeOrganization(org: string): string {
  // Remove common suffixes, normalize abbreviations
  return org
    .replace(/\s+(inc|llc|corp|ltd|co)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
```

### Alias Management
```typescript
interface AliasMapping {
  canonical: string;
  aliases: Set<string>;
  confidence_scores: Map<string, number>;
}

class EntityAliasManager {
  private aliasMap = new Map<string, AliasMapping>();
  
  addAlias(canonical: string, alias: string, confidence: number): void {
    if (!this.aliasMap.has(canonical)) {
      this.aliasMap.set(canonical, {
        canonical,
        aliases: new Set(),
        confidence_scores: new Map()
      });
    }
    
    const mapping = this.aliasMap.get(canonical)!;
    mapping.aliases.add(alias);
    mapping.confidence_scores.set(alias, confidence);
  }
  
  resolveEntity(mention: string): string | null {
    // Direct match
    for (const [canonical, mapping] of this.aliasMap) {
      if (mapping.aliases.has(mention.toLowerCase())) {
        return canonical;
      }
    }
    
    // Fuzzy match (Levenshtein distance)
    const candidates = this.findFuzzyMatches(mention);
    return candidates.length > 0 ? candidates[0].canonical : null;
  }
}
```

## Integration with Current Memory System

### Extension Points in memory_manager.ts
Current extraction happens in `createFromConversation` (L489):
```typescript
// Current: semanticIds = await agentSemantic.extractAndStore(agent_id, messages);
// Enhanced: Add graph extraction alongside semantic extraction

async createFromConversation(messages: any[], auto_consolidate: boolean = true): Promise<string[]> {
  // ... existing episodic creation ...
  
  // Enhanced extraction for graph + semantic
  const extractionResults = await this.extractForGraphAndSemantic(agent_id, messages);
  
  // Queue graph entities/relations for account-level processing
  if (extractionResults.entities.length > 0 || extractionResults.relations.length > 0) {
    await this.queueGraphIngestion({
      source_kind: 'message',
      source_id: messages[0]?.id,
      agent_id,
      entities: extractionResults.entities,
      relations: extractionResults.relations,
      content: messages.map(m => m.content).join('\n')
    });
  }
  
  // Continue with existing semantic storage
  const semanticIds = await this.storeSemanticMemories(extractionResults.concepts);
  
  return [...episodicIds, ...semanticIds];
}
```

### Caching Strategy
```typescript
// Cache extraction results to avoid reprocessing
interface ExtractionCache {
  content_hash: string;
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  extracted_at: string;
  ttl: number; // Cache TTL in seconds
}

class ExtractionCacheManager {
  async getCached(contentHash: string): Promise<ExtractionCache | null> {
    const { data } = await this.supabase
      .from('extraction_cache')
      .select('*')
      .eq('content_hash', contentHash)
      .gt('extracted_at', new Date(Date.now() - (data?.ttl || 86400) * 1000).toISOString())
      .single();
      
    return data;
  }
  
  async setCached(contentHash: string, results: ExtractionCache): Promise<void> {
    await this.supabase
      .from('extraction_cache')
      .upsert({ content_hash: contentHash, ...results });
  }
}
```

## Performance Considerations

### Batch Processing
- Process multiple messages in single LLM call when possible
- Implement extraction queues for async processing
- Use streaming for real-time extraction feedback

### Cost Optimization
- Cache extraction results by content hash
- Use cheaper models for initial NER, expensive models for relationships
- Implement confidence thresholds to filter low-quality extractions

### Quality Assurance
- A/B test different extraction prompts
- Track extraction accuracy via user feedback
- Implement extraction confidence calibration
