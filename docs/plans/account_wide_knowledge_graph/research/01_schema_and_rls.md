# Research: Schema & RLS Design

## Current Schema Analysis (schema_dump.sql)

### Existing Account/User Scoping
- `agents` table (L3343+): `user_id` scoping, no explicit account concept
- `agent_datastores` table (L2929+): Junction between agents and datastores
- `datastores` table: Contains `user_id`, `type`, `config` jsonb, `similarity_threshold`, `max_results`
- `user_oauth_connections`: Stores encrypted credentials via `vault_access_token_id`
- `agent_memories` table (L3032+): Agent-scoped with embeddings vector(1536), importance scoring

### Current Datastore Pattern
From DatastoresPage.tsx analysis:
- Datastores use `config.connectionId` to reference `user_oauth_connections`
- GetZep datastores require: `connectionId`, `projectId`, `collectionName`
- Pinecone datastores require: `connectionId`, `region`, `host`, `indexName`, `dimensions`

### Current Memory Architecture
From memory_manager.ts analysis:
- `EpisodicMemoryManager`: Stores in `agent_memories` table
- `SemanticMemoryManager`: Stores in both `agent_memories` and Pinecone index
- Agent-scoped Pinecone resolution via `agent_datastores` → `datastores.config`

## Proposed Account Graph Schema

### Core Tables Design
```sql
-- Account-level graph container (one per user for now, could expand to teams)
CREATE TABLE account_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'getzep', -- 'getzep', 'neo4j', etc.
  connection_id UUID REFERENCES user_oauth_connections(id), -- Vault-backed API key
  settings JSONB DEFAULT '{}', -- hop_depth, neighborhood_limit, confidence_threshold, etc.
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Graph nodes (entities, properties, concepts, conclusions)
CREATE TABLE graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_graph_id UUID NOT NULL REFERENCES account_graphs(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, -- GetZep node ID or computed hash for dedup
  kind TEXT NOT NULL, -- 'entity' | 'property' | 'concept' | 'conclusion' | domain-specific kinds ('person','organization','document', etc.)
  label TEXT NOT NULL, -- Canonical display name
  aliases TEXT[] DEFAULT '{}', -- Alternative names/labels
  properties JSONB DEFAULT '{}', -- Flexible metadata (include provenance if not using separate column)
  provenance JSONB DEFAULT '{}', -- For 'concept'/'conclusion' nodes: sources, supporting_node_ids, supporting_edge_ids, method ('rule'|'llm'), justification
  confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_graph_id, external_id)
);

-- Graph edges (relationships)
CREATE TABLE graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_graph_id UUID NOT NULL REFERENCES account_graphs(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, -- GetZep edge ID or computed hash
  src_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  dst_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'works_at', 'knows', 'mentions', 'related_to', 'derived_from', 'supports', 'generalizes', 'contradicts', etc.
  properties JSONB DEFAULT '{}',
  confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_graph_id, external_id)
);

-- Bidirectional links between graph and vectors/messages/documents
CREATE TABLE graph_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_graph_id UUID NOT NULL REFERENCES account_graphs(id) ON DELETE CASCADE,
  node_id UUID REFERENCES graph_nodes(id) ON DELETE CASCADE,
  edge_id UUID REFERENCES graph_edges(id) ON DELETE CASCADE,
  -- Source tracking
  vector_id TEXT, -- Pinecone vector ID when linking to episodic memory
  source_kind TEXT NOT NULL CHECK (source_kind IN ('message', 'document', 'connector', 'manual')),
  source_id UUID, -- chat_message.id, document.id, etc.
  agent_id UUID REFERENCES agents(id), -- Which agent triggered this extraction
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (node_id IS NOT NULL AND edge_id IS NULL) OR 
    (node_id IS NULL AND edge_id IS NOT NULL)
  )
);

-- Ingestion queue for async processing
CREATE TABLE graph_ingestion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_graph_id UUID NOT NULL REFERENCES account_graphs(id) ON DELETE CASCADE,
  payload JSONB NOT NULL, -- {source_kind, source_id, content, agent_id, etc.}
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'error')),
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes for Performance
```sql
-- Core lookups
CREATE INDEX idx_account_graphs_user_id ON account_graphs(user_id);
CREATE INDEX idx_graph_nodes_account_graph_id ON graph_nodes(account_graph_id);
CREATE INDEX idx_graph_nodes_external_id ON graph_nodes(account_graph_id, external_id);
CREATE INDEX idx_graph_nodes_label ON graph_nodes(account_graph_id, label);
CREATE INDEX idx_graph_edges_account_graph_id ON graph_edges(account_graph_id);
CREATE INDEX idx_graph_edges_src_dst ON graph_edges(src_node_id, dst_node_id);
CREATE INDEX idx_graph_edges_kind ON graph_edges(account_graph_id, kind);

-- Link tracking
CREATE INDEX idx_graph_links_account_graph_id ON graph_links(account_graph_id);
CREATE INDEX idx_graph_links_node_id ON graph_links(node_id) WHERE node_id IS NOT NULL;
CREATE INDEX idx_graph_links_edge_id ON graph_links(edge_id) WHERE edge_id IS NOT NULL;
CREATE INDEX idx_graph_links_vector_id ON graph_links(vector_id) WHERE vector_id IS NOT NULL;
CREATE INDEX idx_graph_links_source ON graph_links(source_kind, source_id);

-- Queue processing
CREATE INDEX idx_graph_ingestion_queue_status ON graph_ingestion_queue(account_graph_id, status);
CREATE INDEX idx_graph_ingestion_queue_created ON graph_ingestion_queue(created_at) WHERE status = 'queued';
```

### RLS Policies
```sql
-- Account graphs: users can only access their own
ALTER TABLE account_graphs ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_graphs_user_access ON account_graphs 
  FOR ALL USING (auth.uid() = user_id);

-- Graph nodes/edges: access via account_graphs.user_id
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY graph_nodes_user_access ON graph_nodes 
  FOR ALL USING (
    account_graph_id IN (
      SELECT id FROM account_graphs WHERE user_id = auth.uid()
    )
  );

ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY graph_edges_user_access ON graph_edges 
  FOR ALL USING (
    account_graph_id IN (
      SELECT id FROM account_graphs WHERE user_id = auth.uid()
    )
  );

-- Similar policies for graph_links and graph_ingestion_queue
-- Service role bypasses RLS for background processing
```

## Integration Points

### With Existing Datastores
- Migrate existing GetZep datastores to create `account_graphs` entries
- Preserve `config.connectionId` pattern for API key resolution
- Update agent memory retrieval to query both datastores AND account graph

### With Current Memory System
- `agent_memories.embeddings` links to graph via `graph_links.vector_id`
- EnrichmentStage queries both vector search AND graph neighborhood
- Fusion scoring combines vector similarity + graph confidence + recency

### With UI Components
- Account-level settings page for graph configuration
- Agent-level toggles to enable/disable graph usage
- ProcessModal shows graph operations alongside memory operations

## Migration Strategy
1. Create new tables with RLS
2. Identify existing GetZep datastores → create `account_graphs`
3. Background job to extract entities/relations from historic messages/documents
4. Update Pinecone metadata with `node_ids`/`edge_ids`
5. Gradual rollout via feature flags

## Risks & Mitigations
- **Scale**: Graph can grow large → implement archiving, confidence-based pruning
- **Consistency**: Vector-graph links can drift → periodic reconciliation jobs
- **Latency**: Graph queries add overhead → caching, async processing where possible
