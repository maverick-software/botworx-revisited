// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.223.0/assert/mod.ts";
import { MemoryManager } from "../chat/core/memory/memory_manager.ts";

class StubFrom {
  constructor(private table: string, private db: any) {}
  private _filters: Record<string, any> = {};
  select(_: string) { return this; }
  eq(col: string, val: any) { this._filters[col] = val; return this; }
  single() { return this.maybeSingle(); }
  in(_: string, __: any[]) { return Promise.resolve({ data: [], error: null }); }
  order() { return this; }
  limit() { return this; }
  gte() { return this; }
  or() { return this; }
  maybeSingle() {
    const rows = (this.db[this.table] || []).filter((r: any) => {
      return Object.entries(this._filters).every(([k, v]) => r[k] === v);
    });
    return Promise.resolve({ data: rows[0] || null, error: null });
  }
  async insert(row: any) {
    if (!this.db[this.table]) this.db[this.table] = [];
    if (Array.isArray(row)) this.db[this.table].push(...row); else this.db[this.table].push(row);
    return { data: row, error: null } as any;
  }
}

class StubSupabase {
  constructor(public db: any) {}
  from(name: string) { return new StubFrom(name, this.db); }
  rpc(_: string, __?: any) { return Promise.resolve({ data: 'noop', error: null }); }
}

const OpenAIStub = class { embeddings = { create: async () => ({ data: [{ embedding: [] }] }) } } as any;

Deno.test('createFromConversation enqueues graph ingestion payload', async () => {
  const db: any = {
    agents: [{ id: 'agent_1', user_id: 'user_1' }],
    account_graphs: [{ id: 'graph_1', user_id: 'user_1', provider: 'getzep', connection_id: 'conn_1', settings: {}, status: 'active' }],
    user_oauth_connections: [{ id: 'conn_1', user_id: 'user_1', vault_access_token_id: 'v1', connection_status: 'active' }],
    graph_ingestion_queue: [],
  };
  const supabase = new StubSupabase(db) as any;
  const mm = new MemoryManager(supabase, null as any, new OpenAIStub(), {
    index_name: 'x', embedding_model: 'text-embedding-3-small'
  } as any);
  // Stub managers to avoid heavy work
  (mm as any).episodicManager = { createFromConversation: async () => ['e1','e2'] };
  (mm as any).semanticManager = { extractAndStore: async () => ['s1'] };

  const msgs = [{ context: { agent_id: 'agent_1' }, role: 'user', content: { type: 'text', text: 'Hello' }, id: 'm1' }];
  const ids = await mm.createFromConversation(msgs, true);
  assertEquals(Array.isArray(ids), true);
  // Verify enqueue happened
  const q = db.graph_ingestion_queue as any[];
  assertEquals(q.length > 0, true);
  assertEquals(q[0].account_graph_id, 'graph_1');
  assertEquals(q[0].payload.agent_id, 'agent_1');
  assertEquals(q[0].payload.user_id, 'user_1');
});


