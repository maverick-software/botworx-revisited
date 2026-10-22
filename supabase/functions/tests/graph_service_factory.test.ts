// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.223.0/assert/mod.ts";
import { GraphServiceFactory } from "../../src/lib/graph/GraphServiceFactory_shim.ts";

// NOTE: To avoid bundling frontend path, we use a lightweight shim that re-exports the same factory
// In CI we can map imports accordingly; for local test, we simulate Supabase with a stub object

// Minimal shim of SupabaseClient used by factory
class StubFrom {
  constructor(private table: string, private rows: Record<string, any>[]) {}
  select(_: string) { return this; }
  eq(_c: string, _v: any) { return this; }
  maybeSingle() { return Promise.resolve({ data: this.rows[0] || null, error: null }); }
}

class StubSupabase {
  constructor(private tables: Record<string, any[]>) {}
  from(name: string) { return new StubFrom(name, this.tables[name] || []); }
  rpc(_: string, __: any) { return Promise.resolve({ data: "sk_test", error: null }); }
}

Deno.test("GraphServiceFactory pulls projectId/accountId from connection_metadata", async () => {
  const tables = {
    account_graphs: [{ id: "g1", user_id: "u1", connection_id: "c1", provider: 'getzep', settings: {} }],
    user_oauth_connections: [{ id: "c1", user_id: "u1", vault_access_token_id: "v1", connection_metadata: { project_id: "proj_123", account_id: "acc_999" } }],
  } as any;
  const supabase = new StubSupabase(tables) as any;
  const service = await GraphServiceFactory.createGetZepService("g1", supabase);
  // we only verify the options wiring via private fields snapshot
  // deno-lint-ignore no-explicit-any
  const anyService = service as any;
  assertEquals(!!service, true);
  assertEquals(anyService?.options?.projectId, "proj_123");
  assertEquals(anyService?.options?.accountId, "acc_999");
});


