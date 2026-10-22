import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, { 
    auth: { persistSession: false } 
  });

  // Get GetZep provider ID
  const { data: provider } = await supabase
    .from('service_providers')
    .select('id')
    .eq('name', 'getzep')
    .single();

  if (!provider) {
    console.error('GetZep provider not found');
    return;
  }

  // Get GetZep connection
  const { data: connections } = await supabase
    .from('user_oauth_connections')
    .select('id, vault_access_token_id, connection_metadata, connection_status')
    .eq('oauth_provider_id', provider.id)
    .eq('connection_status', 'active');

  console.log('GetZep connections:', JSON.stringify(connections, null, 2));

  if (connections && connections.length > 0) {
    const conn = connections[0];
    console.log('\nTrying to decrypt vault_access_token_id:', conn.vault_access_token_id);
    
    // Try to decrypt
    const { data: decrypted, error } = await supabase.rpc('vault_decrypt', { 
      vault_id: conn.vault_access_token_id 
    });
    
    if (error) {
      console.error('Decryption error:', error);
      console.log('\nThe vault_access_token_id might be the API key itself (not encrypted)');
      console.log('API Key (if plain):', conn.vault_access_token_id);
    } else {
      console.log('Decrypted API key:', decrypted ? '***' + decrypted.slice(-4) : 'null');
    }
    
    console.log('\nConnection metadata:', conn.connection_metadata);
  }
}

main().catch(console.error);
