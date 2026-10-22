/*
  End-to-end Knowledge Graph ingestion test runner (TypeScript, Node)
  - Loads env from .env
  - Ensures an account graph exists (using the first active GetZep credential)
  - Seeds a test ingestion queue item
  - Triggers the graph-ingestion Supabase Edge Function
  - Polls graph node/edge counts and prints results
*/

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Json = Record<string, unknown> | null;

function readEnv(name: string, fallback?: string): string {
  const val = process.env[name] || (fallback ? process.env[fallback] : undefined);
  if (!val) throw new Error(`Missing required env: ${name}${fallback ? ` (or ${fallback})` : ''}`);
  return val;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureAccountGraph(supabase: SupabaseClient): Promise<{ accountGraphId: string; userId: string; connectionId: string; }>{
  // Find an active GetZep credential
  const { data: conn, error: connErr } = await supabase
    .from('user_oauth_connections')
    .select('id, user_id, oauth_provider_id')
    .eq('oauth_provider_id', (await supabase.from('service_providers').select('id').eq('name', 'getzep').single()).data?.id)
    .eq('connection_status', 'active')
    .limit(1)
    .maybeSingle();
  if (connErr) throw connErr;
  if (!conn) throw new Error('No active GetZep credential found. Please add one in Integrations.');

  const connectionId = conn.id as string;
  const userId = conn.user_id as string;

  // Check for an existing account_graphs entry bound to this connection
  const { data: existing, error: exErr } = await supabase
    .from('account_graphs')
    .select('id')
    .eq('connection_id', connectionId)
    .limit(1)
    .maybeSingle();
  if (exErr && exErr.code !== 'PGRST116') throw exErr; // ignore no rows

  if (existing?.id) {
    return { accountGraphId: existing.id, userId, connectionId };
  }

  // Create one
  const { data: inserted, error: insErr } = await supabase
    .from('account_graphs')
    .insert({
      user_id: userId,
      connection_id: connectionId,
      settings: {
        retrieval: { hop_depth: 2, max_results: 50 },
      } as Json,
    })
    .select('id')
    .single();
  if (insErr) throw insErr;

  return { accountGraphId: inserted.id, userId, connectionId };
}

async function seedQueue(
  supabase: SupabaseClient,
  accountGraphId: string,
  userId: string,
): Promise<string> {
  const payload = {
    source_kind: 'message',
    source_id: null,
    agent_id: null,
    user_id: userId,
    entities: [],
    relations: [],
    content: 'E2E graph ingestion test: Angela discussed using Pinecone for vector memory and GetZep for knowledge graph on Project Alpha.',
  };

  const { data, error } = await supabase
    .from('graph_ingestion_queue')
    .insert({
      account_graph_id: accountGraphId,
      payload: payload as Json,
      status: 'queued'
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function triggerIngestionFunction(supabaseUrl: string, serviceRoleKey: string): Promise<void> {
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/graph-ingestion`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trigger: 'e2e' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge Function call failed (${res.status}): ${text}`);
  }
}

async function readGraphMetrics(supabase: SupabaseClient, accountGraphId: string): Promise<{ nodes: number; edges: number; }>{
  const [{ count: nodeCount, error: nodeErr }, { count: edgeCount, error: edgeErr }] = await Promise.all([
    supabase.from('graph_nodes').select('id', { count: 'exact', head: true }).eq('account_graph_id', accountGraphId),
    supabase.from('graph_edges').select('id', { count: 'exact', head: true }).eq('account_graph_id', accountGraphId),
  ]);
  if (nodeErr) throw nodeErr;
  if (edgeErr) throw edgeErr;
  return { nodes: nodeCount ?? 0, edges: edgeCount ?? 0 };
}

async function main(): Promise<void> {
  const supabaseUrl = readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY');

  // Also keep anon available if needed by downstream calls
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  console.log('Ensuring account graph exists...');
  const { accountGraphId, userId } = await ensureAccountGraph(supabase);
  console.log(`Using account_graphs.id=${accountGraphId} for user_id=${userId}`);

  console.log('Seeding ingestion queue...');
  const queueId = await seedQueue(supabase, accountGraphId, userId);
  console.log(`Seeded queue item id=${queueId}`);

  console.log('Triggering edge function: graph-ingestion');
  await triggerIngestionFunction(supabaseUrl, serviceRoleKey);

  console.log('Polling graph metrics (up to ~20s)...');
  let last = { nodes: 0, edges: 0 };
  for (let i = 0; i < 10; i += 1) {
    const metrics = await readGraphMetrics(supabase, accountGraphId);
    console.log(`Attempt ${i + 1}: nodes=${metrics.nodes}, edges=${metrics.edges}`);
    if (metrics.nodes > last.nodes || metrics.edges > last.edges) {
      last = metrics;
      if (metrics.nodes > 0 || metrics.edges > 0) break;
    }
    await sleep(2000);
  }

  console.log('Done. Final metrics:', last);
}

main().catch((err) => {
  console.error('E2E graph test failed:', err?.message || err);
  process.exit(1);
});


