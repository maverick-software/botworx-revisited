// Semantic Memory Manager
// Handles long-term knowledge storage, facts, and concept relationships

import { SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { Pinecone } from 'npm:@pinecone-database/pinecone@2.0.0';
import OpenAI from 'npm:openai@6.1.0';
import {
  SemanticMemory,
  AgentMemory,
} from '../../types/memory.types.ts';
import { AdvancedChatMessage } from '../../types/message.types.ts';
import { MemoryFactory } from './memory_factory.ts';
import { generateTimestamp, generateMemoryId } from '../../types/utils.ts';

// ============================
// Interfaces
// ============================

export interface ConceptRelationship {
  source_concept: string;
  target_concept: string;
  relationship_type: 'is_a' | 'part_of' | 'related_to' | 'causes' | 'contradicts' | 'synonym';
  strength: number;
  evidence: string[];
}

export interface KnowledgeGraph {
  concepts: Map<string, SemanticMemory>;
  relationships: ConceptRelationship[];
  clusters: Array<{
    name: string;
    concepts: string[];
    centrality: number;
  }>;
}

export interface ConceptQuery {
  agent_id: string;
  concept?: string;
  similarity_threshold?: number;
  include_related?: boolean;
  max_depth?: number;
  confidence_threshold?: number;
  source_filter?: string[];
  limit?: number;
}

export interface KnowledgeExtraction {
  concepts: Array<{
    concept: string;
    definition: string;
    confidence: number;
    evidence: string[];
  }>;
  relationships: ConceptRelationship[];
  facts: Array<{
    fact: string;
    confidence: number;
    source: string;
  }>;
}

// ============================
// Semantic Memory Manager Implementation
// ============================

export class SemanticMemoryManager {
  constructor(
    private supabase: SupabaseClient,
    private pinecone: Pinecone,
    private openai: OpenAI,
    private config: {
      index_name: string;
      namespace?: string;
      embedding_model?: string;
    }
  ) {}
  
  /**
   * Store semantic knowledge from conversation
   */
  async extractAndStore(
    agent_id: string,
    messages: AdvancedChatMessage[]
  ): Promise<string[]> {
    const extraction = await this.extractKnowledge(messages);
    const memoryIds: string[] = [];
    
    // Store concepts
    for (const conceptData of extraction.concepts) {
      const memory = MemoryFactory.createFromConcept(
        agent_id,
        conceptData.concept,
        conceptData.definition,
        'conversation',
        { importance: conceptData.confidence }
      );
      
      const memoryId = await this.storeSemanticMemory(memory as SemanticMemory);
      memoryIds.push(memoryId);
    }
    
    // Store relationships
    await this.storeRelationships(agent_id, extraction.relationships);
    
    // Update knowledge graph
    await this.updateKnowledgeGraph(agent_id);
    
    return memoryIds;
  }
  
  /**
   * Query semantic memories
   */
  async query(query: ConceptQuery): Promise<SemanticMemory[]> {
    if (query.concept) {
      return await this.searchByConcept(query);
    } else {
      return await this.browseKnowledge(query);
    }
  }
  
  /**
   * Find related concepts
   */
  async findRelated(
    agent_id: string,
    concept: string,
    max_depth: number = 2
  ): Promise<Array<{
    concept: SemanticMemory;
    relationship_path: ConceptRelationship[];
    distance: number;
  }>> {
    const graph = await this.buildKnowledgeGraph(agent_id);
    const results: Array<{
      concept: SemanticMemory;
      relationship_path: ConceptRelationship[];
      distance: number;
    }> = [];
    
    // Breadth-first search for related concepts
    const visited = new Set<string>();
    const queue: Array<{
      concept_name: string;
      path: ConceptRelationship[];
      depth: number;
    }> = [{ concept_name: concept, path: [], depth: 0 }];
    
    while (queue.length > 0 && results.length < 20) {
      const current = queue.shift()!;
      
      if (visited.has(current.concept_name) || current.depth > max_depth) {
        continue;
      }
      
      visited.add(current.concept_name);
      
      // Add concept if not the starting concept
      if (current.depth > 0) {
        const conceptMemory = graph.concepts.get(current.concept_name);
        if (conceptMemory) {
          results.push({
            concept: conceptMemory,
            relationship_path: current.path,
            distance: current.depth,
          });
        }
      }
      
      // Find connected concepts
      for (const relationship of graph.relationships) {
        let nextConcept: string | null = null;
        
        if (relationship.source_concept === current.concept_name) {
          nextConcept = relationship.target_concept;
        } else if (relationship.target_concept === current.concept_name) {
          nextConcept = relationship.source_concept;
        }
        
        if (nextConcept && !visited.has(nextConcept)) {
          queue.push({
            concept_name: nextConcept,
            path: [...current.path, relationship],
            depth: current.depth + 1,
          });
        }
      }
    }
    
    return results.sort((a, b) => a.distance - b.distance);
  }
  
  /**
   * Update concept with new information
   */
  async updateConcept(
    agent_id: string,
    concept: string,
    new_information: string,
    source: string = 'update'
  ): Promise<void> {
    // Find existing concept
    const existing = await this.searchByConcept({
      agent_id,
      concept,
      limit: 1,
    });
    
    if (existing.length > 0) {
      const memory = existing[0];
      
      // Merge information
      const updatedDefinition = await this.mergeDefinitions(
        memory.content.definition,
        new_information
      );
      
      // Update memory
      await this.supabase
        .from('agent_memories')
        .update({
          content: {
            ...memory.content,
            definition: updatedDefinition,
            last_verified: generateTimestamp(),
            confidence: Math.min(memory.content.confidence + 0.1, 1.0),
          },
          importance: Math.min(memory.importance + 0.05, 1.0),
          last_accessed: generateTimestamp(),
        })
        .eq('id', memory.id);
      
      // Update vector embedding
      await this.updateEmbedding(memory.id, updatedDefinition);
      
    } else {
      // Create new concept
      const newMemory = MemoryFactory.createFromConcept(
        agent_id,
        concept,
        new_information,
        source
      );
      
      await this.storeSemanticMemory(newMemory as SemanticMemory);
    }
  }
  
  /**
   * Verify concept accuracy
   */
  async verifyConcept(
    memory_id: string,
    verification_source?: string
  ): Promise<{
    verified: boolean;
    confidence_change: number;
    notes: string;
  }> {
    // Get the memory
    const { data: memory, error } = await this.supabase
      .from('agent_memories')
      .select('*')
      .eq('id', memory_id)
      .single();
    
    if (error || !memory) {
      throw new Error(`Memory not found: ${memory_id}`);
    }
    
    const semanticMemory = memory as SemanticMemory;
    
    // In a production system, this would:
    // 1. Check against authoritative sources
    // 2. Cross-reference with other memories
    // 3. Use fact-checking APIs
    
    // For now, simulate verification
    const isAccurate = await this.checkFactAccuracy(
      semanticMemory.content.concept,
      semanticMemory.content.definition
    );
    
    let confidenceChange = 0;
    let notes = '';
    
    if (isAccurate) {
      confidenceChange = 0.1;
      notes = 'Concept verified as accurate';
    } else {
      confidenceChange = -0.2;
      notes = 'Concept may be inaccurate - needs review';
    }
    
    // Update confidence
    await this.supabase
      .from('agent_memories')
      .update({
        content: {
          ...semanticMemory.content,
          confidence: Math.max(0.1, Math.min(1.0, 
            semanticMemory.content.confidence + confidenceChange
          )),
          last_verified: generateTimestamp(),
        },
      })
      .eq('id', memory_id);
    
    return {
      verified: isAccurate,
      confidence_change: confidenceChange,
      notes,
    };
  }
  
  /**
   * Build knowledge graph for visualization
   */
  async buildKnowledgeGraph(agent_id: string): Promise<KnowledgeGraph> {
    // Get all semantic memories
    const { data: memories, error } = await this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('memory_type', 'semantic');
    
    if (error) {
      throw new Error(`Failed to fetch semantic memories: ${error.message}`);
    }
    
    const concepts = new Map<string, SemanticMemory>();
    for (const memory of memories || []) {
      const semanticMemory = memory as SemanticMemory;
      concepts.set(semanticMemory.content.concept, semanticMemory);
    }
    
    // Get relationships
    const relationships = await this.getRelationships(agent_id);
    
    // Detect clusters
    const clusters = this.detectConceptClusters(concepts, relationships);
    
    return {
      concepts,
      relationships,
      clusters,
    };
  }
  
  /**
   * Consolidate similar concepts
   */
  async consolidateConcepts(
    agent_id: string,
    similarity_threshold: number = 0.8
  ): Promise<{
    consolidated_count: number;
    removed_ids: string[];
  }> {
    const { data: memories, error } = await this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('memory_type', 'semantic');
    
    if (error || !memories) {
      throw new Error(`Failed to fetch memories for consolidation: ${error.message}`);
    }
    
    const semanticMemories = memories as SemanticMemory[];
    const toRemove: string[] = [];
    let consolidatedCount = 0;
    
    // Find similar concepts
    for (let i = 0; i < semanticMemories.length; i++) {
      if (toRemove.includes(semanticMemories[i].id)) continue;
      
      const similar: SemanticMemory[] = [semanticMemories[i]];
      
      for (let j = i + 1; j < semanticMemories.length; j++) {
        if (toRemove.includes(semanticMemories[j].id)) continue;
        
        const similarity = await this.calculateConceptSimilarity(
          semanticMemories[i],
          semanticMemories[j]
        );
        
        if (similarity >= similarity_threshold) {
          similar.push(semanticMemories[j]);
          toRemove.push(semanticMemories[j].id);
        }
      }
      
      // Consolidate if multiple similar concepts found
      if (similar.length > 1) {
        await this.mergeConcepts(similar);
        consolidatedCount++;
      }
    }
    
    // Remove consolidated memories
    if (toRemove.length > 0) {
      await this.supabase
        .from('agent_memories')
        .delete()
        .in('id', toRemove);
    }
    
    return {
      consolidated_count: consolidatedCount,
      removed_ids: toRemove,
    };
  }
  
  // ============================
  // Private Methods
  // ============================
  
  private async storeSemanticMemory(memory: SemanticMemory): Promise<string> {
    // Generate embedding
    const embedding = await this.generateEmbedding(
      `${memory.content.concept}: ${memory.content.definition}`
    );
    
    // Store in database
    const { data, error } = await this.supabase
      .from('agent_memories')
      .insert({
        ...memory,
        embeddings: embedding,
      })
      .select('id')
      .single();
    
    if (error) {
      throw new Error(`Failed to store semantic memory: ${error.message}`);
    }
    
    // Store in vector database
    const index = this.pinecone.Index(this.config.index_name);
    await index.upsert([{
      id: data.id,
      values: embedding,
      metadata: {
        agent_id: memory.agent_id,
        memory_type: 'semantic',
        concept: memory.content.concept,
        source: memory.content.source,
        confidence: memory.content.confidence,
      },
    }]);
    
    return data.id;
  }
  
  private async extractKnowledge(
    messages: AdvancedChatMessage[]
  ): Promise<KnowledgeExtraction> {
    const conversationText = messages
      .filter(m => m.content.type === 'text')
      .map(m => m.content.text)
      .join('\n\n');
    
    // Use LLM to extract structured knowledge (router if enabled)
    let extractionText = '';
    const useRouter = (Deno.env.get('USE_LLM_ROUTER') || '').toLowerCase() === 'true';
    if (useRouter && (messages[0] as any)?.context?.agent_id) {
      const { LLMRouter } = await import('../../../shared/llm/router.ts');
      const router = new LLMRouter();
      const resp = await router.chat((messages[0] as any).context.agent_id, [
        { role: 'system', content: `Extract factual knowledge from the conversation. Return JSON with:
{
  "concepts": [{"concept": "name", "definition": "definition", "confidence": 0.8}],
  "relationships": [{"source": "concept1", "target": "concept2", "type": "is_a", "strength": 0.7}],
  "facts": [{"fact": "statement", "confidence": 0.9, "source": "user/assistant"}]
}

Only include information that is stated as fact, not opinions or questions.` },
        { role: 'user', content: conversationText },
      ] as any);
      extractionText = resp.text || '';
    } else {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: `Extract factual knowledge from the conversation. Return JSON with:
{
  "concepts": [{"concept": "name", "definition": "definition", "confidence": 0.8}],
  "relationships": [{"source": "concept1", "target": "concept2", "type": "is_a", "strength": 0.7}],
  "facts": [{"fact": "statement", "confidence": 0.9, "source": "user/assistant"}]
}

Only include information that is stated as fact, not opinions or questions.`,
        }, {
          role: 'user',
          content: conversationText,
        }],
        response_format: { type: 'json_object' },
      });
      extractionText = response.choices[0].message.content || '';
    }
    
    try {
      const extracted = JSON.parse(extractionText || '{}');
      
      return {
        concepts: extracted.concepts || [],
        relationships: extracted.relationships?.map((r: any) => ({
          source_concept: r.source,
          target_concept: r.target,
          relationship_type: r.type,
          strength: r.strength,
          evidence: [conversationText.slice(0, 200)],
        })) || [],
        facts: extracted.facts || [],
      };
    } catch (error) {
      console.error('Failed to parse knowledge extraction:', error);
      return { concepts: [], relationships: [], facts: [] };
    }
  }
  
  private async searchByConcept(query: ConceptQuery): Promise<SemanticMemory[]> {
    if (!query.concept) {
      throw new Error('Concept is required for concept search');
    }
    
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query.concept);
    
    // Search in Pinecone
    const index = this.pinecone.Index(this.config.index_name);
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: query.limit || 10,
      includeMetadata: true,
      filter: {
        agent_id: { $eq: query.agent_id },
        memory_type: { $eq: 'semantic' },
        ...(query.confidence_threshold && {
          confidence: { $gte: query.confidence_threshold }
        }),
        ...(query.source_filter && {
          source: { $in: query.source_filter }
        }),
      },
    });
    
    // Fetch full memories from database
    const memoryIds = searchResults.matches
      .filter(m => (m.score || 0) >= (query.similarity_threshold || 0.7))
      .map(m => m.id);
    
    if (memoryIds.length === 0) {
      return [];
    }
    
    const { data: memories, error } = await this.supabase
      .from('agent_memories')
      .select('*')
      .in('id', memoryIds);
    
    if (error) {
      throw new Error(`Failed to fetch semantic memories: ${error.message}`);
    }
    
    return (memories || []) as SemanticMemory[];
  }
  
  private async browseKnowledge(query: ConceptQuery): Promise<SemanticMemory[]> {
    let dbQuery = this.supabase
      .from('agent_memories')
      .select('*')
      .eq('agent_id', query.agent_id)
      .eq('memory_type', 'semantic');
    
    if (query.confidence_threshold) {
      dbQuery = dbQuery.gte('content->confidence', query.confidence_threshold);
    }
    
    if (query.source_filter) {
      dbQuery = dbQuery.in('content->source', query.source_filter);
    }
    
    const { data, error } = await dbQuery
      .order('importance', { ascending: false })
      .limit(query.limit || 50);
    
    if (error) {
      throw new Error(`Failed to browse semantic memories: ${error.message}`);
    }
    
    return (data || []) as SemanticMemory[];
  }
  
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.config.embedding_model || 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  }
  
  private async updateEmbedding(memory_id: string, text: string): Promise<void> {
    const embedding = await this.generateEmbedding(text);
    
    // Update database
    await this.supabase
      .from('agent_memories')
      .update({ embeddings: embedding })
      .eq('id', memory_id);
    
    // Update vector database
    const index = this.pinecone.Index(this.config.index_name);
    await index.update({
      id: memory_id,
      values: embedding,
    });
  }
  
  private async storeRelationships(
    agent_id: string,
    relationships: ConceptRelationship[]
  ): Promise<void> {
    // Store relationships in a separate table or as part of memory metadata
    // For simplicity, we'll store them as related_memories in the concepts
    
    for (const relationship of relationships) {
      // Find source concept
      const sourceResults = await this.searchByConcept({
        agent_id,
        concept: relationship.source_concept,
        limit: 1,
      });
      
      // Find target concept
      const targetResults = await this.searchByConcept({
        agent_id,
        concept: relationship.target_concept,
        limit: 1,
      });
      
      if (sourceResults.length > 0 && targetResults.length > 0) {
        const sourceId = sourceResults[0].id;
        const targetId = targetResults[0].id;
        
        // Update both memories with the relationship
        await this.addRelationship(sourceId, targetId);
        await this.addRelationship(targetId, sourceId);
      }
    }
  }
  
  private async addRelationship(
    memory_id: string,
    related_id: string
  ): Promise<void> {
    const { data: memory, error } = await this.supabase
      .from('agent_memories')
      .select('related_memories')
      .eq('id', memory_id)
      .single();
    
    if (error) return;
    
    const currentRelated = memory?.related_memories || [];
    const updatedRelated = [...currentRelated, related_id]
      .filter((id, index, self) => self.indexOf(id) === index);
    
    await this.supabase
      .from('agent_memories')
      .update({ related_memories: updatedRelated })
      .eq('id', memory_id);
  }
  
  private async getRelationships(agent_id: string): Promise<ConceptRelationship[]> {
    const { data: memories, error } = await this.supabase
      .from('agent_memories')
      .select('id, content, related_memories')
      .eq('agent_id', agent_id)
      .eq('memory_type', 'semantic');
    
    if (error || !memories) return [];
    
    const relationships: ConceptRelationship[] = [];
    
    for (const memory of memories) {
      const semanticMemory = memory as SemanticMemory;
      const relatedIds = memory.related_memories || [];
      
      for (const relatedId of relatedIds) {
        const relatedMemory = memories.find(m => m.id === relatedId);
        if (relatedMemory) {
          const relatedSemantic = relatedMemory as SemanticMemory;
          
          relationships.push({
            source_concept: semanticMemory.content.concept,
            target_concept: relatedSemantic.content.concept,
            relationship_type: 'related_to',
            strength: 0.5,
            evidence: [],
          });
        }
      }
    }
    
    return relationships;
  }
  
  private detectConceptClusters(
    concepts: Map<string, SemanticMemory>,
    relationships: ConceptRelationship[]
  ): Array<{ name: string; concepts: string[]; centrality: number }> {
    // Simple clustering based on relationships
    const clusters: Array<{ name: string; concepts: string[]; centrality: number }> = [];
    const visited = new Set<string>();
    
    for (const [conceptName] of concepts) {
      if (visited.has(conceptName)) continue;
      
      // Find connected components
      const cluster = this.findConnectedConcepts(conceptName, relationships, visited);
      
      if (cluster.length > 1) {
        // Calculate centrality (simplified)
        const centrality = cluster.length / concepts.size;
        
        clusters.push({
          name: cluster[0], // Use first concept as cluster name
          concepts: cluster,
          centrality,
        });
      }
    }
    
    return clusters.sort((a, b) => b.centrality - a.centrality);
  }
  
  private findConnectedConcepts(
    startConcept: string,
    relationships: ConceptRelationship[],
    visited: Set<string>
  ): string[] {
    const cluster = [startConcept];
    const queue = [startConcept];
    visited.add(startConcept);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      for (const relationship of relationships) {
        let nextConcept: string | null = null;
        
        if (relationship.source_concept === current) {
          nextConcept = relationship.target_concept;
        } else if (relationship.target_concept === current) {
          nextConcept = relationship.source_concept;
        }
        
        if (nextConcept && !visited.has(nextConcept)) {
          cluster.push(nextConcept);
          queue.push(nextConcept);
          visited.add(nextConcept);
        }
      }
    }
    
    return cluster;
  }
  
  private async updateKnowledgeGraph(agent_id: string): Promise<void> {
    // This would update a cached knowledge graph representation
    // For now, we'll just log that the graph needs updating
    console.log(`Knowledge graph updated for agent ${agent_id}`);
  }
  
  private async mergeDefinitions(
    existing: string,
    newInfo: string
  ): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: 'Merge the existing definition with new information. Keep the result concise and accurate.',
      }, {
        role: 'user',
        content: `Existing: ${existing}\n\nNew information: ${newInfo}`,
      }],
      max_tokens: 200,
    });
    
    return response.choices[0].message.content || existing;
  }
  
  private async checkFactAccuracy(
    concept: string,
    definition: string
  ): Promise<boolean> {
    // In production, this would check against authoritative sources
    // For now, simulate with a simple heuristic
    return definition.length > 10 && !definition.includes('maybe') && !definition.includes('probably');
  }
  
  private async calculateConceptSimilarity(
    concept1: SemanticMemory,
    concept2: SemanticMemory
  ): Promise<number> {
    // Simple similarity based on concept name and definition overlap
    const name1 = concept1.content.concept.toLowerCase();
    const name2 = concept2.content.concept.toLowerCase();
    
    // Check for exact match or very similar names
    if (name1 === name2) return 1.0;
    
    const words1 = new Set(name1.split(/\s+/));
    const words2 = new Set(name2.split(/\s+/));
    const overlap = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    
    const nameScore = overlap / union;
    
    // Check definition similarity (simplified)
    const def1Words = new Set(concept1.content.definition.toLowerCase().split(/\s+/));
    const def2Words = new Set(concept2.content.definition.toLowerCase().split(/\s+/));
    const defOverlap = [...def1Words].filter(w => def2Words.has(w)).length;
    const defUnion = new Set([...def1Words, ...def2Words]).size;
    
    const defScore = defOverlap / defUnion;
    
    return (nameScore * 0.7 + defScore * 0.3);
  }
  
  private async mergeConcepts(concepts: SemanticMemory[]): Promise<void> {
    if (concepts.length < 2) return;
    
    const primary = concepts[0];
    const others = concepts.slice(1);
    
    // Merge definitions
    const allDefinitions = concepts.map(c => c.content.definition);
    const mergedDefinition = await this.mergeDefinitions(
      allDefinitions[0],
      allDefinitions.slice(1).join(' ')
    );
    
    // Calculate merged importance and confidence
    const maxImportance = Math.max(...concepts.map(c => c.importance));
    const avgConfidence = concepts.reduce((sum, c) => sum + c.content.confidence, 0) / concepts.length;
    
    // Update primary concept
    await this.supabase
      .from('agent_memories')
      .update({
        content: {
          ...primary.content,
          definition: mergedDefinition,
          confidence: Math.min(avgConfidence + 0.1, 1.0),
        },
        importance: maxImportance,
        related_memories: [
          ...(primary.related_memories || []),
          ...others.flatMap(c => c.related_memories || []),
          ...others.map(c => c.id),
        ],
      })
      .eq('id', primary.id);
    
    // Update embedding
    await this.updateEmbedding(
      primary.id,
      `${primary.content.concept}: ${mergedDefinition}`
    );
  }
}