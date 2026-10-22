import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  // The GetZep API key you provided
  const ZEP_API_KEY = (process.env.GETZEP_API_KEY ?? (() => { throw new Error('Set GETZEP_API_KEY before running this manual check.'); })());
  const PROJECT_ID = '877b341c-355d-41cf-91b7-fc558072bb1f'; // Extracted from the API key
  
  console.log('Updating GetZep connection to store API key directly (temporary workaround)...');
  
  // Get the GetZep provider
  const { data: provider } = await supabase
    .from('service_providers')
    .select('id')
    .eq('name', 'getzep')
    .single();

  if (!provider) {
    console.error('GetZep provider not found');
    return;
  }

  // Update the existing GetZep connection with the API key directly
  // This is a temporary workaround since vault decryption is having issues
  const { data: updated, error: updateError } = await supabase
    .from('user_oauth_connections')
    .update({
      vault_access_token_id: ZEP_API_KEY, // Store directly as a workaround
      connection_metadata: {
        project_id: PROJECT_ID,
        account_id: null
      },
      scopes_granted: ['graph_read', 'graph_write', 'memory_read', 'memory_write']
    })
    .eq('oauth_provider_id', provider.id)
    .eq('connection_status', 'active')
    .select()
    .single();

  if (updateError) {
    console.error('Failed to update connection:', updateError);
  } else {
    console.log('Updated GetZep connection successfully');
    console.log('Connection ID:', updated.id);
  }

  // Test by creating a queue item
  console.log('\nCreating test ingestion queue item...');
  const { data: accountGraph } = await supabase
    .from('account_graphs')
    .select('id')
    .limit(1)
    .single();

  if (accountGraph) {
    const { data: queueItem, error: queueError } = await supabase
      .from('graph_ingestion_queue')
      .insert({
        account_graph_id: accountGraph.id,
        payload: {
          content: 'Test: User is integrating GetZep knowledge graph with Agentopia for advanced memory management.',
          user_id: '3f966af2-72a1-41bc-8fac-400b8002664b',
          entities: [],
          relations: [],
          source_kind: 'message'
        },
        status: 'queued'
      })
      .select('id')
      .single();

    if (queueError) {
      console.error('Failed to create queue item:', queueError);
    } else {
      console.log('Created test queue item:', queueItem.id);
      console.log('\nNOTE: This is a temporary workaround. The API key is stored directly.');
      console.log('In production, you should fix the vault encryption issue.');
    }
  }
}

main().catch(console.error);
