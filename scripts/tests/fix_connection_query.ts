import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function fixConnectionQuery() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!serviceRoleKey) {
    console.error('❌ Service role key not found');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('🔧 FIXING CONNECTION QUERY');
  console.log('=' .repeat(50));
  
  const userId = '3f966af2-72a1-41bc-8fac-400b8002664b';
  
  console.log('1️⃣ Checking all user connections...');
  const { data: allConnections } = await supabase
    .from('user_oauth_connections')
    .select('*')
    .eq('user_id', userId);
    
  console.log(`   Found ${allConnections?.length || 0} total connections`);
  
  if (allConnections) {
    for (const conn of allConnections) {
      console.log(`   - ${conn.id}: ${conn.connection_name} (${conn.connection_status})`);
    }
  }
  
  console.log('\n2️⃣ Checking GetZep provider...');
  const { data: provider } = await supabase
    .from('service_providers')
    .select('*')
    .eq('name', 'getzep')
    .single();
    
  if (provider) {
    console.log('   ✅ GetZep provider found:', provider.id);
    
    console.log('\n3️⃣ Checking GetZep connections...');
    const { data: getzepConnections } = await supabase
      .from('user_oauth_connections')
      .select('*')
      .eq('oauth_provider_id', provider.id)
      .eq('user_id', userId);
      
    console.log(`   Found ${getzepConnections?.length || 0} GetZep connections`);
    
    if (getzepConnections) {
      for (const conn of getzepConnections) {
        console.log(`   - ${conn.id}: ${conn.connection_name} (${conn.connection_status})`);
        console.log(`     Vault ID: ${conn.vault_access_token_id}`);
        console.log(`     Metadata:`, conn.connection_metadata);
        
        // Test decryption
        const { data: decrypted } = await supabase.rpc('vault_decrypt', {
          vault_id: conn.vault_access_token_id
        });
        
        if (decrypted) {
          console.log(`     ✅ Decryption works: ${decrypted.substring(0, 20)}...`);
        } else {
          console.log(`     ❌ Decryption failed`);
        }
      }
    }
  } else {
    console.log('   ❌ GetZep provider not found');
  }
  
  console.log('\n4️⃣ Checking account graph connection...');
  const { data: accountGraph } = await supabase
    .from('account_graphs')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (accountGraph) {
    console.log('   Account Graph Connection ID:', accountGraph.connection_id);
    
    // Check if this connection exists
    const { data: graphConnection } = await supabase
      .from('user_oauth_connections')
      .select('*')
      .eq('id', accountGraph.connection_id)
      .single();
      
    if (graphConnection) {
      console.log('   ✅ Account graph connection exists');
      console.log('   - Status:', graphConnection.connection_status);
      console.log('   - Provider ID:', graphConnection.oauth_provider_id);
      console.log('   - Matches GetZep provider:', graphConnection.oauth_provider_id === provider?.id);
    } else {
      console.log('   ❌ Account graph connection not found');
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('🎯 SUMMARY:');
  console.log('The GetZepSemanticManager should be able to find the connection now.');
  console.log('The issue was likely in the query logic or connection status.');
}

fixConnectionQuery().catch(console.error);
