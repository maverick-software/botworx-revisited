const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkTokenStorage() {
  console.log('Checking Gmail token storage...\n');
  
  // Check the actual token values
  const { data: connections, error: connError } = await supabase
    .from('user_oauth_connections')
    .select('vault_access_token_id, vault_refresh_token_id, expires_at')
    .eq('provider', 'gmail')
    .eq('is_active', true);
    
  if (connections && connections.length > 0) {
    const conn = connections[0];
    console.log('Token storage format:');
    console.log('Access token ID:', conn.vault_access_token_id ? conn.vault_access_token_id.substring(0, 50) + '...' : 'null');
    console.log('Refresh token ID:', conn.vault_refresh_token_id ? conn.vault_refresh_token_id.substring(0, 50) + '...' : 'null');
    console.log('Expires at:', conn.expires_at);
    
    // Check if they look like UUIDs
    const accessLooksLikeUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conn.vault_access_token_id);
    const refreshLooksLikeUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conn.vault_refresh_token_id);
    
    console.log('\nAccess token looks like UUID:', accessLooksLikeUUID);
    console.log('Refresh token looks like UUID:', refreshLooksLikeUUID);
    console.log('Access token length:', conn.vault_access_token_id ? conn.vault_access_token_id.length : 0);
    console.log('Refresh token length:', conn.vault_refresh_token_id ? conn.vault_refresh_token_id.length : 0);
  }
  
  // Try to call get_secret directly
  console.log('\nTrying to call get_secret RPC...');
  const { data: secretTest, error: secretError } = await supabase.rpc('get_secret', { secret_id: '00000000-0000-0000-0000-000000000000' });
  if (secretError) {
    console.log('get_secret RPC error:', secretError.message);
  } else {
    console.log('get_secret RPC exists and returned:', secretTest);
  }
  
  // Check if vault table exists
  console.log('\nChecking if vault table exists...');
  const { data: vaultCheck, error: vaultError } = await supabase
    .from('vault')
    .select('id')
    .limit(1);
  
  if (vaultError) {
    console.log('Vault table error:', vaultError.message);
  } else {
    console.log('Vault table exists');
  }
  
  process.exit(0);
}

checkTokenStorage().catch(console.error); 