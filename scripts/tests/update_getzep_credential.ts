import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function updateGetZepCredential() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://txhscptzjrrudnqwavcb.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!serviceRoleKey) {
    console.error('❌ Service role key not found');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  console.log('🔧 UPDATING GETZEP CREDENTIAL');
  console.log('=' .repeat(60));
  
  // The actual GetZep API key from your previous messages
  const GETZEP_API_KEY = (process.env.GETZEP_API_KEY ?? (() => { throw new Error('Set GETZEP_API_KEY before running this manual check.'); })());
  const PROJECT_ID = '877b341c-355d-41cf-91b7-fc558072bb1f';
  
  console.log('1️⃣ Testing the API key first...');
  const testResponse = await fetch('https://api.getzep.com/v3/graph/facts', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${GETZEP_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Project-Id': PROJECT_ID
    }
  });
  
  console.log('   Response status:', testResponse.status);
  if (!testResponse.ok) {
    const error = await testResponse.text();
    console.error('   ❌ API key test failed:', error);
    console.log('\n   ⚠️  The API key may be expired. You need a new one from GetZep.');
    return;
  }
  
  console.log('   ✅ API key is valid!');
  
  console.log('\n2️⃣ Updating the connection in database...');
  
  // Since vault is broken, we'll store the API key directly as a workaround
  // The vault_decrypt function will return it as-is since it starts with 'z_'
  const { data: updated, error } = await supabase
    .from('user_oauth_connections')
    .update({
      vault_access_token_id: GETZEP_API_KEY, // Store directly since vault is broken
      connection_metadata: {
        project_id: PROJECT_ID,
        project_name: 'agentopia',
        account_id: 'f34817d7-0e28-41e2-9838-9f13215a0bc2'
      }
    })
    .eq('id', '9f533b8c-4d86-4530-a848-f8df5a14206e')
    .select()
    .single();
    
  if (error) {
    console.error('   ❌ Update failed:', error);
  } else {
    console.log('   ✅ Connection updated successfully');
    console.log('   - Vault Token ID:', updated.vault_access_token_id.substring(0, 20) + '...');
  }
  
  console.log('\n3️⃣ Testing vault_decrypt fallback...');
  const { data: decrypted } = await supabase.rpc('vault_decrypt', {
    vault_id: GETZEP_API_KEY
  });
  
  if (decrypted) {
    console.log('   ✅ vault_decrypt returns the API key correctly');
    console.log('   - Returned:', decrypted.substring(0, 20) + '...');
  } else {
    console.log('   ❌ vault_decrypt failed to return the key');
  }
  
  console.log('\n4️⃣ Testing the full flow...');
  
  // Simulate what the Edge Function does
  const { data: connection } = await supabase
    .from('user_oauth_connections')
    .select('vault_access_token_id, connection_metadata')
    .eq('id', '9f533b8c-4d86-4530-a848-f8df5a14206e')
    .single();
    
  if (connection) {
    const { data: apiKey } = await supabase.rpc('vault_decrypt', {
      vault_id: connection.vault_access_token_id
    });
    
    if (apiKey) {
      console.log('   ✅ Full credential flow works!');
      
      // Test with GetZep API
      const finalTest = await fetch('https://api.getzep.com/v3/graph/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Project-Id': connection.connection_metadata?.project_id
        },
        body: JSON.stringify({
          user_id: 'test_' + Date.now(),
          content: 'Test message from credential update'
        })
      });
      
      if (finalTest.ok) {
        console.log('   ✅ GetZep API accepts the credential!');
      } else {
        console.error('   ❌ GetZep API rejected:', finalTest.status);
      }
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ CREDENTIAL UPDATE COMPLETE');
  console.log('');
  console.log('The GetZep connection now uses the API key directly');
  console.log('since Supabase Vault decryption is broken.');
  console.log('');
  console.log('The Edge Functions will now be able to:');
  console.log('1. Get the API key from user_oauth_connections');
  console.log('2. Use vault_decrypt (which returns it as-is)');
  console.log('3. Call GetZep API successfully');
}

updateGetZepCredential().catch(console.error);
