import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function verifyVaultRetrieval() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!serviceRoleKey) {
    console.error('❌ Service role key not found');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('🔐 VERIFYING VAULT API KEY RETRIEVAL');
  console.log('=' .repeat(60));
  
  const agentId = '87e6e948-694d-4f8c-8e94-2b4f6281ffc3'; // Angela
  const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';
  
  console.log('1️⃣ Simulating GetZepSemanticManager initialization...');
  
  try {
    // Step 1: Check agent configuration
    const { data: agent } = await supabase
      .from('agents')
      .select('metadata, user_id')
      .eq('id', agentId)
      .maybeSingle();
    
    if (!agent?.metadata?.settings?.use_account_graph) {
      console.log('   ❌ Graph not enabled for agent');
      return;
    }
    console.log('   ✅ Agent has graph enabled');

    // Step 2: Get account graph
    const { data: accountGraph } = await supabase
      .from('account_graphs')
      .select('id, connection_id')
      .eq('user_id', agent.user_id)
      .maybeSingle();
    
    if (!accountGraph?.connection_id) {
      console.log('   ❌ No account graph configured');
      return;
    }
    console.log('   ✅ Account graph found:', accountGraph.id);
    console.log('   - Connection ID:', accountGraph.connection_id);

    // Step 3: Get connection details
    const { data: connection } = await supabase
      .from('user_oauth_connections')
      .select('vault_access_token_id, connection_metadata, connection_name, connection_status')
      .eq('id', accountGraph.connection_id)
      .maybeSingle();
    
    if (!connection?.vault_access_token_id) {
      console.log('   ❌ No GetZep connection found');
      return;
    }
    
    console.log('   ✅ Connection found:');
    console.log('   - Name:', connection.connection_name);
    console.log('   - Status:', connection.connection_status);
    console.log('   - Vault Token ID:', connection.vault_access_token_id);
    console.log('   - Metadata:', JSON.stringify(connection.connection_metadata, null, 2));

    // Step 4: Test vault decryption
    console.log('\n2️⃣ Testing vault decryption...');
    const { data: apiKey, error: decryptError } = await supabase.rpc('vault_decrypt', {
      vault_id: connection.vault_access_token_id
    });

    if (decryptError) {
      console.error('   ❌ Vault decryption error:', decryptError);
      return;
    }

    if (!apiKey) {
      console.log('   ❌ No API key returned from vault');
      return;
    }

    console.log('   ✅ API key successfully retrieved from vault');
    console.log('   - Key starts with:', apiKey.substring(0, 10) + '...');
    console.log('   - Key length:', apiKey.length);
    console.log('   - Key format valid:', apiKey.startsWith('z_') ? '✅' : '❌');

    // Step 5: Verify this matches what we expect
    const expectedKey = (process.env.GETZEP_API_KEY ?? (() => { throw new Error('Set GETZEP_API_KEY before running this manual check.'); })());
    
    console.log('\n3️⃣ Verifying API key correctness...');
    console.log('   Expected key starts with:', expectedKey.substring(0, 20) + '...');
    console.log('   Retrieved key starts with:', apiKey.substring(0, 20) + '...');
    console.log('   Keys match:', apiKey === expectedKey ? '✅' : '❌');
    
    if (apiKey !== expectedKey) {
      console.log('   ⚠️  API key mismatch detected!');
      console.log('   - Expected length:', expectedKey.length);
      console.log('   - Retrieved length:', apiKey.length);
    }

    // Step 6: Test the API key with GetZep
    console.log('\n4️⃣ Testing API key with GetZep...');
    
    // Test a simple endpoint to verify the key works
    const testResponse = await fetch('https://api.getzep.com/healthz', {
      method: 'GET'
    });
    
    console.log('   GetZep health check:', testResponse.status, testResponse.statusText);
    
    // Note: We can't easily test the actual API key without the full SDK in Node.js
    // But we can verify the key format and vault retrieval process
    
    console.log('\n5️⃣ Configuration summary...');
    const config = {
      apiKey: apiKey,
      projectId: connection.connection_metadata?.project_id,
      accountId: connection.connection_metadata?.account_id,
      userId: agent.user_id
    };
    
    console.log('   GetZep Config that would be used:');
    console.log('   - API Key:', config.apiKey ? '✅ Present' : '❌ Missing');
    console.log('   - Project ID:', config.projectId || 'Not set');
    console.log('   - Account ID:', config.accountId || 'Not set');
    console.log('   - User ID:', config.userId);
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 VAULT RETRIEVAL STATUS:');
    console.log('');
    
    if (apiKey === expectedKey) {
      console.log('✅ VAULT WORKING CORRECTLY');
      console.log('  - Correct API key retrieved from vault');
      console.log('  - Connection properly configured');
      console.log('  - GetZep should be receiving valid credentials');
    } else {
      console.log('⚠️  POTENTIAL ISSUE DETECTED');
      console.log('  - API key retrieved but doesn\'t match expected');
      console.log('  - May need to update the stored credential');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

verifyVaultRetrieval().catch(console.error);
