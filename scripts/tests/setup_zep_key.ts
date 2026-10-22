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
  
  console.log('Storing GetZep API key in vault...');
  
  // Store the secret using the existing create_vault_secret function
  const vaultSecretName = `getzep_api_key_${Date.now()}`;
  const { data: vaultId, error: vaultError } = await supabase.rpc('create_vault_secret', {
    p_secret: ZEP_API_KEY,
    p_name: vaultSecretName,
    p_description: 'GetZep API key for knowledge graph'
  });

  if (vaultError) {
    console.error('Failed to store secret in vault:', vaultError);
    return;
  }
  
  console.log('Vault secret created with ID:', vaultId);
  
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

  // Update the existing GetZep connection with the proper vault ID
  const { data: existingConn } = await supabase
    .from('user_oauth_connections')
    .select('id')
    .eq('oauth_provider_id', provider.id)
    .eq('connection_status', 'active')
    .single();

  if (existingConn) {
    // Update existing connection
    const { data: updated, error: updateError } = await supabase
      .from('user_oauth_connections')
      .update({
        vault_access_token_id: vaultId,
        connection_metadata: {
          project_id: '877b341c-355d-41cf-91b7-fc558072bb1f',  // Extracted from the API key
          account_id: null
        },
        scopes_granted: ['graph_read', 'graph_write', 'memory_read', 'memory_write']
      })
      .eq('id', existingConn.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update connection:', updateError);
    } else {
      console.log('Updated GetZep connection successfully');
      console.log('Connection ID:', updated.id);
    }
  } else {
    console.log('No existing GetZep connection found to update');
  }

  // Verify the setup
  console.log('\nVerifying setup...');
  const { data: decrypted, error: decryptError } = await supabase.rpc('vault_decrypt', {
    vault_id: vaultId
  });

  if (decryptError) {
    console.error('Failed to decrypt:', decryptError);
  } else {
    console.log('Successfully decrypted API key (last 4 chars):', '...' + decrypted.slice(-4));
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
          content: 'Test: GetZep integration is now working with Agentopia for knowledge graph management.',
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
      console.log('\nSetup complete! You can now run the e2e test.');
    }
  }
}

main().catch(console.error);
