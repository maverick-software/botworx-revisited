import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function testCredentialFlow() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!serviceRoleKey) {
    console.error('❌ Service role key not found');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('🔍 TESTING CREDENTIAL FLOW FOR GETZEP');
  console.log('=' .repeat(60));
  
  // Step 1: Get the user's GetZep connection from credentials
  console.log('\n1️⃣ Checking user_oauth_connections...');
  const { data: provider } = await supabase
    .from('service_providers')
    .select('id, name')
    .eq('name', 'getzep')
    .single();

  console.log('   GetZep provider ID:', provider?.id);

  const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';
  const { data: connections } = await supabase
    .from('user_oauth_connections')
    .select('*')
    .eq('oauth_provider_id', provider?.id)
    .eq('user_id', userId)
    .eq('connection_status', 'active');

  console.log(`   Found ${connections?.length || 0} active GetZep connections for user`);
  
  if (connections && connections.length > 0) {
    const conn = connections[0];
    console.log('\n   Connection details:');
    console.log('   - ID:', conn.id);
    console.log('   - Vault Token ID:', conn.vault_access_token_id);
    console.log('   - Connection Name:', conn.connection_name);
    console.log('   - Metadata:', JSON.stringify(conn.connection_metadata, null, 2));
    console.log('   - Scopes:', conn.scopes_granted);
    
    // Step 2: Try to decrypt the vault token
    console.log('\n2️⃣ Attempting to decrypt API key from vault...');
    try {
      const { data: decrypted, error } = await supabase.rpc('vault_decrypt', {
        vault_id: conn.vault_access_token_id
      });
      
      if (error) {
        console.error('   ❌ Vault decryption error:', error);
      } else if (decrypted) {
        console.log('   ✅ Successfully decrypted API key');
        console.log('   - Key starts with:', decrypted.substring(0, 10) + '...');
        console.log('   - Key length:', decrypted.length);
        
        // Step 3: Test the API key with GetZep
        console.log('\n3️⃣ Testing GetZep API with decrypted key...');
        const projectId = conn.connection_metadata?.project_id || conn.connection_metadata?.project_name;
        
        // Test v3 endpoint
        const testResponse = await fetch('https://api.getzep.com/v3/graph/facts', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${decrypted}`,
            'Content-Type': 'application/json',
            'X-Project-Id': projectId
          }
        });
        
        console.log('   Response status:', testResponse.status);
        if (testResponse.ok) {
          console.log('   ✅ GetZep API key is valid!');
        } else {
          const error = await testResponse.text();
          console.error('   ❌ GetZep API error:', error);
          
          // Try without project ID
          console.log('\n   Retrying without X-Project-Id header...');
          const retry = await fetch('https://api.getzep.com/v3/graph/facts', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${decrypted}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (retry.ok) {
            console.log('   ✅ Works without project ID!');
          } else {
            console.error('   ❌ Still failing:', retry.status);
          }
        }
      } else {
        console.log('   ⚠️  No decrypted value returned');
      }
    } catch (err) {
      console.error('   ❌ Exception during decryption:', err);
    }
  }

  // Step 4: Check how the Edge Function retrieves it
  console.log('\n4️⃣ Simulating Edge Function credential retrieval...');
  console.log('   The Edge Function should:');
  console.log('   1. Query user_oauth_connections for active GetZep connection');
  console.log('   2. Get vault_access_token_id from the connection');
  console.log('   3. Call vault_decrypt RPC to get the actual API key');
  console.log('   4. Use the decrypted key with GetZep API');
  
  // Step 5: Check agent configuration
  console.log('\n5️⃣ Checking agent configuration...');
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, metadata')
    .eq('id', '87e6e948-694d-4f8c-8e94-2b4f6281ffc3')
    .single();
    
  if (agent) {
    console.log('   Agent:', agent.name);
    console.log('   Knowledge Graph Enabled:', agent.metadata?.settings?.use_account_graph === true);
  }

  // Step 6: Check account_graphs
  console.log('\n6️⃣ Checking account_graphs configuration...');
  const { data: accountGraph } = await supabase
    .from('account_graphs')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (accountGraph) {
    console.log('   Account Graph ID:', accountGraph.id);
    console.log('   Connection ID:', accountGraph.connection_id);
    console.log('   Should match user connection:', accountGraph.connection_id === connections?.[0]?.id);
  } else {
    console.log('   ❌ No account graph found for user');
  }

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 CREDENTIAL FLOW SUMMARY:');
  console.log('');
  console.log('The system should be using:');
  console.log('1. user_oauth_connections → vault_access_token_id');
  console.log('2. vault_decrypt() → actual API key');
  console.log('3. GetZep API with decrypted key');
  console.log('');
  console.log('If vault decryption fails, the fallback checks if');
  console.log('vault_access_token_id looks like an API key directly.');
}

testCredentialFlow().catch(console.error);
