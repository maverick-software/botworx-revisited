-- Final Table Designs: Account-Wide Knowledge Graph (GetZep)
-- Safe to run in a migration after backups. Uses explicit RLS and indexes.
-- IMPORTANT: Create indexes CONCURRENTLY in production migrations.

BEGIN;

-- 1) account_graphs: one per user (account), indicates provider + connectionId
CREATE TABLE IF NOT EXISTS account_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'getzep',
    connection_id UUID REFERENCES user_oauth_connections(id),
    settings JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) graph_nodes: entities in the knowledge graph
CREATE TABLE IF NOT EXISTS graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_graph_id UUID NOT NULL REFERENCES account_graphs(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    kind TEXT NOT NULL, -- 'entity' | 'property' | 'concept' | 'conclusion' | domain-specific kinds
    label TEXT NOT NULL,
    aliases TEXT[] NOT NULL DEFAULT '{}',
    properties JSONB NOT NULL DEFAULT '{}',
    provenance JSONB NOT NULL DEFAULT '{}', -- sources, supporting_node_ids, supporting_edge_ids, method, justification
    confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_graph_id, external_id)
);

-- 3) graph_edges: relationships between entities
CREATE TABLE IF NOT EXISTS graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_graph_id UUID NOT NULL REFERENCES account_graphs(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    src_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    dst_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_graph_id, external_id)
);

-- 4) graph_links: backlinks to vectors/messages/documents
CREATE TABLE IF NOT EXISTS graph_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_graph_id UUID NOT NULL REFERENCES account_graphs(id) ON DELETE CASCADE,
    node_id UUID REFERENCES graph_nodes(id) ON DELETE CASCADE,
    edge_id UUID REFERENCES graph_edges(id) ON DELETE CASCADE,
    vector_id TEXT,
    source_kind TEXT NOT NULL CHECK (source_kind IN ('message','document','connector','manual')),
    source_id UUID,
    agent_id UUID REFERENCES agents(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((node_id IS NOT NULL AND edge_id IS NULL) OR (node_id IS NULL AND edge_id IS NOT NULL))
);

-- 5) graph_ingestion_queue: async extraction/ingestion
CREATE TABLE IF NOT EXISTS graph_ingestion_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_graph_id UUID NOT NULL REFERENCES account_graphs(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','error')),
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (use CONCURRENTLY in production migrations)
CREATE INDEX IF NOT EXISTS idx_account_graphs_user_id ON account_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph ON graph_nodes(account_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_external ON graph_nodes(account_graph_id, external_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_label ON graph_nodes(account_graph_id, label);
CREATE INDEX IF NOT EXISTS idx_graph_edges_graph ON graph_edges(account_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_src_dst ON graph_edges(src_node_id, dst_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_kind ON graph_edges(account_graph_id, kind);
CREATE INDEX IF NOT EXISTS idx_graph_links_graph ON graph_links(account_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_links_node ON graph_links(node_id) WHERE node_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_graph_links_edge ON graph_links(edge_id) WHERE edge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_graph_links_vector ON graph_links(vector_id) WHERE vector_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_graph_links_source ON graph_links(source_kind, source_id);
CREATE INDEX IF NOT EXISTS idx_graph_queue_status ON graph_ingestion_queue(account_graph_id, status);
CREATE INDEX IF NOT EXISTS idx_graph_queue_created ON graph_ingestion_queue(created_at);

-- RLS policies
ALTER TABLE account_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_ingestion_queue ENABLE ROW LEVEL SECURITY;

-- Users can only access graphs they own
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'account_graphs' AND policyname = 'account_graphs_user_access'
    ) THEN
        CREATE POLICY account_graphs_user_access ON account_graphs FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- Nodes/edges/links/queue rows must belong to a graph owned by the user
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'graph_nodes' AND policyname = 'graph_nodes_user_access'
    ) THEN
        CREATE POLICY graph_nodes_user_access ON graph_nodes FOR ALL USING (
            account_graph_id IN (SELECT id FROM account_graphs WHERE user_id = auth.uid())
        );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'graph_edges' AND policyname = 'graph_edges_user_access'
    ) THEN
        CREATE POLICY graph_edges_user_access ON graph_edges FOR ALL USING (
            account_graph_id IN (SELECT id FROM account_graphs WHERE user_id = auth.uid())
        );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'graph_links' AND policyname = 'graph_links_user_access'
    ) THEN
        CREATE POLICY graph_links_user_access ON graph_links FOR ALL USING (
            account_graph_id IN (SELECT id FROM account_graphs WHERE user_id = auth.uid())
        );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'graph_ingestion_queue' AND policyname = 'graph_queue_user_access'
    ) THEN
        CREATE POLICY graph_queue_user_access ON graph_ingestion_queue FOR ALL USING (
            account_graph_id IN (SELECT id FROM account_graphs WHERE user_id = auth.uid())
        );
    END IF;
END $$;

COMMIT;


