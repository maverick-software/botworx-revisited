# Research: GetZep Service API Integration

## Current Credential Pattern Analysis
From codebase analysis of existing integrations:

### Existing OAuth/API Key Resolution (from CredentialSelector.tsx, IntegrationSetupModal.tsx)
- API keys stored in Supabase Vault via `user_oauth_connections.vault_access_token_id`
- Resolution pattern: `connectionId` → `user_oauth_connections` → `vault_decrypt(vault_access_token_id)`
- Used in Pinecone integration: `supabase.rpc('vault_decrypt', { vault_id: ... })`

### Current Service Architecture Patterns
From `src/lib/services/` analysis:
- Services follow pattern: constructor takes supabase client, methods are async
- Error handling with try/catch, structured error responses
- Rate limiting and retries handled per-service

## GetZep API Research & Analysis

### Based on Memory Store Architecture Patterns
From web research on graph-vector integration:
- Modern knowledge graph APIs typically expose REST endpoints for nodes, edges, and queries
- Batch operations are standard for performance (upsert multiple nodes/edges atomically)
- Neighborhood queries support hop depth, filtering, and result limits

### Proposed GetZep Service Interface
```typescript
// src/lib/services/graph/getzep_service.ts
export interface GetZepNode {
  id: string; // external_id for deduplication
  type: string; // 'person', 'organization', 'concept', etc.
  label: string;
  aliases?: string[];
  properties?: Record<string, any>;
  confidence?: number;
}

export interface GetZepEdge {
  id: string;
  source_id: string;
  target_id: string;
  type: string; // 'works_at', 'mentions', 'related_to', etc.
  properties?: Record<string, any>;
  confidence?: number;
}

export interface NeighborhoodQuery {
  node_ids?: string[];
  concepts?: string[]; // For concept-based search
  hop_depth?: number;
  limit?: number;
  confidence_threshold?: number;
  edge_types?: string[];
}

export class GetZepService {
  constructor(private supabase: SupabaseClient, private apiKey: string) {}
  
  // Batch operations for performance
  async upsertNodes(nodes: GetZepNode[]): Promise<{ created: number; updated: number }>;
  async upsertEdges(edges: GetZepEdge[]): Promise<{ created: number; updated: number }>;
  
  // Query operations
  async queryNeighborhood(query: NeighborhoodQuery): Promise<{
    nodes: GetZepNode[];
    edges: GetZepEdge[];
  }>;
  
  // Utility operations
  async healthCheck(): Promise<{ status: 'healthy' | 'error'; details?: string }>;
  async getNodeById(id: string): Promise<GetZepNode | null>;
  async deleteNode(id: string): Promise<boolean>;
}
```

### API Key Resolution Pattern
Following existing datastore pattern:
```typescript
// Resolve API key from connectionId (similar to memory_manager.ts L660-670)
async function resolveGetZepApiKey(
  connectionId: string, 
  userId: string, 
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: connRow } = await supabase
    .from('user_oauth_connections')
    .select('vault_access_token_id')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .maybeSingle();
    
  if (!connRow?.vault_access_token_id) return null;
  
  const { data: decrypted } = await supabase.rpc('vault_decrypt', { 
    vault_id: connRow.vault_access_token_id 
  });
  
  return decrypted as string;
}
```

## Implementation Strategy

### Service Factory Pattern
```typescript
// src/lib/services/graph/graph_service_factory.ts
export class GraphServiceFactory {
  static async createGetZepService(
    accountGraphId: string,
    supabase: SupabaseClient
  ): Promise<GetZepService | null> {
    // Resolve account graph and connection
    const { data: accountGraph } = await supabase
      .from('account_graphs')
      .select('connection_id, user_id')
      .eq('id', accountGraphId)
      .single();
      
    if (!accountGraph?.connection_id) return null;
    
    const apiKey = await resolveGetZepApiKey(
      accountGraph.connection_id,
      accountGraph.user_id,
      supabase
    );
    
    return apiKey ? new GetZepService(supabase, apiKey) : null;
  }
}
```

### Error Handling & Rate Limiting
Following patterns from existing services:
- Exponential backoff on 429/5xx responses
- Circuit breaker pattern for repeated failures  
- Structured error types with context
- Request timeout configuration (30s default)
- Idempotency via external_id to handle retries safely

### Batch Size Optimization
Based on typical graph API limits:
- Nodes: 100-500 per batch (depending on property size)
- Edges: 1000-5000 per batch (typically smaller)
- Implement chunking with progress tracking
- Parallel batch processing with concurrency limits

## Integration Points

### With Account Graph Tables
- `external_id` in local tables maps to GetZep node/edge IDs
- Bidirectional sync: local changes push to GetZep, periodic sync pulls updates
- Conflict resolution: GetZep as source of truth, local cache for performance

### With Existing Memory Pipeline
Integration points in current architecture:
- `memory_manager.ts`: Add graph extraction alongside semantic memory creation
- `stages.ts` EnrichmentStage: Add graph neighborhood query after vector search
- `handlers.ts`: Include graph context in LLM prompt alongside episodic/semantic context

### Error Recovery & Resilience
- Local queue for failed operations (graph_ingestion_queue table)
- Periodic reconciliation job to sync local state with GetZep
- Graceful degradation: continue with vector-only search if graph unavailable
- Health check integration with existing monitoring

## Testing Strategy
- Mock GetZep service for unit tests
- Integration tests with real GetZep instance (staging)
- Load testing for batch operations
- Failure mode testing (network issues, API limits, malformed data)

## Migration Considerations
- Existing GetZep datastores → account_graphs migration
- Backfill historical data in batches to avoid API limits
- Feature flag rollout to control graph service activation
- Monitoring dashboard for API usage, error rates, and performance metrics
