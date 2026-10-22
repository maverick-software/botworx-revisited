import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const USER_ID = '3f966af2-72a1-41bc-8fac-400b8002664b';

async function checkTokenStorage() {
  console.log('Checking Gmail Token Storage\n');
  console.log('============================\n');

  try {
    // Get Gmail connection with tokens
    const { data: connection, error } = await supabase
      .from('user_oauth_connections')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('oauth_provider_id', (await supabase.from('service_providers').select('id').eq('name', 'gmail').single()).data.id)
      .single();

    if (error) {
      console.error('Error fetching connection:', error);
      return;
    }

    console.log('Connection found:');
    console.log('- ID:', connection.id);
    console.log('- External username:', connection.external_username);
    console.log('- Connection status:', connection.connection_status);
    console.log('- Token expires at:', connection.token_expires_at);
    console.log('\nToken storage fields:');
    console.log('- vault_access_token_id type:', typeof connection.vault_access_token_id);
    console.log('- vault_access_token_id length:', connection.vault_access_token_id?.length);
    console.log('- vault_access_token_id preview:', connection.vault_access_token_id ? 
      connection.vault_access_token_id.substring(0, 50) + '...' : 'null');
    console.log('- vault_refresh_token_id type:', typeof connection.vault_refresh_token_id);
    console.log('- vault_refresh_token_id exists:', !!connection.vault_refresh_token_id);

    // Check if these look like encrypted tokens or vault IDs
    if (connection.vault_access_token_id) {
      const tokenValue = connection.vault_access_token_id;
      const looksLikeUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenValue);
      const looksLikeJWT = tokenValue.includes('.');
      const looksLikeEncrypted = tokenValue.startsWith('encrypted:') || tokenValue.length > 100;
      
      console.log('\nToken format analysis:');
      console.log('- Looks like UUID (vault reference):', looksLikeUUID);
      console.log('- Looks like JWT token:', looksLikeJWT);
      console.log('- Looks like encrypted:', looksLikeEncrypted);
      console.log('- Looks like plain token:', !looksLikeUUID && tokenValue.length > 20);
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

checkTokenStorage(); 