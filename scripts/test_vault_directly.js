import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testVaultAccess() {
  console.log('Testing vault access...\n');
  
  // First, get the vault IDs from the connection
  const { data: connections, error: connError } = await supabase
    .from('user_oauth_connections')
    .select('vault_access_token_id, vault_refresh_token_id')
    .eq('connection_status', 'active')
    .single();
    
  if (connError) {
    console.error('Error fetching connection:', connError);
    return;
  }
  
  console.log('Vault IDs found:');
  console.log('Access token ID:', connections.vault_access_token_id);
  console.log('Refresh token ID:', connections.vault_refresh_token_id);
  
  // Test if we can call get_secret RPC
  console.log('\nTesting get_secret RPC...');
  const { data: secretData, error: secretError } = await supabase.rpc('get_secret', {
    secret_id: connections.vault_access_token_id
  });
  
  if (secretError) {
    console.error('\nRPC Error:', secretError);
    
    // Try accessing vault.decrypted_secrets directly
    console.log('\nTrying direct vault access...');
    const { data: vaultData, error: vaultError } = await supabase
      .from('vault.decrypted_secrets')
      .select('*')
      .eq('id', connections.vault_access_token_id);
      
    if (vaultError) {
      console.error('Direct vault error:', vaultError);
      
      // Check if vault schema exists
      console.log('\nChecking vault schema...');
      const { data: schemas, error: schemaError } = await supabase.rpc('current_schemas');
      if (schemaError) {
        console.error('Schema check error:', schemaError);
      } else {
        console.log('Available schemas:', schemas);
      }
    } else {
      console.log('Direct vault data:', vaultData);
    }
  } else {
    console.log('\nSecret retrieved successfully!');
    console.log('Data:', secretData);
  }
  
  process.exit(0);
}

testVaultAccess().catch(console.error); 