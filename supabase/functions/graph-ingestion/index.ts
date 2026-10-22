// Deno Deploy/Edge Function: graph-ingestion
// Consumes graph_ingestion_queue in batches and upserts nodes/edges and links
import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Zep client (v3) via ESM
// Docs: https://help.getzep.com/graph-overview
let ZepClient: any = null;
try {
  const mod = await import('https://esm.sh/@getzep/zep-cloud@latest');
  ZepClient = (mod as any)?.ZepClient || null;
} catch (_) {
  ZepClient = null;
}

type QueueRow = {
  id: string;
  account_graph_id: string;
  payload: any;
  status: 'queued'|'processing'|'completed'|'error';
  attempts: number;
};

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || '25');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Claim a batch
    const { data: rows, error } = await supabase
      .from('graph_ingestion_queue')
      .select('id, account_graph_id, payload, status, attempts')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;

    for (const row of (rows || []) as QueueRow[]) {
      const started = Date.now();
      await supabase.from('graph_ingestion_queue').update({ status: 'processing' }).eq('id', row.id);
      try {
        // Resolve connection for this account graph
        const { data: ag, error: agErr } = await supabase
          .from('account_graphs')
          .select('id, user_id, connection_id, settings')
          .eq('id', row.account_graph_id)
          .maybeSingle();
        if (agErr || !ag?.connection_id) throw agErr || new Error('Missing connection for account graph');

        const { data: conn, error: connErr } = await supabase
          .from('user_integration_credentials')
          .select('vault_access_token_id, connection_metadata')
          .eq('id', ag.connection_id)
          .eq('user_id', ag.user_id)
          .maybeSingle();
        if (connErr || !conn?.vault_access_token_id) throw connErr || new Error('Missing vault token for connection');

        // Decrypt the API key using the vault_decrypt RPC function
        const { data: decrypted, error: decErr } = await supabase.rpc('vault_decrypt', { vault_id: conn.vault_access_token_id });
        if (decErr || !decrypted) throw decErr || new Error('Vault decryption failed');

        const apiKey = decrypted as string;
        const projectId = (conn as any)?.connection_metadata?.project_id || undefined;

        // If Zep SDK available, add data directly to the graph
        if (ZepClient) {
          const client = new ZepClient({ apiKey });
          const p = row.payload || {} as any;
          const userId = String(p.user_id || ag.user_id);
          
          // Add the content directly to the user's graph
          const content = p.content || '';
          if (content) {
            try {
              console.log(`[graph-ingestion] Adding data to graph for user ${userId}: ${content.substring(0, 50)}...`);
              
              // Add the content as text data to the user's graph
              // Using "text" type since this is processed agent conversation content
              const episode = await client.graph.add({
                userId: userId,
                type: 'text',
                data: content
              });
              
              console.log(`[graph-ingestion] Successfully added episode ${episode.uuid} to user ${userId}'s graph`);
            } catch (err: any) {
              console.error(`[graph-ingestion] Failed to add data to graph: ${err?.message}`);
              throw err;
            }
          } else {
            console.log(`[graph-ingestion] No content to add for row ${row.id}`);
          }
        }

        await supabase
          .from('graph_ingestion_queue')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', row.id);
      } catch (err: any) {
        await supabase.from('graph_ingestion_queue').update({ status: 'error', error_message: err?.message || 'ingestion error', attempts: row.attempts + 1 }).eq('id', row.id);
      } finally {
        console.log(`[graph-ingestion] processed ${row.id} in ${Date.now() - started}ms`);
      }
    }

    return new Response(JSON.stringify({ processed: (rows || []).length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});


