import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  // Your GetZep API key (you'll need to provide this)
  const ZEP_API_KEY = process.env.ZEP_API_KEY || 'YOUR_ZEP_API_KEY_HERE';
  const ZEP_PROJECT_ID = process.env.ZEP_PROJECT_ID || 'YOUR_PROJECT_ID_HERE';
  
  if (ZEP_API_KEY === 'YOUR_ZEP_API_KEY_HERE') {
    console.error('Please set ZEP_API_KEY environment variable or edit this script with your actual API key');
    return;
  }

  console.log('Creating vault secret for GetZep API key...');
  
  // Create vault secret
  const vaultSecretName = `getzep_api_key_test_${Date.now()}`;
  const { data: vaultData, error: vaultError } = await supabase.rpc('vault_create_secret', {
    secret_name: vaultSecretName,
    secret_value: ZEP_API_KEY,
    description: 'GetZep API key for testing'
  });

  if (vaultError) {
    // Try alternative approach - direct vault table insert
    console.log('vault_create_secret failed, trying direct insert...');
    const { data: secretData, error: secretError } = await supabase
      .from('vault_secrets')
      .insert({
        name: vaultSecretName,
        secret: ZEP_API_KEY,
        description: 'GetZep API key for testing'
      })
      .select('id')
      .single();
    
    if (secretError) {
      console.error('Failed to create vault secret:', secretError);
      return;
    }
    
    console.log('Vault secret created with ID:', secretData.id);
    
    // Update the existing GetZep connection
    const { data: provider } = await supabase
      .from('service_providers')
      .select('id')
      .eq('name', 'getzep')
      .single();

    const { data: updated, error: updateError } = await supabase
      .from('user_oauth_connections')
      .update({
        vault_access_token_id: secretData.id,
        connection_metadata: {
          project_id: ZEP_PROJECT_ID,
          account_id: null
        }
      })
      .eq('oauth_provider_id', provider.id)
      .eq('connection_status', 'active')
      .select();

    if (updateError) {
      console.error('Failed to update connection:', updateError);
    } else {
      console.log('Updated GetZep connection successfully');
      console.log('Connection details:', updated);
    }
  } else {
    console.log('Vault secret created:', vaultData);
  }

  // Test the graph ingestion
  console.log('\nTesting graph ingestion...');
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
          content: 'Test message: User is working on integrating GetZep knowledge graph with Agentopia platform.',
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
      console.log('\nNow trigger the graph-ingestion edge function to process it');
    }
  }
}

main().catch(console.error);
