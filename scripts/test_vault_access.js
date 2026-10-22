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

async function testVaultAccess() {
  console.log('Testing Vault Access\n');
  console.log('===================\n');

  try {
    // First, get the Gmail connection
    const { data: connection, error: connError } = await supabase
      .from('user_oauth_connections')
      .select('id, vault_access_token_id, vault_refresh_token_id, external_username')
      .eq('user_id', USER_ID)
      .single();

    if (connError) {
      console.error('Error fetching connection:', connError);
      return;
    }

    console.log('Connection found:');
    console.log('- ID:', connection.id);
    console.log('- External username:', connection.external_username);
    console.log('- Access token vault ID:', connection.vault_access_token_id);
    console.log('- Refresh token vault ID:', connection.vault_refresh_token_id);
    console.log('');

    // Test get_secret function with access token vault ID
    console.log('Testing get_secret function with access token vault ID...');
    const { data: secretData, error: secretError } = await supabase.rpc(
      'get_secret',
      { secret_id: connection.vault_access_token_id }
    );

    console.log('get_secret result:', {
      data: secretData,
      error: secretError,
      hasData: !!secretData,
      dataLength: secretData?.length
    });

    if (secretData && secretData.length > 0) {
      console.log('\nSecret retrieved successfully!');
      console.log('- Key exists:', !!secretData[0].key);
      console.log('- Key type:', typeof secretData[0].key);
      console.log('- Key starts with:', secretData[0].key ? secretData[0].key.substring(0, 20) + '...' : 'null');
    }

    // Test direct query to vault.decrypted_secrets
    console.log('\n\nTesting direct access to vault.decrypted_secrets...');
    const { data: vaultData, error: vaultError } = await supabase
      .from('vault.decrypted_secrets')
      .select('id, name, decrypted_secret')
      .eq('id', connection.vault_access_token_id);

    if (vaultError) {
      console.log('Direct vault access error:', vaultError.message);
      console.log('This is expected if the schema permissions are restricted');
    } else {
      console.log('Direct vault access succeeded (unexpected):', vaultData);
    }

    // Test if the vault schema exists
    console.log('\n\nChecking if vault schema exists...');
    const { data: schemaCheck, error: schemaError } = await supabase.rpc('to_regnamespace', { schema_name: 'vault' });
    console.log('Vault schema check:', { exists: !!schemaCheck && schemaCheck !== null, error: schemaError });

  } catch (err) {
    console.error('Error:', err);
  }
}

testVaultAccess(); 